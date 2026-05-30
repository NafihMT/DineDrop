using DineDrop.Application.Modules.Restaurants.DTOs;
using DineDrop.Application.Modules.Restaurants.Interfaces;
using DineDrop.Infrastructure.Hubs;
using DineDrop.Infrastructure.Data;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;

namespace DineDrop.Infrastructure.Services
{
    public class RestaurantService : IRestaurantService
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<OrderHub> _hubContext;

        public RestaurantService(AppDbContext context, IHubContext<OrderHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        public async Task<RestaurantProfileDto> GetProfileAsync(Guid userId)
        {
            var restaurant = await _context.Restaurants
                .FirstOrDefaultAsync(r => r.OwnerId == userId);

            var profile = await _context.RestaurantProfiles
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (restaurant == null || profile == null)
                throw new Exception("Restaurant profile not found");

            return new RestaurantProfileDto
            {
                Id = restaurant.Id,
                Name = restaurant.Name,
                Description = restaurant.Description,
                IsOpen = restaurant.IsOpen,
                Address = profile.Address,
                BusinessType = profile.BusinessType,
                BusinessHours = profile.BusinessHours,
                Latitude = restaurant.Latitude,
                Longitude = restaurant.Longitude,
                ImageUrl = restaurant.ImageUrl
            };
        }

        public async Task<RestaurantProfileDto> UpdateProfileAsync(Guid userId, RestaurantProfileDto dto)
        {
            var restaurant = await _context.Restaurants
                .FirstOrDefaultAsync(r => r.OwnerId == userId);

            var profile = await _context.RestaurantProfiles
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (restaurant == null || profile == null)
                throw new Exception("Restaurant profile not found");

            // Update Restaurant Entity
            restaurant.Name = dto.Name;
            restaurant.Description = dto.Description;
            restaurant.IsOpen = dto.IsOpen;
            restaurant.Latitude = dto.Latitude;
            restaurant.Longitude = dto.Longitude;
            restaurant.ImageUrl = dto.ImageUrl;

            // Update RestaurantProfile Entity
            profile.Address = dto.Address;
            profile.BusinessType = dto.BusinessType;
            profile.BusinessHours = dto.BusinessHours;

            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("RestaurantProfileUpdated", new { restaurantId = restaurant.Id });

            return dto;
        }
    }
}
