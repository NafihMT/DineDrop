using DineDrop.Application.Modules.Users.DTOs;
using DineDrop.Application.Modules.Users.Interfaces;
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
    public class CustomerOrderService : ICustomerOrderService
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<OrderHub> _hubContext;

        public CustomerOrderService(AppDbContext context, IHubContext<OrderHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
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

        public async Task<Guid> PlaceOrderAsync(Guid userId, PlaceOrderDto dto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var restaurant = await _context.Restaurants.FindAsync(dto.RestaurantId);
                if (restaurant == null) throw new Exception("Restaurant not found");

                var userAddress = await _context.UserAddresses.FirstOrDefaultAsync(a => a.Id == dto.AddressId && a.UserId == userId);
                if (userAddress == null) throw new Exception("Delivery address not found");

                var distance = CalculateDistance(restaurant.Latitude, restaurant.Longitude, userAddress.Latitude, userAddress.Longitude);
                if (distance > 30.0)
                {
                    throw new Exception($"Delivery address is {distance:F1} km away from {restaurant.Name}. We only deliver within a 30 km radius.");
                }

                var order = new Order
                {
                    UserId = userId,
                    RestaurantId = dto.RestaurantId,
                    AddressId = dto.AddressId,
                    Status = OrderStatus.Placed,
                    PaymentStatus = PaymentStatus.Pending,
                    CreatedAt = DateTime.UtcNow,
                    OrderItems = new List<OrderItem>()
                };

                decimal totalAmount = 0;

                foreach (var itemDto in dto.Items)
                {
                    var menuItem = await _context.MenuItems.FindAsync(itemDto.MenuItemId);
                    if (menuItem == null) 
                        throw new Exception($"Dish with ID {itemDto.MenuItemId} not found");

                    var orderItem = new OrderItem
                    {
                        MenuItemId = menuItem.Id,
                        Quantity = itemDto.Quantity,
                        UnitPrice = menuItem.Price
                    };

                    order.OrderItems.Add(orderItem);
                    totalAmount += (orderItem.UnitPrice * orderItem.Quantity);
                }

                order.TotalAmount = totalAmount;
                order.DeliveryFee = 5.00m; 
                order.TotalAmount += order.DeliveryFee;

                var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
                if (wallet == null)
                {
                    wallet = new Wallet { UserId = userId, Balance = 100.00m }; 
                    _context.Wallets.Add(wallet);
                }

                if (wallet.Balance < order.TotalAmount)
                    throw new Exception($"Insufficient funds in DineDrop Wallet. Balance: ${wallet.Balance:F2}, Order Total: ${order.TotalAmount:F2}. Please add funds to your wallet in the Profile section.");

                wallet.Balance -= order.TotalAmount;

                order.PaymentStatus = PaymentStatus.Success;

                var ledger = new LedgerEntry
                {
                    EntityId = userId,
                    EntityType = LedgerEntityType.User,
                    Type = LedgerType.Debit,
                    Amount = order.TotalAmount,
                    OrderId = order.Id,
                    Description = $"Payment for order #{order.Id.ToString().Substring(0, 8)}"
                };
                _context.LedgerEntries.Add(ledger);

                _context.Orders.Add(order);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                //SignalR Notification to Restaurant Group
                await _hubContext.Clients.Group(order.RestaurantId.ToString())
                    .SendAsync("NewOrderReceived", new 
                    { 
                        orderId = order.Id, 
                        customerName = order.User?.Name ?? "Guest",
                        totalAmount = order.TotalAmount 
                    });
                
                return order.Id;
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<List<CustomerOrderSummaryDto>> GetMyOrdersAsync(Guid userId)
        {
            return await _context.Orders
                .Where(o => o.UserId == userId)
                .OrderByDescending(o => o.CreatedAt)
                .Select(o => new CustomerOrderSummaryDto
                {
                    Id = o.Id,
                    RestaurantName = o.Restaurant.Name,
                    TotalAmount = o.TotalAmount,
                    Status = o.Status,
                    CreatedAt = o.CreatedAt,
                    ItemCount = o.OrderItems.Sum(oi => oi.Quantity)
                })
                .ToListAsync();
        }

        public async Task<CustomerOrderDetailDto?> GetOrderDetailsAsync(Guid userId, Guid orderId)
        {
            return await _context.Orders
                .Where(o => o.Id == orderId && o.UserId == userId)
                .Select(o => new CustomerOrderDetailDto
                {
                    Id = o.Id,
                    RestaurantName = o.Restaurant.Name,
                    RestaurantAddress = _context.RestaurantProfiles.Where(p => p.UserId == o.Restaurant.OwnerId).Select(p => p.Address).FirstOrDefault() ?? string.Empty,
                    TotalAmount = o.TotalAmount,
                    DeliveryFee = o.DeliveryFee,
                    Status = o.Status,
                    CreatedAt = o.CreatedAt,
                    Items = o.OrderItems.Select(oi => new CustomerOrderItemDto
                    {
                        DishName = oi.MenuItem.Name,
                        Quantity = oi.Quantity,
                        UnitPrice = oi.UnitPrice
                    }).ToList()
                })
                .FirstOrDefaultAsync();
        }

        public async Task<bool> CancelOrderAsync(Guid userId, Guid orderId)
        {
            var order = await _context.Orders
                .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);

            if (order == null) return false;

            // Only allow cancellation if the order is still "Placed"
            if (order.Status != OrderStatus.Placed)
                throw new Exception("Cannot cancel an order that has already been accepted or processed.");

            order.Status = OrderStatus.Cancelled;

            // Refund to wallet
            var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
            if (wallet == null)
            {
                wallet = new Domain.Entities.Wallet { UserId = userId, Balance = 0.00m };
                _context.Wallets.Add(wallet);
            }
            wallet.Balance += order.TotalAmount;

            var ledger = new Domain.Entities.LedgerEntry
            {
                EntityId = userId,
                EntityType = Domain.Enums.LedgerEntityType.User,
                Type = Domain.Enums.LedgerType.Credit,
                Amount = order.TotalAmount,
                OrderId = order.Id,
                Description = $"Refund for cancelled order #{order.Id.ToString().Substring(0, 8)}"
            };
            _context.LedgerEntries.Add(ledger);

            await _context.SaveChangesAsync();

            // Notify Restaurant Group via SignalR
            await _hubContext.Clients.Group(order.RestaurantId.ToString())
                .SendAsync("OrderCancelledByCustomer", new
                {
                    orderId = order.Id.ToString()
                });

            return true;
        }
    }
}
