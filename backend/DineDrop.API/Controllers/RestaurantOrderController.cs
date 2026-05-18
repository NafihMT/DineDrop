using DineDrop.Application.Modules.Restaurants.DTOs;
using DineDrop.Application.Modules.Restaurants.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Security.Claims;
using System.Threading.Tasks;

namespace DineDrop.API.Controllers
{
    [ApiController]
    [Route("api/restaurant/orders")]
    [Authorize(Roles = "Restaurant")]
    public class RestaurantOrderController : ControllerBase
    {
        private readonly IRestaurantOrderService _orderService;

        public RestaurantOrderController(IRestaurantOrderService orderService)
        {
            _orderService = orderService;
        }

        [HttpGet("active")]
        public async Task<IActionResult> GetActiveOrders()
        {
            var userId = GetUserId();
            var orders = await _orderService.GetActiveOrdersAsync(userId);
            return Ok(orders);
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetOrderHistory()
        {
            var userId = GetUserId();
            var history = await _orderService.GetOrderHistoryAsync(userId);
            return Ok(history);
        }

        [HttpPut("status")]
        public async Task<IActionResult> UpdateStatus([FromBody] UpdateOrderStatusDto dto)
        {
            var userId = GetUserId();
            var result = await _orderService.UpdateOrderStatusAsync(userId, dto);

            if (result)
                return Ok(new { message = $"Order status updated to {dto.NewStatus}" });

            return NotFound(new { message = "Order not found or access denied" });
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetDashboardStats()
        {
            var userId = GetUserId();
            var stats = await _orderService.GetDashboardStatsAsync(userId);
            return Ok(stats);
        }

        private Guid GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            return claim != null ? Guid.Parse(claim.Value) : Guid.Empty;
        }
    }
}
