using DineDrop.Application.Modules.Restaurants.DTOs;
using DineDrop.Application.Modules.Restaurants.Interfaces;
using DineDrop.Domain.Entities;
using DineDrop.Domain.Enums;
using DineDrop.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DineDrop.Infrastructure.Services
{
    public class MenuService : IMenuService
    {
        private readonly AppDbContext _context;

        public MenuService(AppDbContext context)
        {
            _context = context;
        }

        private async Task<Guid> GetRestaurantIdByUserId(Guid userId)
        {
            var restaurant = await _context.Restaurants
                .Include(r => r.Owner)
                .FirstOrDefaultAsync(r => r.OwnerId == userId);
            
            if (restaurant == null)
                throw new Exception("Restaurant not found for this user.");

            /* 
            if (restaurant.Owner.ApprovalStatus != ApprovalStatus.Approved)
                throw new Exception("Your restaurant account is not approved yet.");
            */
            
            return restaurant.Id;
        }

        public async Task<MenuCategoryDto> AddCategoryAsync(Guid userId, MenuCategoryDto dto)
        {
            var restaurantId = await GetRestaurantIdByUserId(userId);

            var category = new MenuCategory
            {
                RestaurantId = restaurantId,
                Name = dto.Name
            };

            _context.MenuCategories.Add(category);
            await _context.SaveChangesAsync();

            return new MenuCategoryDto { Id = category.Id, Name = category.Name };
        }

        public async Task<MenuItemDto> AddMenuItemAsync(Guid userId, MenuItemDto dto)
        {
            var restaurantId = await GetRestaurantIdByUserId(userId);
            Guid finalCategoryId;

            if (dto.CategoryId.HasValue)
            {
                var category = await _context.MenuCategories
                    .FirstOrDefaultAsync(c => c.Id == dto.CategoryId && c.RestaurantId == restaurantId);

                if (category == null)
                    throw new Exception("Invalid category.");
                
                finalCategoryId = category.Id;
            }
            else if (!string.IsNullOrWhiteSpace(dto.CategoryName))
            {
                var category = await _context.MenuCategories
                    .FirstOrDefaultAsync(c => c.Name.ToLower() == dto.CategoryName.ToLower() && c.RestaurantId == restaurantId);

                if (category == null)
                {
                    category = new MenuCategory
                    {
                        RestaurantId = restaurantId,
                        Name = dto.CategoryName
                    };
                    _context.MenuCategories.Add(category);
                    await _context.SaveChangesAsync();
                }
                finalCategoryId = category.Id;
            }
            else
            {
                throw new Exception("Either CategoryId or CategoryName must be provided.");
            }

            var item = new MenuItem
            {
                RestaurantId = restaurantId,
                CategoryId = finalCategoryId,
                Name = dto.Name,
                Description = dto.Description,
                Price = dto.Price,
                ImageUrl = dto.ImageUrl,
                IsAvailable = dto.IsAvailable
            };

            _context.MenuItems.Add(item);
            await _context.SaveChangesAsync();

            var categoryName = await _context.MenuCategories
                .Where(c => c.Id == finalCategoryId)
                .Select(c => c.Name)
                .FirstOrDefaultAsync();

            return new MenuItemDto
            {
                Id = item.Id,
                CategoryId = item.CategoryId,
                CategoryName = categoryName,
                Name = item.Name,
                Description = item.Description,
                Price = item.Price,
                ImageUrl = item.ImageUrl,
                IsAvailable = item.IsAvailable
            };
        }

        public async Task DeleteCategoryAsync(Guid userId, Guid categoryId)
        {
            var restaurantId = await GetRestaurantIdByUserId(userId);
            var category = await _context.MenuCategories
                .FirstOrDefaultAsync(c => c.Id == categoryId && c.RestaurantId == restaurantId);

            if (category == null) throw new Exception("Category not found.");

            _context.MenuCategories.Remove(category);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteMenuItemAsync(Guid userId, Guid menuItemId)
        {
            var restaurantId = await GetRestaurantIdByUserId(userId);
            var item = await _context.MenuItems
                .FirstOrDefaultAsync(m => m.Id == menuItemId && m.RestaurantId == restaurantId);

            if (item == null) throw new Exception("Menu item not found.");

            item.IsDeleted = true;
            await _context.SaveChangesAsync();
        }

        public async Task<IEnumerable<MenuCategoryDto>> GetCategoriesAsync(Guid userId)
        {
            var restaurantId = await GetRestaurantIdByUserId(userId);
            return await _context.MenuCategories
                .Where(c => c.RestaurantId == restaurantId)
                .Select(c => new MenuCategoryDto { Id = c.Id, Name = c.Name })
                .ToListAsync();
        }

        public async Task<IEnumerable<MenuItemDto>> GetMenuItemsAsync(Guid userId, Guid? categoryId = null)
        {
            var restaurantId = await GetRestaurantIdByUserId(userId);
            var query = _context.MenuItems.Where(m => m.RestaurantId == restaurantId && !m.IsDeleted);

            if (categoryId.HasValue)
                query = query.Where(m => m.CategoryId == categoryId.Value);

            return await query
                .Include(m => m.Category)
                .Select(m => new MenuItemDto
                {
                    Id = m.Id,
                    CategoryId = m.CategoryId,
                    CategoryName = m.Category.Name,
                    Name = m.Name,
                    Description = m.Description,
                    Price = m.Price,
                    ImageUrl = m.ImageUrl,
                    IsAvailable = m.IsAvailable
                }).ToListAsync();
        }

        public async Task<MenuCategoryDto> UpdateCategoryAsync(Guid userId, MenuCategoryDto dto)
        {
            var restaurantId = await GetRestaurantIdByUserId(userId);
            var category = await _context.MenuCategories
                .FirstOrDefaultAsync(c => c.Id == dto.Id && c.RestaurantId == restaurantId);

            if (category == null) throw new Exception("Category not found.");

            category.Name = dto.Name;
            await _context.SaveChangesAsync();

            return new MenuCategoryDto { Id = category.Id, Name = category.Name };
        }

        public async Task<MenuItemDto> UpdateMenuItemAsync(Guid userId, MenuItemDto dto)
        {
            var restaurantId = await GetRestaurantIdByUserId(userId);
            var item = await _context.MenuItems
                .FirstOrDefaultAsync(m => m.Id == dto.Id && m.RestaurantId == restaurantId);

            if (item == null) throw new Exception("Menu item not found.");

            if (dto.CategoryId.HasValue && item.CategoryId != dto.CategoryId.Value)
            {
                var category = await _context.MenuCategories
                    .AnyAsync(c => c.Id == dto.CategoryId.Value && c.RestaurantId == restaurantId);
                if (!category) throw new Exception("Invalid category.");
                item.CategoryId = dto.CategoryId.Value;
            }

            item.Name = dto.Name;
            item.Description = dto.Description;
            item.Price = dto.Price;
            item.ImageUrl = dto.ImageUrl;
            item.IsAvailable = dto.IsAvailable;

            await _context.SaveChangesAsync();

            var categoryName = await _context.MenuCategories
                .Where(c => c.Id == item.CategoryId)
                .Select(c => c.Name)
                .FirstOrDefaultAsync();

            return new MenuItemDto
            {
                Id = item.Id,
                CategoryId = item.CategoryId,
                CategoryName = categoryName,
                Name = item.Name,
                Description = item.Description,
                Price = item.Price,
                ImageUrl = item.ImageUrl,
                IsAvailable = item.IsAvailable
            };
        }
    }
}
