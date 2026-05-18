using DineDrop.Application.Modules.Restaurants.DTOs;


namespace DineDrop.Application.Modules.Restaurants.Interfaces
{
    public interface IRestaurantService
    {
        Task<RestaurantProfileDto> GetProfileAsync(Guid userId);
        Task<RestaurantProfileDto> UpdateProfileAsync(Guid userId, RestaurantProfileDto dto);
    }
}
