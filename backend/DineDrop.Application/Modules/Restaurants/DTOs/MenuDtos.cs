using System;

namespace DineDrop.Application.Modules.Restaurants.DTOs
{
    public class MenuItemDto
    {
        public Guid? Id { get; set; }
        public Guid? CategoryId { get; set; }
        public string? CategoryName { get; set; }
        public string Name { get; set; } = default!;
        public string Description { get; set; } = default!;
        public decimal Price { get; set; }
        public string? ImageUrl { get; set; }
        public bool IsAvailable { get; set; } = true;
        public bool IsVeg { get; set; } = true;
        
        // Context for Explore view
        public Guid? RestaurantId { get; set; }
        public string? RestaurantName { get; set; }
        public double? RestaurantLatitude { get; set; }
        public double? RestaurantLongitude { get; set; }
        public bool? RestaurantIsOpen { get; set; }
    }

    public class MenuCategoryDto
    {
        public Guid? Id { get; set; }
        public string Name { get; set; } = default!;
    }
}
