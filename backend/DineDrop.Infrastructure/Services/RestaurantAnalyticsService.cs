using DineDrop.Application.Modules.Restaurants.DTOs;
using DineDrop.Application.Modules.Restaurants.Interfaces;
using DineDrop.Domain.Enums;
using DineDrop.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Infrastructure.Services
{
    public class RestaurantAnalyticsService : IRestaurantAnalyticsService
    {
        private readonly AppDbContext _context;
        public RestaurantAnalyticsService(AppDbContext context)
        {
            _context = context;
        }
        public async Task<EarningsDto> GetEarningsAsync(Guid userId)
        {
            var now = DateTime.UtcNow;
            var today = now.Date;
            var sevenDaysAgo = now.AddDays(-7);
            var thirtyDaysAgo = now.AddDays(-30);

            var earnings = await _context.Orders
                .Where(o => o.Restaurant.OwnerId == userId && o.Status == OrderStatus.Delivered)
                .GroupBy(o => 1)
                .Select(g => new EarningsDto
                {
                    DailyRevenue = g.Where(o => o.CreatedAt >= today).Sum(o => o.TotalAmount),
                    WeeklyRevenue = g.Where(o => o.CreatedAt >= sevenDaysAgo).Sum(o => o.TotalAmount),
                    MonthlyRevenue = g.Where(o => o.CreatedAt >= thirtyDaysAgo).Sum(o => o.TotalAmount)
                })
                .FirstOrDefaultAsync() ?? new EarningsDto();

            return earnings;
        }


        public async Task<List<PopularItemDto>> GetPopularItemAsync(Guid userId)
        {
            return await _context.OrderItems
                .Where(oi => oi.Order.Restaurant.OwnerId == userId && oi.Order.Status == OrderStatus.Delivered)
                .GroupBy(oi => oi.MenuItem.Name)
                .Select(g => new PopularItemDto
                {
                    Name = g.Key,
                    TotalSold = g.Sum(oi => oi.Quantity),
                    TotalRevenue = g.Sum(oi => oi.Quantity * oi.UnitPrice)
                })
                .OrderByDescending(x => x.TotalSold)
                .Take(5)
                .ToListAsync();
        }

        public async Task<RestaurantAnalyticsSummaryDto> GetSummaryAsync(Guid userId)
        {
            var restaurant = await _context.Restaurants.FirstOrDefaultAsync(r => r.OwnerId == userId);

            var totalOrder = await _context.Orders.CountAsync(o => o.Restaurant.OwnerId == userId);

            var totalEarning = await _context.Orders.Where(o => o.Restaurant.OwnerId == userId && o.Status == OrderStatus.Delivered)
                .SumAsync(o => o.TotalAmount);

            return new RestaurantAnalyticsSummaryDto
            {
                TotalOrders = totalOrder,
                AverageRating = restaurant?.Rating ?? 0,
                TotalEarnings = totalEarning,
                GrowthPercentage = 12.5
            };
        }
    }
}
