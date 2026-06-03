using DineDrop.Domain.Entities;
using DineDrop.Domain.Enums;
using DineDrop.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace DineDrop.API.Controllers
{
    [ApiController]
    [Route("api/offer")]
    [Authorize]
    public class OfferController : ControllerBase
    {
        private readonly AppDbContext _context;

        public OfferController(AppDbContext context)
        {
            _context = context;
        }

        private Guid GetUserId()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdClaim))
                throw new UnauthorizedAccessException("User not found in token.");
            return Guid.Parse(userIdClaim);
        }

        // 1. Create an Offer (Admin or Restaurant)
        [HttpPost]
        [Authorize(Roles = "Admin,Restaurant")]
        public async Task<IActionResult> CreateOffer([FromBody] CreateOfferDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Code))
                return BadRequest("Coupon code is required.");

            var code = dto.Code.Trim().ToUpper();
            var exists = await _context.Offers.AnyAsync(o => o.Code.ToUpper() == code && !o.IsDeleted);
            if (exists)
                return BadRequest("A coupon with this code already exists.");

            if (dto.Type == OfferType.Percentage && dto.Value > 100)
                return BadRequest("Percentage discount cannot exceed 100%.");
            if (dto.Type == OfferType.Flat && dto.Value > 500)
                return BadRequest("Flat discount amount cannot exceed ₹500.");

            var userId = GetUserId();
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return NotFound("User not found.");

            var offer = new Offer
            {
                Code = code,
                Type = dto.Type,
                Value = dto.Value,
                MinOrderAmount = dto.MinOrderAmount,
                ExpiryDate = dto.ExpiryDate,
                IsActive = true,
                CreatedAt = DateTime.UtcNow.AddHours(5).AddMinutes(30)
            };

            if (user.Role == UserRole.Restaurant)
            {
                var restaurant = await _context.Restaurants.FirstOrDefaultAsync(r => r.OwnerId == userId);
                if (restaurant == null)
                    return BadRequest("Restaurant profile not found for this user.");
                
                offer.CreatedBy = "Restaurant";
                offer.RestaurantId = restaurant.Id;
            }
            else // Admin
            {
                offer.CreatedBy = "Platform";
                offer.RestaurantId = null;
            }

            _context.Offers.Add(offer);
            await _context.SaveChangesAsync();

            return Ok(offer);
        }

        // 2. List Offers
        [HttpGet]
        public async Task<IActionResult> ListOffers()
        {
            var userId = GetUserId();
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return NotFound("User not found.");

            if (user.Role == UserRole.Admin)
            {
                var offers = await _context.Offers
                    .Where(o => !o.IsDeleted)
                    .OrderByDescending(o => o.CreatedAt)
                    .Select(o => new {
                        o.Id,
                        o.Code,
                        o.CreatedBy,
                        o.RestaurantId,
                        o.IsActive,
                        o.Type,
                        o.Value,
                        o.MinOrderAmount,
                        o.ExpiryDate,
                        o.CreatedAt,
                        o.UpdatedAt,
                        RestaurantName = _context.Restaurants.Where(r => r.Id == o.RestaurantId).Select(r => r.Name).FirstOrDefault()
                    })
                    .ToListAsync();
                return Ok(offers);
            }
            else if (user.Role == UserRole.Restaurant)
            {
                var restaurant = await _context.Restaurants.FirstOrDefaultAsync(r => r.OwnerId == userId);
                if (restaurant == null)
                    return Ok(new List<Offer>());

                var offers = await _context.Offers
                    .Where(o => o.RestaurantId == restaurant.Id && !o.IsDeleted)
                    .OrderByDescending(o => o.CreatedAt)
                    .ToListAsync();
                return Ok(offers);
            }
            else // Customer (User) or Driver
            {
                // Return all active offers
                var offers = await _context.Offers
                    .Where(o => o.IsActive && o.ExpiryDate >= DateTime.UtcNow.AddHours(5).AddMinutes(30) && !o.IsDeleted)
                    .OrderByDescending(o => o.CreatedAt)
                    .ToListAsync();
                return Ok(offers);
            }
        }

        // 3. Toggle Offer Status (Admin or Restaurant Owner)
        [HttpPost("toggle/{id}")]
        [Authorize(Roles = "Admin,Restaurant")]
        public async Task<IActionResult> ToggleOffer(Guid id)
        {
            var userId = GetUserId();
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return NotFound("User not found.");

            var offer = await _context.Offers.FindAsync(id);
            if (offer == null || offer.IsDeleted)
                return NotFound("Offer not found.");

            if (user.Role == UserRole.Restaurant)
            {
                var restaurant = await _context.Restaurants.FirstOrDefaultAsync(r => r.OwnerId == userId);
                if (restaurant == null || offer.RestaurantId != restaurant.Id)
                    return Unauthorized("You are not authorized to toggle this offer.");
            }

            offer.IsActive = !offer.IsActive;
            offer.UpdatedAt = DateTime.UtcNow.AddHours(5).AddMinutes(30);
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Coupon status toggled to {(offer.IsActive ? "Active" : "Inactive")}", isActive = offer.IsActive });
        }

        // 3b. Edit Offer
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Restaurant")]
        public async Task<IActionResult> EditOffer(Guid id, [FromBody] CreateOfferDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Code))
                return BadRequest("Coupon code is required.");

            var code = dto.Code.Trim().ToUpper();
            var exists = await _context.Offers.AnyAsync(o => o.Code.ToUpper() == code && o.Id != id && !o.IsDeleted);
            if (exists)
                return BadRequest("A coupon with this code already exists.");

            if (dto.Type == OfferType.Percentage && dto.Value > 100)
                return BadRequest("Percentage discount cannot exceed 100%.");
            if (dto.Type == OfferType.Flat && dto.Value > 500)
                return BadRequest("Flat discount amount cannot exceed ₹500.");

            var userId = GetUserId();
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return NotFound("User not found.");

            var offer = await _context.Offers.FindAsync(id);
            if (offer == null || offer.IsDeleted)
                return NotFound("Offer not found.");

            if (user.Role == UserRole.Restaurant)
            {
                var restaurant = await _context.Restaurants.FirstOrDefaultAsync(r => r.OwnerId == userId);
                if (restaurant == null || offer.RestaurantId != restaurant.Id)
                    return Unauthorized("You are not authorized to edit this offer.");
            }

            offer.Code = code;
            offer.Type = dto.Type;
            offer.Value = dto.Value;
            offer.MinOrderAmount = dto.MinOrderAmount;
            offer.ExpiryDate = dto.ExpiryDate;
            offer.UpdatedAt = DateTime.UtcNow.AddHours(5).AddMinutes(30);

            await _context.SaveChangesAsync();
            return Ok(offer);
        }

        // 4. Delete Offer (Soft Delete)
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Restaurant")]
        public async Task<IActionResult> DeleteOffer(Guid id)
        {
            var userId = GetUserId();
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                return NotFound("User not found.");

            var offer = await _context.Offers.FindAsync(id);
            if (offer == null || offer.IsDeleted)
                return NotFound("Offer not found.");

            if (user.Role == UserRole.Restaurant)
            {
                var restaurant = await _context.Restaurants.FirstOrDefaultAsync(r => r.OwnerId == userId);
                if (restaurant == null || offer.RestaurantId != restaurant.Id)
                    return Unauthorized("You are not authorized to delete this offer.");
            }

            offer.IsDeleted = true;
            offer.UpdatedAt = DateTime.UtcNow.AddHours(5).AddMinutes(30);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Offer deleted successfully." });
        }

        // 5. Apply/Validate Coupon Code for Customer Checkout
        [HttpGet("apply")]
        [Authorize(Roles = "User")]
        public async Task<IActionResult> ApplyCoupon([FromQuery] string code, [FromQuery] Guid restaurantId, [FromQuery] decimal subtotal)
        {
            if (string.IsNullOrWhiteSpace(code))
                return BadRequest("Coupon code is required.");

            var uppercaseCode = code.Trim().ToUpper();
            var offer = await _context.Offers
                .FirstOrDefaultAsync(o => o.Code.ToUpper() == uppercaseCode && o.IsActive && o.ExpiryDate >= DateTime.UtcNow.AddHours(5).AddMinutes(30) && !o.IsDeleted);

            if (offer == null)
                return BadRequest(new { isValid = false, message = "Coupon code is invalid or has expired." });

            if (subtotal < offer.MinOrderAmount)
                return BadRequest(new { isValid = false, message = $"Minimum order amount for this coupon is ₹{offer.MinOrderAmount:F2}." });

            if (offer.CreatedBy == "Restaurant" && offer.RestaurantId.HasValue && offer.RestaurantId.Value != restaurantId)
                return BadRequest(new { isValid = false, message = "This coupon code is not valid for this restaurant." });

            // Check first order restriction
            if (uppercaseCode == "NEW50" || uppercaseCode == "FIRST50")
            {
                var userId = GetUserId();
                var hasOrders = await _context.Orders.AnyAsync(o => o.UserId == userId && o.Status != OrderStatus.Cancelled);
                if (hasOrders)
                {
                    return BadRequest(new { isValid = false, message = "This coupon is only valid for your first order." });
                }
            }

            decimal discountAmount = 0;
            if (offer.Type == OfferType.Percentage)
            {
                discountAmount = Math.Round(subtotal * (offer.Value / 100.00m), 2);
            }
            else if (offer.Type == OfferType.Flat)
            {
                discountAmount = Math.Min(subtotal, offer.Value);
            }

            return Ok(new
            {
                isValid = true,
                offerId = offer.Id,
                code = offer.Code,
                discountAmount,
                createdBy = offer.CreatedBy,
                message = $"Coupon applied! Saved ₹{discountAmount:F2}."
            });
        }
    }

    public class CreateOfferDto
    {
        public string Code { get; set; } = string.Empty;
        public OfferType Type { get; set; }
        public decimal Value { get; set; }
        public decimal MinOrderAmount { get; set; }
        public DateTime ExpiryDate { get; set; }
    }
}
