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
        public string RestaurantName { get; set; } = string.Empty;
        public string RestaurantAddress { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public decimal DeliveryFee { get; set; }
        public OrderStatus Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<CustomerOrderItemDto> Items { get; set; } = new();
    }

    public class CustomerOrderItemDto
    {
        public string DishName { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
    }
}
