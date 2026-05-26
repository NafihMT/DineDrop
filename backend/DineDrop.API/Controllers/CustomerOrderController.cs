using DineDrop.Application.Modules.Users.DTOs;
using DineDrop.Application.Modules.Users.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using DineDrop.Infrastructure.Hubs;
using System;
using System.Security.Claims;
using System.Threading.Tasks;

namespace DineDrop.API.Controllers
{
    [ApiController]
    [Route("api/customer/orders")]
    [Authorize] 
    public class CustomerOrderController : ControllerBase
    {
        private readonly ICustomerOrderService _orderService;

        public CustomerOrderController(ICustomerOrderService orderService)
        {
            _orderService = orderService;
        }

        [HttpPost("place")]
        public async Task<IActionResult> PlaceOrder([FromBody] PlaceOrderDto dto)
        {
            try
            {
                var userId = GetUserId();
                var orderId = await _orderService.PlaceOrderAsync(userId, dto);
                return Ok(new { message = "Order placed successfully", orderId });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("my-orders")]
        public async Task<IActionResult> GetMyOrders()
        {
            var userId = GetUserId();
            var orders = await _orderService.GetMyOrdersAsync(userId);
            return Ok(orders);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetOrderDetails(Guid id)
        {
            var userId = GetUserId();
            var order = await _orderService.GetOrderDetailsAsync(userId, id);
            if (order == null) return NotFound();
            return Ok(order);
        }

        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> CancelOrder(Guid id)
        {
            try
            {
                var userId = GetUserId();
                var result = await _orderService.CancelOrderAsync(userId, id);
                if (result) return Ok(new { message = "Order cancelled successfully" });
                return NotFound();
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("{id}/rate")]
        public async Task<IActionResult> RateOrder(Guid id, [FromBody] RateOrderDto dto)
        {
            try
            {
                var userId = GetUserId();
                var result = await _orderService.RateOrderAsync(userId, id, dto);
                if (result) return Ok(new { message = "Rating submitted successfully" });
                return BadRequest(new { message = "Unable to submit rating for this order status." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("rescue-deals")]
        public async Task<IActionResult> GetRescueDeals()
        {
            try
            {
                var userId = GetUserId();
                var deals = await _orderService.GetActiveRescueDealsAsync(userId);
                return Ok(deals);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("buy-rescue-deal")]
        public async Task<IActionResult> BuyRescueDeal([FromBody] BuyRescueDealRequestDto dto)
        {
            try
            {
                var userId = GetUserId();
                var orderId = await _orderService.BuyRescueDealAsync(userId, dto.OrderId, dto.AddressId);
                return Ok(new { message = "Flash Rescue order placed successfully", orderId });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        public class BuyRescueDealRequestDto
        {
            public Guid OrderId { get; set; }
            public Guid AddressId { get; set; }
        }

        private Guid GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            return claim != null ? Guid.Parse(claim.Value) : Guid.Empty;
        }
    }
}
