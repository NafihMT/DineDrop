using DineDrop.Application.Modules.Restaurants.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace DineDrop.Application.Modules.Restaurants.Interfaces
{
    public interface IRestaurantOrderService
    {
        Task<List<RestaurantOrderDto>> GetActiveOrdersAsync(Guid userId);
        Task<List<RestaurantOrderDto>> GetOrderHistoryAsync(Guid userId);
        Task<bool> UpdateOrderStatusAsync(Guid userId, UpdateOrderStatusDto dto);
        Task<RestaurantDashboardStatsDto> GetDashboardStatsAsync(Guid userId);
    }
}
