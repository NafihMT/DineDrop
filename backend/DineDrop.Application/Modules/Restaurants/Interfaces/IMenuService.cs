using DineDrop.Application.Modules.Restaurants.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace DineDrop.Application.Modules.Restaurants.Interfaces
{
    public interface IMenuService
    {
        Task<MenuItemDto> AddMenuItemAsync(Guid userId, MenuItemDto dto);
        Task<MenuItemDto> UpdateMenuItemAsync(Guid userId, MenuItemDto dto);
        Task DeleteMenuItemAsync(Guid userId, Guid menuItemId);

        Task<MenuCategoryDto> AddCategoryAsync(Guid userId, MenuCategoryDto dto);
        Task<MenuCategoryDto> UpdateCategoryAsync(Guid userId, MenuCategoryDto dto);
        Task DeleteCategoryAsync(Guid userId, Guid categoryId);

        Task<IEnumerable<MenuCategoryDto>> GetCategoriesAsync(Guid userId);
        Task<IEnumerable<MenuItemDto>> GetMenuItemsAsync(Guid userId, Guid? categoryId = null);
    }
}
