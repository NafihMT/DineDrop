using DineDrop.Application.Modules.Restaurants.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using DineDrop.Application.Modules.Users.DTOs;

namespace DineDrop.Application.Modules.Users.Interfaces
{
    public interface IUserService
    {
        Task<IEnumerable<RestaurantProfileDto>> GetAllRestaurantAsync();
        Task<IEnumerable<MenuItemDto>> GetAllDishesAsync();
        Task<IEnumerable<MenuItemDto>> GetRestaurantMenuAsync(Guid restaurantId);

        Task<UserProfileDto?> GetUserProfileAsync(Guid userId);
        Task<bool> UpdateUserProfileAsync(Guid userId, UpdateUserProfileDto dto);
        Task<UserAddressDto> AddUserAddressAsync(Guid userId, AddUserAddressDto dto);
        Task<UserAddressDto?> UpdateUserAddressAsync(Guid userId, Guid addressId, AddUserAddressDto dto);
        Task<bool> DeleteUserAddressAsync(Guid userId, Guid addressId);
        Task<decimal> AddWalletFundsAsync(Guid userId, decimal amount);
        Task<WalletDetailsDto> GetWalletDetailsAsync(Guid userId);
        Task<bool> RateRestaurantAsync(Guid userId, Guid restaurantId, RateRestaurantDto dto);
    }
}
