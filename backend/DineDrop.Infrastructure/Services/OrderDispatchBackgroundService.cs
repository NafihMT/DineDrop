using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using DineDrop.Infrastructure.Data;
using DineDrop.Domain.Enums;
using DineDrop.Domain.Entities;
using DineDrop.Infrastructure.Hubs;

namespace DineDrop.Infrastructure.Services
{
    public class OrderDispatchBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<OrderDispatchBackgroundService> _logger;

        public OrderDispatchBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<OrderDispatchBackgroundService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("OrderDispatchBackgroundService is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckAndCancelUnpickedOrdersAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred executing CheckAndCancelUnpickedOrdersAsync");
                }

                // Check every 10 seconds
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }

            _logger.LogInformation("OrderDispatchBackgroundService is stopping.");
        }

        private async Task CheckAndCancelUnpickedOrdersAsync()
        {
            using (var scope = _serviceProvider.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<OrderHub>>();

                // Threshold: 30 Minutes ago for testing
                var thresholdTime = DateTime.UtcNow.AddMinutes(-30);

                var activeCount = await context.Orders
                    .CountAsync(o => o.DriverId == null && 
                               (o.Status == OrderStatus.Accepted || 
                                o.Status == OrderStatus.Preparing || 
                                o.Status == OrderStatus.Ready));

                _logger.LogInformation("Background scanning: Found {Count} active orders with no driver assigned.", activeCount);

                // Find all orders that were accepted by the restaurant but have no driver assigned
                // and have been in this state for more than 30 Minutes
                var unpickedOrders = await context.Orders
                    .Include(o => o.Restaurant)
                    .Where(o => o.DriverId == null && 
                               (o.Status == OrderStatus.Accepted || 
                                o.Status == OrderStatus.Preparing || 
                                o.Status == OrderStatus.Ready) &&
                               (o.UpdatedAt ?? o.CreatedAt) <= thresholdTime)
                    .ToListAsync();

                if (unpickedOrders.Any())
                {
                    _logger.LogInformation("Found {Count} expired unpicked orders to automatically cancel.", unpickedOrders.Count);

                    foreach (var order in unpickedOrders)
                    {
                        order.Status = OrderStatus.Cancelled;
                        order.UpdatedAt = DateTime.UtcNow;

                        // Refund the customer
                        var wallet = await context.Wallets.FirstOrDefaultAsync(w => w.UserId == order.UserId);
                        if (wallet == null)
                        {
                            wallet = new Wallet { UserId = order.UserId, Balance = 0.00m };
                            context.Wallets.Add(wallet);
                        }
                        wallet.Balance += order.TotalAmount;

                        var ledger = new LedgerEntry
                        {
                            EntityId = order.UserId,
                            EntityType = LedgerEntityType.User,
                            Type = LedgerType.Credit,
                            Amount = order.TotalAmount,
                            OrderId = order.Id,
                            Description = $"Refund for order #{order.Id.ToString().Substring(0, 8)} - no driver available"
                        };
                        context.LedgerEntries.Add(ledger);

                        // SignalR Notification to Customer
                        await hubContext.Clients.Group(order.Id.ToString()).SendAsync("OrderStatusUpdated", new
                        {
                            orderId = order.Id,
                            newStatus = OrderStatus.Cancelled.ToString(),
                            message = "No driver available in your region. Your order has been cancelled and refunded to your wallet."
                        });

                        // SignalR Notification to Restaurant Group
                        await hubContext.Clients.Group(order.RestaurantId.ToString()).SendAsync("OrderStatusUpdated", new
                        {
                            orderId = order.Id,
                            newStatus = OrderStatus.Cancelled.ToString()
                        });
                    }

                    await context.SaveChangesAsync();

                    // SignalR Broadcast to all drivers to refresh their available orders lists
                    await hubContext.Clients.All.SendAsync("OrderStatusUpdated");
                }
            }
        }
    }
}
