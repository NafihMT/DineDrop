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
using DineDrop.Application.Modules.Drivers.Interfaces;

namespace DineDrop.Infrastructure.Services
{
    public class RestaurantOrderService : IRestaurantOrderService
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<OrderHub> _hubContext;
        private readonly IRedisService _redisService;

        public RestaurantOrderService(AppDbContext context, IHubContext<OrderHub> hubContext, IRedisService redisService)
        {
            _context = context;
            _hubContext = hubContext;
            _redisService = redisService;
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
                    DiscountAmount = o.DiscountAmount,
                    CouponCode = o.Offer != null ? o.Offer.Code : null,
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
            var restaurant = await _context.Restaurants.FirstOrDefaultAsync(r => r.OwnerId == userId);
            if (restaurant == null) return new List<RestaurantOrderDto>();

            var orders = await _context.Orders
                .Where(o => o.RestaurantId == restaurant.Id && 
                           (o.Status == OrderStatus.Delivered || o.Status == OrderStatus.Cancelled))
                .OrderByDescending(o => o.CreatedAt)
                .Include(o => o.User)
                .Include(o => o.Offer)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.MenuItem)
                .ToListAsync();

            // Fetch all restaurant ratings
            var ratings = await _context.Ratings
                .Where(r => r.RestaurantId == restaurant.Id)
                .OrderBy(r => r.CreatedAt)
                .ToListAsync();

            var result = new List<RestaurantOrderDto>();

            foreach (var o in orders)
            {
                Rating? matchingRating = null;
                if (o.IsRated)
                {
                    matchingRating = ratings
                        .Where(r => r.UserId == o.UserId && r.CreatedAt >= o.CreatedAt)
                        .OrderBy(r => r.CreatedAt)
                        .FirstOrDefault();
                }

                result.Add(new RestaurantOrderDto
                {
                    Id = o.Id,
                    CustomerName = o.User.Name,
                    TotalAmount = o.TotalAmount,
                    DeliveryFee = o.DeliveryFee,
                    DiscountAmount = o.DiscountAmount,
                    CouponCode = o.Offer != null ? o.Offer.Code : null,
                    Status = o.Status,
                    CreatedAt = o.CreatedAt,
                    RestaurantRating = matchingRating?.Value,
                    RestaurantFeedback = matchingRating?.Comment,
                    Items = o.OrderItems.Select(oi => new RestaurantOrderItemDto
                    {
                        DishName = oi.MenuItem.Name,
                        Quantity = oi.Quantity,
                        UnitPrice = oi.UnitPrice
                    }).ToList()
                });
            }

            return result;
        }

        public async Task<bool> UpdateOrderStatusAsync(Guid userId, UpdateOrderStatusDto dto)
        {
            var order = await _context.Orders
                .Include(o => o.Restaurant)
                .FirstOrDefaultAsync(o => o.Id == dto.OrderId && o.Restaurant.OwnerId == userId);

            if (order == null)
                return false;

            // Prevent changing the status of delivered orders
            if (order.Status == OrderStatus.Delivered || order.Status == OrderStatus.Cancelled)
                throw new Exception("Cannot change the status of a completed or cancelled order.");

            order.Status = dto.NewStatus;
            order.UpdatedAt = DateTime.UtcNow;

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

            // Notify Restaurant Group
            await _hubContext.Clients.Group(order.RestaurantId.ToString())
                .SendAsync("OrderStatusUpdated", new
                {
                    orderId = order.Id,
                    newStatus = order.Status.ToString()
                });

            // If the order is Accepted, send a real-time notification only to drivers within 20km radius
            if (order.Status == OrderStatus.Accepted)
            {
                if (order.Restaurant != null)
                {
                    var restaurantLat = order.Restaurant.Latitude;
                    var restaurantLng = order.Restaurant.Longitude;

                    // Get nearby drivers (within 20 km) from Redis Geo
                    var nearbyDriverIds = await _redisService.GetNearbyDriversAsync(restaurantLat, restaurantLng, 20.0);

                    if (nearbyDriverIds != null && nearbyDriverIds.Count > 0)
                    {
                        // Get the corresponding approved, online (isAvailable == true) drivers from DB
                        var nearbyDrivers = await _context.Drivers
                            .Include(d => d.User)
                            .Where(d => nearbyDriverIds.Contains(d.Id) && 
                                        d.User.ApprovalStatus == ApprovalStatus.Approved && 
                                        !d.User.IsBlocked && 
                                        d.IsAvailable)
                            .ToListAsync();

                        foreach (var driver in nearbyDrivers)
                        {
                            await _hubContext.Clients.User(driver.UserId.ToString()).SendAsync("OrderAcceptedByRestaurant", new
                            {
                                orderId = order.Id,
                                restaurantName = order.Restaurant.Name,
                                totalAmount = order.TotalAmount,
                                deliveryFee = order.DeliveryFee
                            });
                        }
                    }
                }
                else
                {
                    // Fallback to broadcasting if restaurant is not set
                    await _hubContext.Clients.All.SendAsync("OrderAcceptedByRestaurant", new
                    {
                        orderId = order.Id,
                        restaurantName = "A Restaurant",
                        totalAmount = order.TotalAmount,
                        deliveryFee = order.DeliveryFee
                    });
                }
            }

            // If the order is Ready, send a real-time notification to the accepted driver only
            if (order.Status == OrderStatus.Ready)
            {
                if (order.DriverId.HasValue)
                {
                    var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.Id == order.DriverId.Value);
                    if (driver != null)
                    {
                        await _hubContext.Clients.User(driver.UserId.ToString()).SendAsync("OrderReady", new
                        {
                            orderId = order.Id,
                            restaurantName = order.Restaurant?.Name ?? "A Restaurant",
                            totalAmount = order.TotalAmount,
                            deliveryFee = order.DeliveryFee
                        });
                    }
                }
            }

            // Notify all drivers to update available list
            await _hubContext.Clients.All.SendAsync("OrderStatusUpdated");

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

        private double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
        {
            var r = 6371.0;
            var dLat = (lat2 - lat1) * (Math.PI / 180.0);
            var dLon = (lon2 - lon1) * (Math.PI / 180.0);

            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Cos(lat1 * (Math.PI / 180.0)) * Math.Cos(lat2 * (Math.PI / 180.0)) *
                    Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

            return r * c;
        }
    }
}
