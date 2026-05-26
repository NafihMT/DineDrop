using System;

namespace DineDrop.Application.Modules.Admin.DTOs
{
    public class RestaurantRequestDto
    {
        public Guid UserId { get; set; }
        public string Name { get; set; } = default!;
        public string Email { get; set; } = default!;
        public string Phone { get; set; } = default!;
        public string BusinessName { get; set; } = default!;
        public string BusinessType { get; set; } = default!;
        public DateTime CreatedAt { get; set; }
    }

    public class ApprovalDto
    {
        public Guid UserId { get; set; }
        public bool IsApproved { get; set; }
    }

    public class AdminStatsDto
    {
        public int TotalRestaurants { get; set; }
        public int PendingRequests { get; set; }
        public int TotalUsers { get; set; }
        public int ActiveOrders { get; set; }
        public decimal TotalRevenue { get; set; }
        public int TotalDrivers { get; set; }
        public int PendingDrivers { get; set; }
    }

    public class AdminDriverDto
    {
        public Guid UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string ApprovalStatus { get; set; } = string.Empty;
        public bool IsBlocked { get; set; }
        public bool IsAvailable { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class AdminRestaurantDto
    {
        public Guid UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string BusinessName { get; set; } = string.Empty;
        public string BusinessType { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string ApprovalStatus { get; set; } = string.Empty;
        public bool IsOpen { get; set; }
        public bool IsActive { get; set; }
        public bool IsBlocked { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class AdminUserDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public bool IsBlocked { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class AdminOrderDto
    {
        public Guid Id { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string RestaurantName { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public string Status { get; set; } = string.Empty;
        public string PaymentStatus { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
