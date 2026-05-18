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
using Microsoft.AspNetCore.SignalR;
using DineDrop.Infrastructure.Hubs;

namespace DineDrop.Infrastructure.Services
{
    public class RestaurantOrderService : IRestaurantOrderService
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<OrderHub> _hubContext;

        public RestaurantOrderService(AppDbContext context, IHubContext<OrderHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        public async Task<List<RestaurantOrderDto>> GetActiveOrdersAsync(Guid userId)
        {
            return await _context.Orders
                .Where(o => o.Restaurant.OwnerId == userId && 
                           o.Status != OrderStatus.Delivered && 
                           o.Status != OrderStatus.Cancelled)
                .OrderByDescending(o => o.CreatedAt)
                .Select(o => new RestaurantOrderDto
                {
                    Id = o.Id,
                    CustomerName = o.User.Name,
                    TotalAmount = o.TotalAmount,
                    DeliveryFee = o.DeliveryFee,
                    Status = o.Status,
                    CreatedAt = o.CreatedAt,
                    Items = o.OrderItems.Select(oi => new RestaurantOrderItemDto
                    {
                        DishName = oi.MenuItem.Name,
                        Quantity = oi.Quantity,
                        UnitPrice = oi.UnitPrice
                    }).ToList()
                }).ToListAsync();
        }

        public async Task<List<RestaurantOrderDto>> GetOrderHistoryAsync(Guid userId)
        {
            return await _context.Orders
                .Where(o => o.Restaurant.OwnerId == userId && 
                           (o.Status == OrderStatus.Delivered || o.Status == OrderStatus.Cancelled))
                .OrderByDescending(o => o.CreatedAt)
                .Select(o => new RestaurantOrderDto
                {
                    Id = o.Id,
                    CustomerName = o.User.Name,
                    TotalAmount = o.TotalAmount,
                    DeliveryFee = o.DeliveryFee,
                    Status = o.Status,
                    CreatedAt = o.CreatedAt,
                    Items = o.OrderItems.Select(oi => new RestaurantOrderItemDto
                    {
                        DishName = oi.MenuItem.Name,
                        Quantity = oi.Quantity,
                        UnitPrice = oi.UnitPrice
                    }).ToList()
                }).ToListAsync();
        }

        public async Task<bool> UpdateOrderStatusAsync(Guid userId, UpdateOrderStatusDto dto)
        {
            var order = await _context.Orders
                .FirstOrDefaultAsync(o => o.Id == dto.OrderId && o.Restaurant.OwnerId == userId);

            if (order == null)
                return false;

            // Prevent changing the status of delivered orders
            if (order.Status == OrderStatus.Delivered || order.Status == OrderStatus.Cancelled)
                throw new Exception("Cannot change the status of a completed or cancelled order.");

            order.Status = dto.NewStatus;

            if (dto.NewStatus == OrderStatus.Cancelled)
            {
                var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == order.UserId);
                if (wallet == null)
                {
                    wallet = new Wallet { UserId = order.UserId, Balance = 0.00m };
                    _context.Wallets.Add(wallet);
                }
                wallet.Balance += order.TotalAmount;

                var ledger = new LedgerEntry
                {
                    EntityId = order.UserId,
                    EntityType = LedgerEntityType.User,
                    Type = LedgerType.Credit,
                    Amount = order.TotalAmount,
                    OrderId = order.Id,
                    Description = $"Refund for restaurant cancelled order #{order.Id.ToString().Substring(0, 8)}"
                };
                _context.LedgerEntries.Add(ledger);
            }

            await _context.SaveChangesAsync();

            // Notify Customer of Status Change
            await _hubContext.Clients.Group(order.Id.ToString())
                .SendAsync("OrderStatusUpdated", new 
                { 
                    orderId = order.Id, 
                    newStatus = order.Status.ToString() 
                });

            return true;
        }

        public async Task<RestaurantDashboardStatsDto> GetDashboardStatsAsync(Guid userId)
        {
            var restaurant = await _context.Restaurants.FirstOrDefaultAsync(r => r.OwnerId == userId);
            if (restaurant == null) throw new Exception("Restaurant not found");

            var today = DateTime.UtcNow.Date;
            var orders = await _context.Orders
                .Where(o => o.RestaurantId == restaurant.Id)
                .ToListAsync();

            var todayOrders = orders.Where(o => o.CreatedAt.Date == today).ToList();

            return new RestaurantDashboardStatsDto
            {
                TodayRevenue = todayOrders.Where(o => o.Status != OrderStatus.Cancelled).Sum(o => o.TotalAmount),
                TotalRevenue = orders.Where(o => o.Status != OrderStatus.Cancelled).Sum(o => o.TotalAmount),
                ActiveOrdersCount = orders.Count(o => o.Status != OrderStatus.Delivered && o.Status != OrderStatus.Cancelled),
                TotalOrdersCount = orders.Count,
                AverageOrderValue = orders.Any() ? orders.Average(o => o.TotalAmount) : 0,
                RevenueChart = orders
                    .GroupBy(o => o.CreatedAt.Date)
                    .OrderBy(g => g.Key)
                    .TakeLast(7)
                    .Select(g => new RevenuePointDto
                    {
                        Date = g.Key.ToString("MMM dd"),
                        Amount = g.Sum(o => o.TotalAmount)
                    }).ToList()
            };
        }
    }
}
