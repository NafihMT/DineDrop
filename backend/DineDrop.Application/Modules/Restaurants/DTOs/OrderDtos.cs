using System;
using System.Collections.Generic;
using DineDrop.Domain.Enums;

namespace DineDrop.Application.Modules.Restaurants.DTOs
{
    public class RestaurantOrderDto
    {
        public Guid Id { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public decimal DeliveryFee { get; set; }
        public decimal DiscountAmount { get; set; }
        public string? CouponCode { get; set; }
        public OrderStatus Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public int? RestaurantRating { get; set; }
        public string? RestaurantFeedback { get; set; }
        public List<RestaurantOrderItemDto> Items { get; set; } = new();
    }

    public class RestaurantOrderItemDto
    {
        public string DishName { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
    }

    public class UpdateOrderStatusDto
    {
        public Guid OrderId { get; set; }
        public OrderStatus NewStatus { get; set; }
    }

    public class RestaurantDashboardStatsDto
    {
        public decimal TodayRevenue { get; set; }
        public decimal TotalRevenue { get; set; }
        public int ActiveOrdersCount { get; set; }
        public int TotalOrdersCount { get; set; }
        public decimal AverageOrderValue { get; set; }
        public List<RevenuePointDto> RevenueChart { get; set; } = new();
    }

    public class RevenuePointDto
    {
        public string Date { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }
}
