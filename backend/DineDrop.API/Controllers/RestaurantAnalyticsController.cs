using DineDrop.Application.Modules.Restaurants.Interfaces;
using DineDrop.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace DineDrop.API.Controllers
{
    [Route("api/restaurant/analytics")]
    [ApiController]
    [Authorize(Roles = "Restaurant")]

    public class RestaurantAnalyticsController : ControllerBase
    {
        private readonly IRestaurantAnalyticsService _analyticsService;
        public RestaurantAnalyticsController(IRestaurantAnalyticsService analyticsService)
        {
            _analyticsService = analyticsService;
        }
        [HttpGet("earnings")]
        public async Task<IActionResult> GetEarnings()
        {
            var userId = GetUserId();
            return Ok(await _analyticsService.GetEarningsAsync(userId));
        }

        [HttpGet("popular-item")]
        public async Task<IActionResult> GetPopularItems()
        {
            var userId = GetUserId();
            return Ok(await _analyticsService.GetPopularItemAsync(userId));
        }

        [HttpGet("summary")]
        public async Task<IActionResult> GetSummaryAsync()
        {
            var userId = GetUserId();
            return Ok(await _analyticsService.GetSummaryAsync(userId));
        }

        // Helper Functions
        private Guid GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            return claim != null ? Guid.Parse(claim.Value) : Guid.Empty;
        }
    }
}
