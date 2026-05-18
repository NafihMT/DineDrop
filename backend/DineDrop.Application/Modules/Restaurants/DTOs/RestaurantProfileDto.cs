using System;

namespace DineDrop.Application.Modules.Restaurants.DTOs
{
    public class RestaurantProfileDto
    {
        public Guid Id { get; set; }
        // From Restaurant Entity
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public bool IsOpen { get; set; }
        public double Rating { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        
        // From RestaurantProfile Entity
        public string Address { get; set; } = string.Empty;
        public string BusinessType { get; set; } = string.Empty;
        public string BusinessHours { get; set; } = string.Empty;
    }
}
