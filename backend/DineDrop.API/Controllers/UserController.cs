using DineDrop.Application.Modules.Users.DTOs;
using DineDrop.Application.Modules.Users.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace DineDrop.API.Controllers
{
    [Route("api/user")]
    [ApiController]
    public class UserController : ControllerBase
    {
        private readonly IUserService _userService;
        private readonly IConfiguration _config;
        public UserController(IUserService userService, IConfiguration config)
        {
            _userService = userService;
            _config = config;
        }

        [HttpGet("restaurants")]
        public async Task<IActionResult> GetRestaurants()
        {
            return Ok(await _userService.GetAllRestaurantAsync());
        }

        [HttpGet("dishes")]
        public async Task<IActionResult> GetDishes()
        {
            return Ok(await _userService.GetAllDishesAsync());
        }

        [HttpGet("restaurants/{id}/menu")]
        public async Task<IActionResult> GetMenu(Guid id)
        {
            return Ok(await _userService.GetRestaurantMenuAsync(id));
        }

        [HttpPost("restaurants/{id}/rate")]
        [Authorize]
        public async Task<IActionResult> RateRestaurant(Guid id, [FromBody] RateRestaurantDto dto)
        {
            var userId = GetUserId();
            var success = await _userService.RateRestaurantAsync(userId, id, dto);
            if (success) return Ok(new { message = "Rating submitted successfully" });
            return BadRequest(new { message = "Failed to submit rating." });
        }

        [Authorize]
        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            var userId = GetUserId();
            var profile = await _userService.GetUserProfileAsync(userId);
            if (profile == null) return NotFound("Profile not found");
            return Ok(profile);
        }

        [Authorize]
        [HttpPut("profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateUserProfileDto dto)
        {
            var userId = GetUserId();
            var result = await _userService.UpdateUserProfileAsync(userId, dto);
            if (!result) return NotFound("Profile not found");
            return Ok(new { message = "Profile updated successfully" });
        }

        [Authorize]
        [HttpPost("addresses")]
        public async Task<IActionResult> AddAddress([FromBody] AddUserAddressDto dto)
        {
            var userId = GetUserId();
            var newAddress = await _userService.AddUserAddressAsync(userId, dto);
            return Ok(newAddress);
        }

        [Authorize]
        [HttpDelete("addresses/{id}")]
        public async Task<IActionResult> DeleteAddress(Guid id)
        {
            var userId = GetUserId();
            var result = await _userService.DeleteUserAddressAsync(userId, id);
            if (!result) return NotFound("Address not found");
            return Ok(new { message = "Address deleted successfully" });
        }

        [Authorize]
        [HttpPut("addresses/{id}")]
        public async Task<IActionResult> UpdateAddress(Guid id, [FromBody] AddUserAddressDto dto)
        {
            var userId = GetUserId();
            var updatedAddress = await _userService.UpdateUserAddressAsync(userId, id, dto);
            if (updatedAddress == null) return NotFound("Address not found");
            return Ok(updatedAddress);
        }

        [Authorize]
        [HttpPost("wallet/add-funds")]
        public async Task<IActionResult> AddFunds([FromBody] AddFundsDto dto)
        {
            var userId = GetUserId();
            var newBalance = await _userService.AddWalletFundsAsync(userId, dto.Amount);
            return Ok(new { message = $"Successfully added ₹{dto.Amount:F2} to wallet.", newBalance });
        }

        [Authorize]
        [HttpPost("wallet/create-razorpay-order")]
        public IActionResult CreateRazorpayOrder([FromBody] AddFundsDto dto)
        {
            var keyId = _config["Razorpay:KeyId"];
            var keySecret = _config["Razorpay:KeySecret"];

            Razorpay.Api.RazorpayClient client = new Razorpay.Api.RazorpayClient(keyId, keySecret);
            
            Dictionary<string, object> options = new Dictionary<string, object>();
            options.Add("amount", (int)(dto.Amount * 100)); // amount in the smallest currency unit
            options.Add("currency", "INR");
            options.Add("receipt", Guid.NewGuid().ToString());

            Razorpay.Api.Order order = client.Order.Create(options);

            return Ok(new { orderId = order["id"].ToString() });
        }

        [Authorize]
        [HttpPost("wallet/verify-payment")]
        public async Task<IActionResult> VerifyPayment([FromBody] VerifyPaymentDto dto)
        {
            var keySecret = _config["Razorpay:KeySecret"];
            
            var payload = dto.RazorpayOrderId + "|" + dto.RazorpayPaymentId;
            var expectedSignature = ComputeHmacSha256(payload, keySecret!);
            
            if (expectedSignature != dto.RazorpaySignature)
            {
                return BadRequest("Invalid signature");
            }
            
            var userId = GetUserId();
            var newBalance = await _userService.AddWalletFundsAsync(userId, dto.Amount);
            return Ok(new { message = $"Successfully added ₹{dto.Amount:F2} to wallet.", newBalance });
        }
        
        [Authorize]
        [HttpGet("wallet/details")]
        public async Task<IActionResult> GetWalletDetails()
        {
            var userId = GetUserId();
            var details = await _userService.GetWalletDetailsAsync(userId);
            return Ok(details);
        }

        private string ComputeHmacSha256(string payload, string secret)
        {
            using (var hmac = new System.Security.Cryptography.HMACSHA256(System.Text.Encoding.UTF8.GetBytes(secret)))
            {
                var hash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(payload));
                return BitConverter.ToString(hash).Replace("-", "").ToLower();
            }
        }

        private Guid GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            return claim != null ? Guid.Parse(claim.Value) : Guid.Empty;
        }
    }
}
