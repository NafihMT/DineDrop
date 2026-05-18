using DineDrop.Application.Modules.Restaurants.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Application.Modules.Restaurants.Interfaces
{
    public interface IRestaurantAnalyticsService
    {
        Task<EarningsDto> GetEarningsAsync(Guid userId);
        Task<List<PopularItemDto>> GetPopularItemAsync(Guid userId);
        Task<RestaurantAnalyticsSummaryDto> GetSummaryAsync(Guid userId);
    }
}
