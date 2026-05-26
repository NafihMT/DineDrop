using System;
using System.Collections.Generic;
using DineDrop.Domain.Enums;

namespace DineDrop.Application.Modules.Users.DTOs
{
    public class PlaceOrderDto
    {
        public Guid RestaurantId { get; set; }
        public Guid? AddressId { get; set; }
        public List<OrderItemCreateDto> Items { get; set; } = new();
    }

    public class OrderItemCreateDto
    {
        public Guid MenuItemId { get; set; }
        public int Quantity { get; set; }
    }

    public class CustomerOrderSummaryDto
    {
        public Guid Id { get; set; }
        public string RestaurantName { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public OrderStatus Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public int ItemCount { get; set; }
    }

    public class CustomerOrderDetailDto
    {
        public Guid Id { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string? DriverName { get; set; }
        public string RestaurantName { get; set; } = string.Empty;
        public string RestaurantAddress { get; set; } = string.Empty;
        public double RestaurantLatitude { get; set; }
        public double RestaurantLongitude { get; set; }
        public string CustomerAddress { get; set; } = string.Empty;
        public double CustomerLatitude { get; set; }
        public double CustomerLongitude { get; set; }
        public double? DriverLatitude { get; set; }
        public double? DriverLongitude { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal DeliveryFee { get; set; }
        public OrderStatus Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? DeliveryOtp { get; set; }
        public bool IsRated { get; set; }
        public List<CustomerOrderItemDto> Items { get; set; } = new();
    }

    public class RateOrderDto
    {
        public int RestaurantRating { get; set; }
        public string RestaurantFeedback { get; set; } = string.Empty;
        public int DriverRating { get; set; }
        public string DriverFeedback { get; set; } = string.Empty;
    }

    public class CustomerOrderItemDto
    {
        public string DishName { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
    }

    public class FlashRescueDealDto
    {
        public Guid OrderId { get; set; }
        public Guid RestaurantId { get; set; }
        public string RestaurantName { get; set; } = string.Empty;
        public double RestaurantLatitude { get; set; }
        public double RestaurantLongitude { get; set; }
        public decimal OriginalSubtotal { get; set; }
        public decimal RescuedPrice { get; set; }
        public DateTime ExpiresAt { get; set; }
        public Guid? CancelledByUserId { get; set; }
        public OrderStatus PreviousStatus { get; set; }
        public List<CustomerOrderItemDto> Items { get; set; } = new();
    }
}
