using DineDrop.Application.Modules.Admin.DTOs;
using DineDrop.Application.Modules.Admin.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace DineDrop.API.Controllers
{
    [ApiController]
    [Route("api/admin")]
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private readonly IAdminService _adminService;
        private readonly DineDrop.Application.Modules.Users.Interfaces.IUserService _userService;

        public AdminController(IAdminService adminService, DineDrop.Application.Modules.Users.Interfaces.IUserService userService)
        {
            _adminService = adminService;
            _userService = userService;
        }

        [HttpGet("pending-restaurants")]
        public async Task<IActionResult> GetPendingRestaurants()
        {
            var requests = await _adminService.GetPendingRestaurantsAsync();
            return Ok(requests);
        }

        [HttpPost("approve-restaurant")]
        public async Task<IActionResult> ApproveRestaurant(ApprovalDto dto)
        {
            await _adminService.ApproveRestaurantAsync(dto.UserId, dto.IsApproved);
            var message = dto.IsApproved ? "Restaurant approved successfully." : "Restaurant request rejected.";
            return Ok(new { message });
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var stats = await _adminService.GetStatsAsync();
            return Ok(stats);
        }

        [HttpGet("restaurants")]
        public async Task<IActionResult> GetAllRestaurants()
        {
            var res = await _adminService.GetAllRestaurantsAsync();
            return Ok(res);
        }

        [HttpGet("users")]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _adminService.GetAllUsersAsync();
            return Ok(users);
        }

        [HttpPost("users/{userId}/toggle-block")]
        public async Task<IActionResult> ToggleUserBlock(Guid userId)
        {
            await _adminService.ToggleUserBlockStatusAsync(userId);
            return Ok(new { message = "User status updated successfully" });
        }

        [HttpGet("orders")]
        public async Task<IActionResult> GetAllOrders()
        {
            var orders = await _adminService.GetAllOrdersAsync();
            return Ok(orders);
        }

        [HttpGet("drivers")]
        public async Task<IActionResult> GetAllDrivers()
        {
            var drivers = await _adminService.GetAllDriversAsync();
            return Ok(drivers);
        }

        [HttpPost("approve-driver")]
        public async Task<IActionResult> ApproveDriver(ApprovalDto dto)
        {
            await _adminService.ApproveDriverAsync(dto.UserId, dto.IsApproved);
            var message = dto.IsApproved ? "Driver approved successfully." : "Driver application rejected.";
            return Ok(new { message });
        }

        [HttpPost("drivers/{userId}/toggle-block")]
        public async Task<IActionResult> ToggleDriverBlock(Guid userId)
        {
            await _adminService.ToggleDriverBlockAsync(userId);
            return Ok(new { message = "Driver status updated." });
        }

        [HttpGet("wallet/details")]
        public async Task<IActionResult> GetAdminWalletDetails()
        {
            // Admin wallet is tied to the main Admin User Id
            var adminId = Guid.Parse("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b");
            var details = await _userService.GetWalletDetailsAsync(adminId);
            return Ok(details);
        }
    }
}
