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
        public UserController(IUserService userService)
        {
            _userService = userService;
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
            return Ok(new { message = $"Successfully added ${dto.Amount:F2} to wallet.", newBalance });
        }

        private Guid GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            return claim != null ? Guid.Parse(claim.Value) : Guid.Empty;
        }
    }
}
