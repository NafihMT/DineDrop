using DineDrop.Application.Modules.Admin.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace DineDrop.Application.Modules.Admin.Interfaces
{
    public interface IAdminService
    {
        Task<IEnumerable<RestaurantRequestDto>> GetPendingRestaurantsAsync();
        Task ApproveRestaurantAsync(Guid userId, bool isApproved);
        Task<AdminStatsDto> GetStatsAsync();
        Task<IEnumerable<AdminRestaurantDto>> GetAllRestaurantsAsync();
        Task<IEnumerable<AdminUserDto>> GetAllUsersAsync();
        Task ToggleUserBlockStatusAsync(Guid userId);
        Task<IEnumerable<AdminOrderDto>> GetAllOrdersAsync();
    }
}
