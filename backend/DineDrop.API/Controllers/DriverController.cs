using DineDrop.Application.Modules.Drivers.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Security.Claims;
using System.Threading.Tasks;

namespace DineDrop.API.Controllers
{
    [ApiController]
    [Route("api/driver")]
    [Authorize(Roles = "Driver")]
    public class DriverController : ControllerBase
    {
        private readonly IDriverService _driverService;

        public DriverController(IDriverService driverService)
        {
            _driverService = driverService;
        }

        /// <summary>
        /// GET /api/driver/available-orders
        /// Returns all Ready orders grouped by restaurant.
        /// </summary>
        [HttpGet("available-orders")]
        public async Task<IActionResult> GetAvailableOrders()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim == null || !Guid.TryParse(claim.Value, out var userId))
                return Unauthorized();

            var result = await _driverService.GetAvailableOrdersAsync(userId);
            return Ok(result);
        }

        /// <summary>
        /// GET /api/driver/availability
        /// Returns driver's availability status.
        /// </summary>
        [HttpGet("availability")]
        public async Task<IActionResult> GetAvailability()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim == null || !Guid.TryParse(claim.Value, out var userId))
                return Unauthorized();

            var isAvailable = await _driverService.GetAvailabilityAsync(userId);
            return Ok(new { isAvailable });
        }

        /// <summary>
        /// POST /api/driver/toggle-availability
        /// Toggles driver's availability status.
        /// </summary>
        [HttpPost("toggle-availability")]
        public async Task<IActionResult> ToggleAvailability()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim == null || !Guid.TryParse(claim.Value, out var userId))
                return Unauthorized();

            var isAvailable = await _driverService.ToggleAvailabilityAsync(userId);
            return Ok(new { isAvailable });
        }

        /// <summary>
        /// POST /api/driver/accept-order/{orderId}
        /// Assigns order to driver.
        /// </summary>
        [HttpPost("accept-order/{orderId}")]
        public async Task<IActionResult> AcceptOrder(Guid orderId)
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim == null || !Guid.TryParse(claim.Value, out var userId))
                return Unauthorized();

            try
            {
                var success = await _driverService.AcceptOrderAsync(orderId, userId);
                if (!success)
                    return BadRequest("Order could not be accepted. It might already be taken.");

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

       
  
        [HttpPost("pickup-order/{orderId}")]
        public async Task<IActionResult> PickupOrder(Guid orderId)
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim == null || !Guid.TryParse(claim.Value, out var userId))
                return Unauthorized();

            var success = await _driverService.PickupOrderAsync(orderId, userId);
            if (!success)
                return BadRequest("Order could not be picked up. It might not be ready or not assigned to you.");

            return Ok(new { success = true });
        }

        /// <summary>
        /// GET /api/driver/active-orders
        /// Returns active/assigned orders for the current driver.
        /// </summary>
        [HttpGet("active-orders")]
        public async Task<IActionResult> GetActiveOrders()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim == null || !Guid.TryParse(claim.Value, out var userId))
                return Unauthorized();

            var activeOrders = await _driverService.GetActiveOrdersAsync(userId);
            return Ok(activeOrders);
        }

        /// <summary>
        /// POST /api/driver/deliver-order/{orderId}
        /// Marks an order as delivered.
        /// </summary>
        [HttpPost("deliver-order/{orderId}")]
        public async Task<IActionResult> CompleteDelivery(Guid orderId, [FromQuery] string otp)
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim == null || !Guid.TryParse(claim.Value, out var userId))
                return Unauthorized();

            try
            {
                var success = await _driverService.CompleteDeliveryAsync(orderId, userId, otp);
                if (!success)
                    return BadRequest("Could not complete delivery. The order might not be active, or not assigned to you.");

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// POST /api/driver/generate-otp/{orderId}
        /// Generates a new 4-digit delivery hand-off OTP.
        /// </summary>
        [HttpPost("generate-otp/{orderId}")]
        public async Task<IActionResult> GenerateOtp(Guid orderId)
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim == null || !Guid.TryParse(claim.Value, out var userId))
                return Unauthorized();

            try
            {
                var success = await _driverService.GenerateDeliveryOtpAsync(orderId, userId);
                if (!success)
                    return BadRequest("Failed to generate OTP. Make sure the order is assigned to you and has been picked up.");

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// GET /api/driver/stats
        /// Gets delivery stats, wallet balance, and completed delivery history for the driver.
        /// </summary>
        [HttpGet("stats")]
        public async Task<IActionResult> GetDriverStats()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim == null || !Guid.TryParse(claim.Value, out var userId))
                return Unauthorized();

            var stats = await _driverService.GetDriverStatsAsync(userId);
            return Ok(stats);
        }

        /// <summary>
        /// POST /api/driver/update-location
        /// Updates the driver's live coordinate position in Redis and broadcasts it.
        /// </summary>
        [HttpPost("update-location")]
        public async Task<IActionResult> UpdateLocation([FromBody] DriverLocationUpdateDto dto)
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim == null || !Guid.TryParse(claim.Value, out var userId))
                return Unauthorized();

            var success = await _driverService.UpdateLocationAsync(userId, dto.Latitude, dto.Longitude);
            if (!success)
                return BadRequest("Could not update location. Driver profile not found.");

            return Ok(new { success = true });
        }
    }

    public class DriverLocationUpdateDto
    {
        public double Latitude { get; set; }
        public double Longitude { get; set; }
    }
}
