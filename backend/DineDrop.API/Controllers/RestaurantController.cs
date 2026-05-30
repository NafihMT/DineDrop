using DineDrop.Application.Modules.Restaurants.DTOs;
using DineDrop.Application.Modules.Restaurants.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;

namespace DineDrop.API.Controllers
{
    [ApiController]
    [Route("api/restaurant")]
    [Authorize(Roles = "Restaurant")]
    public class RestaurantController : ControllerBase
    {
        private readonly IMenuService _menuService;
        private readonly IRestaurantService _restaurantService;
        private readonly IWebHostEnvironment _env;

        public RestaurantController(IMenuService menuService, IRestaurantService restaurantService, IWebHostEnvironment env)
        {
            _menuService = menuService;
            _restaurantService = restaurantService;
            _env = env;
        }

        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            var profile = await _restaurantService.GetProfileAsync(GetUserId());
            return Ok(profile);
        }

        [HttpPut("profile")]
        public async Task<IActionResult> UpdateProfile(RestaurantProfileDto dto)
        {
            var profile = await _restaurantService.UpdateProfileAsync(GetUserId(), dto);
            return Ok(profile);
        }

        [HttpPost("menu-items/{id}/upload-image")]
        public async Task<IActionResult> UploadImage(Guid id, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            // Validate file content type and extension
            var allowedContentTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml" };
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg" };
            
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (string.IsNullOrEmpty(file.ContentType) || !allowedContentTypes.Contains(file.ContentType.ToLowerInvariant()) || !allowedExtensions.Contains(ext))
            {
                return BadRequest("Only image files (.jpg, .jpeg, .png, .gif, .webp, .svg) are allowed.");
            }

            var userId = GetUserId();
            var items = await _menuService.GetMenuItemsAsync(userId);
            var item = items.FirstOrDefault(i => i.Id == id);
            
            if (item == null)
                return NotFound("Menu item not found.");

            var uploads = Path.Combine(_env.WebRootPath, "uploads", "dishes");
            if (!Directory.Exists(uploads))
                Directory.CreateDirectory(uploads);

            var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var filePath = Path.Combine(uploads, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            item.ImageUrl = $"/uploads/dishes/{fileName}";
            await _menuService.UpdateMenuItemAsync(userId, item);

            return Ok(new { imageUrl = item.ImageUrl });
        }

        [HttpPost("profile/upload-image")]
        public async Task<IActionResult> UploadProfileImage(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            var allowedContentTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml" };
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg" };
            
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (string.IsNullOrEmpty(file.ContentType) || !allowedContentTypes.Contains(file.ContentType.ToLowerInvariant()) || !allowedExtensions.Contains(ext))
            {
                return BadRequest("Only image files (.jpg, .jpeg, .png, .gif, .webp, .svg) are allowed.");
            }

            var userId = GetUserId();
            var profile = await _restaurantService.GetProfileAsync(userId);

            var uploads = Path.Combine(_env.WebRootPath, "uploads", "restaurants");
            if (!Directory.Exists(uploads))
                Directory.CreateDirectory(uploads);

            var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var filePath = Path.Combine(uploads, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            profile.ImageUrl = $"/uploads/restaurants/{fileName}";
            await _restaurantService.UpdateProfileAsync(userId, profile);

            return Ok(new { imageUrl = profile.ImageUrl });
        }


        private Guid GetUserId()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdClaim))
                throw new UnauthorizedAccessException("User not found in token.");
            
            return Guid.Parse(userIdClaim);
        }

        [HttpGet("categories")]
        public async Task<IActionResult> GetCategories()
        {
            var categories = await _menuService.GetCategoriesAsync(GetUserId());
            return Ok(categories);
        }

        [HttpPost("categories")]
        public async Task<IActionResult> AddCategory(MenuCategoryDto dto)
        {
            var category = await _menuService.AddCategoryAsync(GetUserId(), dto);
            return Ok(category);
        }

        [HttpPut("categories")]
        public async Task<IActionResult> UpdateCategory(MenuCategoryDto dto)
        {
            var category = await _menuService.UpdateCategoryAsync(GetUserId(), dto);
            return Ok(category);
        }

        [HttpDelete("categories/{id}")]
        public async Task<IActionResult> DeleteCategory(Guid id)
        {
            await _menuService.DeleteCategoryAsync(GetUserId(), id);
            return Ok("Category deleted");
        }

        [HttpGet("menu-items")]
        public async Task<IActionResult> GetMenuItems([FromQuery] Guid? categoryId)
        {
            var items = await _menuService.GetMenuItemsAsync(GetUserId(), categoryId);
            return Ok(items);
        }

        [HttpPost("menu-items")]
        public async Task<IActionResult> AddMenuItem(MenuItemDto dto)
        {
            var item = await _menuService.AddMenuItemAsync(GetUserId(), dto);
            return Ok(item);
        }

        [HttpPut("menu-items")]
        public async Task<IActionResult> UpdateMenuItem(MenuItemDto dto)
        {
            var item = await _menuService.UpdateMenuItemAsync(GetUserId(), dto);
            return Ok(item);
        }

        [HttpDelete("menu-items/{id}")]
        public async Task<IActionResult> DeleteMenuItem(Guid id)
        {
            await _menuService.DeleteMenuItemAsync(GetUserId(), id);
            return Ok("Menu item deleted");
        }
    }
}
