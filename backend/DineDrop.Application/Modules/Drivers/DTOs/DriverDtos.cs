using System;
using System.Collections.Generic;
using DineDrop.Domain.Enums;

namespace DineDrop.Application.Modules.Drivers.DTOs
{
    public class AvailableOrderItemDto
    {
        public string DishName { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
    }

    public class AvailableOrderDto
    {
        public Guid Id { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public decimal DeliveryFee { get; set; }
        public OrderStatus Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<AvailableOrderItemDto> Items { get; set; } = new();
    }

    public class AvailableOrdersByRestaurantDto
    {
        public Guid RestaurantId { get; set; }
        public string RestaurantName { get; set; } = string.Empty;
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public string Address { get; set; } = string.Empty;
        public List<AvailableOrderDto> Orders { get; set; } = new();
    }

    public class ActiveOrderDto
    {
        public Guid Id { get; set; }
        public string RestaurantName { get; set; } = string.Empty;
        public string RestaurantAddress { get; set; } = string.Empty;
        public double RestaurantLatitude { get; set; }
        public double RestaurantLongitude { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string CustomerAddress { get; set; } = string.Empty;
        public double CustomerLatitude { get; set; }
        public double CustomerLongitude { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal DeliveryFee { get; set; }
        public OrderStatus Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<AvailableOrderItemDto> Items { get; set; } = new();
    }

    public class DriverStatsDto
    {
        public decimal WalletBalance { get; set; }
        public decimal TotalEarnings { get; set; }
        public int TotalDeliveries { get; set; }
        public double Rating { get; set; }
        public List<DeliveryHistoryDto> DeliveryHistory { get; set; } = new();
    }

    public class DeliveryHistoryDto
    {
        public Guid OrderId { get; set; }
        public string RestaurantName { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public decimal Earnings { get; set; }
        public DateTime DeliveredAt { get; set; }
        public int? DriverRating { get; set; }
        public string? DriverFeedback { get; set; }
    }
}
