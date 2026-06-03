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
using DineDrop.Application.Modules.Drivers.Interfaces;

namespace DineDrop.Infrastructure.Services
{
    public class CustomerOrderService : ICustomerOrderService
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<OrderHub> _hubContext;
        private readonly IRedisService _redisService;

        public CustomerOrderService(AppDbContext context, IHubContext<OrderHub> hubContext, IRedisService redisService)
        {
            _context = context;
            _hubContext = hubContext;
            _redisService = redisService;
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
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    RestaurantId = dto.RestaurantId,
                    AddressId = dto.AddressId,
                    Status = OrderStatus.Placed,
                    PaymentStatus = PaymentStatus.Pending,
                    CreatedAt = DateTime.UtcNow.AddHours(5).AddMinutes(30),
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

                decimal discountAmount = 0;
                Guid? offerId = null;

                if (!string.IsNullOrWhiteSpace(dto.CouponCode))
                {
                    var code = dto.CouponCode.Trim().ToUpper();
                    var offer = await _context.Offers.FirstOrDefaultAsync(o => o.Code.ToUpper() == code && o.IsActive && o.ExpiryDate >= DateTime.UtcNow.AddHours(5).AddMinutes(30) && !o.IsDeleted);
                    if (offer == null)
                    {
                        throw new Exception("Coupon code is invalid or has expired.");
                    }
                    if (totalAmount < offer.MinOrderAmount)
                    {
                        throw new Exception($"Minimum order amount for coupon {offer.Code} is ₹{offer.MinOrderAmount:F2}.");
                    }
                    if (offer.CreatedBy == "Restaurant" && offer.RestaurantId.HasValue && offer.RestaurantId.Value != dto.RestaurantId)
                    {
                        throw new Exception("This coupon code is only valid for another restaurant.");
                    }

                    // First-order coupon check for NEW50 or FIRST50
                    if (code == "NEW50" || code == "FIRST50")
                    {
                        var hasOrders = await _context.Orders.AnyAsync(o => o.UserId == userId && o.Status != OrderStatus.Cancelled);
                        if (hasOrders)
                        {
                            throw new Exception("This coupon is only valid for your first order.");
                        }
                    }

                    if (offer.Type == OfferType.Percentage)
                    {
                        discountAmount = Math.Round(totalAmount * (offer.Value / 100.00m), 2);
                    }
                    else if (offer.Type == OfferType.Flat)
                    {
                        discountAmount = Math.Min(totalAmount, offer.Value);
                    }

                    offerId = offer.Id;
                }

                order.DiscountAmount = discountAmount;
                order.OfferId = offerId;
                
                distance = CalculateDistance(restaurant.Latitude, restaurant.Longitude, userAddress.Latitude, userAddress.Longitude);
                decimal deliveryCharge = (decimal)Math.Round(Math.Max(5, distance * 2), 2);
                
                decimal platformFee = 20.00m;
                decimal subtotal = totalAmount - discountAmount;
                decimal gstOnFood = Math.Round(subtotal * 0.05m, 2);
                decimal gstOnDeliveryAndPlatform = Math.Round((platformFee + deliveryCharge) * 0.18m, 2);
                decimal totalGst = gstOnFood + gstOnDeliveryAndPlatform;

                order.DeliveryFee = deliveryCharge;
                order.TotalAmount = subtotal + platformFee + deliveryCharge + totalGst;

                var paymentMethod = Enum.TryParse<PaymentMethod>(dto.PaymentMethod, true, out var pm) ? pm : PaymentMethod.Wallet;
                order.PaymentMethod = paymentMethod;

                if (paymentMethod == PaymentMethod.Wallet || paymentMethod == PaymentMethod.Online)
                {
                    var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
                    if (wallet == null)
                    {
                        wallet = new Wallet { UserId = userId, Balance = 100.00m }; 
                        _context.Wallets.Add(wallet);
                    }

                    if (wallet.Balance < order.TotalAmount)
                        throw new Exception($"Insufficient funds in DineDrop Wallet. Balance: ₹{wallet.Balance:F2}, Order Total: ₹{order.TotalAmount:F2}. Please add funds to your wallet in the Profile section.");

                    wallet.Balance -= order.TotalAmount;
                    order.PaymentStatus = PaymentStatus.Success;

                    var ledger = new LedgerEntry
                    {
                        EntityId = userId,
                        EntityType = LedgerEntityType.User,
                        Type = LedgerType.Debit,
                        Amount = order.TotalAmount,
                        OrderId = order.Id,
                        Description = $"Payment ({paymentMethod}) for order #{order.Id.ToString().Substring(0, 8)}"
                    };
                    _context.LedgerEntries.Add(ledger);

                    // Fund Admin Wallet
                    var adminId = Guid.Parse("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b");
                    var adminWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == adminId);
                    if (adminWallet == null)
                    {
                        adminWallet = new Wallet { UserId = adminId, Balance = 0.00m };
                        _context.Wallets.Add(adminWallet);
                    }
                    adminWallet.Balance += order.TotalAmount;

                    var adminLedger = new LedgerEntry
                    {
                        EntityId = adminId,
                        EntityType = LedgerEntityType.Admin,
                        Type = LedgerType.Credit,
                        Amount = order.TotalAmount,
                        OrderId = order.Id,
                        Description = $"Collected amount ({paymentMethod}) for order #{order.Id.ToString().Substring(0, 8)}"
                    };
                    _context.LedgerEntries.Add(adminLedger);
                }
                else if (paymentMethod == PaymentMethod.COD)
                {
                    order.PaymentStatus = PaymentStatus.Pending;
                }

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
            var order = await _context.Orders
                .Where(o => o.Id == orderId && o.UserId == userId)
                .Include(o => o.Restaurant)
                .Include(o => o.User)
                .Include(o => o.Offer)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.MenuItem)
                .FirstOrDefaultAsync();

            if (order == null) return null;

            // Fetch restaurant address
            var restProfile = await _context.RestaurantProfiles
                .FirstOrDefaultAsync(p => p.UserId == order.Restaurant.OwnerId);
            var restaurantAddress = restProfile?.Address ?? string.Empty;

            // Fetch customer address coordinates
            var customerAddressText = "No Address Provided";
            double customerLat = 0;
            double customerLng = 0;
            if (order.AddressId.HasValue)
            {
                var addr = await _context.UserAddresses.FirstOrDefaultAsync(a => a.Id == order.AddressId.Value);
                if (addr != null)
                {
                    customerAddressText = $"{addr.AddressLine}, {addr.City}, {addr.State} - {addr.Pincode}";
                    customerLat = addr.Latitude;
                    customerLng = addr.Longitude;
                }
            }

            // Retrieve live driver location from Redis Geo index if a driver is assigned
            double? driverLat = null;
            double? driverLng = null;
            string? driverName = null;
            if (order.DriverId.HasValue)
            {
                var driverLoc = await _redisService.GetDriverLocationAsync(order.DriverId.Value);
                if (driverLoc != null)
                {
                    driverLat = driverLoc.Value.Latitude;
                    driverLng = driverLoc.Value.Longitude;
                }
                var driverUser = await _context.Users.FindAsync(order.DriverId.Value);
                driverName = driverUser?.Name;
            }

            // Retrieve delivery OTP if status is Picked
            string? deliveryOtp = null;
            if (order.Status == OrderStatus.Picked)
            {
                deliveryOtp = await _redisService.GetDeliveryOtpAsync(order.Id);
            }

            // Check if already rated
            bool isRated = order.IsRated;

            return new CustomerOrderDetailDto
            {
                Id = order.Id,
                CustomerName = order.User.Name,
                DriverName = driverName,
                RestaurantName = order.Restaurant.Name,
                RestaurantAddress = restaurantAddress,
                RestaurantLatitude = order.Restaurant.Latitude,
                RestaurantLongitude = order.Restaurant.Longitude,
                CustomerAddress = customerAddressText,
                CustomerLatitude = customerLat,
                CustomerLongitude = customerLng,
                DriverLatitude = driverLat,
                DriverLongitude = driverLng,
                TotalAmount = order.TotalAmount,
                DeliveryFee = order.DeliveryFee,
                DiscountAmount = order.DiscountAmount,
                Status = order.Status,
                CreatedAt = order.CreatedAt,
                DeliveryOtp = deliveryOtp,
                IsRated = isRated,
                Items = order.OrderItems.Select(oi => new CustomerOrderItemDto
                {
                    DishName = oi.MenuItem.Name,
                    Quantity = oi.Quantity,
                    UnitPrice = oi.UnitPrice
                }).ToList()
            };
        }

        public async Task<bool> CancelOrderAsync(Guid userId, Guid orderId)
        {
            var order = await _context.Orders
                .Include(o => o.Restaurant)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.MenuItem)
                .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);

            if (order == null) return false;

            // Only allow cancellation if order has not been picked up or completed
            if (order.Status >= OrderStatus.Picked || order.Status == OrderStatus.Delivered || order.Status == OrderStatus.Cancelled)
                throw new Exception("Cannot cancel an order that has already been picked up, completed, or cancelled.");

            var originalStatus = order.Status;
            order.Status = OrderStatus.Cancelled;

            decimal refundAmount = 0;
            decimal cancellationFee = 0;

            var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
            if (wallet == null)
            {
                wallet = new Domain.Entities.Wallet { UserId = userId, Balance = 0.00m };
                _context.Wallets.Add(wallet);
            }

            if (originalStatus == OrderStatus.Placed || originalStatus == OrderStatus.Accepted)
            {
                // Full Refund
                refundAmount = order.TotalAmount;
                wallet.Balance += refundAmount;

                var ledger = new Domain.Entities.LedgerEntry
                {
                    EntityId = userId,
                    EntityType = Domain.Enums.LedgerEntityType.User,
                    Type = Domain.Enums.LedgerType.Credit,
                    Amount = refundAmount,
                    OrderId = order.Id,
                    Description = $"Refund for cancelled order #{order.Id.ToString().Substring(0, 8)}"
                };
                _context.LedgerEntries.Add(ledger);
            }
            else // Preparing or Ready
            {
                // Partial refund (50% subtotal + 100% delivery fee)
                decimal subtotal = order.TotalAmount - order.DeliveryFee;
                refundAmount = (subtotal * 0.5m) + order.DeliveryFee;
                cancellationFee = subtotal * 0.5m;

                wallet.Balance += refundAmount;

                // Credit customer refund ledger
                var customerLedger = new Domain.Entities.LedgerEntry
                {
                    EntityId = userId,
                    EntityType = Domain.Enums.LedgerEntityType.User,
                    Type = Domain.Enums.LedgerType.Credit,
                    Amount = refundAmount,
                    OrderId = order.Id,
                    Description = $"Refund (50% food + delivery) for preparing/ready order #{order.Id.ToString().Substring(0, 8)}"
                };
                _context.LedgerEntries.Add(customerLedger);

                // Credit restaurant owner compensation
                var restaurantOwnerId = order.Restaurant.OwnerId;
                var restWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == restaurantOwnerId);
                if (restWallet == null)
                {
                    restWallet = new Domain.Entities.Wallet { UserId = restaurantOwnerId, Balance = 0.00m };
                    _context.Wallets.Add(restWallet);
                }
                restWallet.Balance += cancellationFee;

                var restaurantLedger = new Domain.Entities.LedgerEntry
                {
                    EntityId = restaurantOwnerId,
                    EntityType = Domain.Enums.LedgerEntityType.Restaurant,
                    Type = Domain.Enums.LedgerType.Credit,
                    Amount = cancellationFee,
                    OrderId = order.Id,
                    Description = $"Compensation (50% cancellation fee) for order #{order.Id.ToString().Substring(0, 8)}"
                };
                _context.LedgerEntries.Add(restaurantLedger);

                // List the prepared food as a "Flash Food Rescue Deal" in Redis
                var rescueDeal = new FlashRescueDealDto
                {
                    OrderId = order.Id,
                    RestaurantId = order.RestaurantId,
                    RestaurantName = order.Restaurant.Name,
                    RestaurantLatitude = order.Restaurant.Latitude,
                    RestaurantLongitude = order.Restaurant.Longitude,
                    OriginalSubtotal = subtotal,
                    RescuedPrice = subtotal * 0.5m,
                    ExpiresAt = DateTime.UtcNow.AddHours(5).AddMinutes(30).AddMinutes(45),
                    CancelledByUserId = order.UserId,
                    PreviousStatus = originalStatus,
                    Items = order.OrderItems.Select(oi => new CustomerOrderItemDto
                    {
                        DishName = oi.MenuItem.Name,
                        Quantity = oi.Quantity,
                        UnitPrice = oi.UnitPrice
                    }).ToList()
                };

                var options = new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = null };
                var dealJson = System.Text.Json.JsonSerializer.Serialize(rescueDeal, options);
                await _redisService.SaveRescueDealAsync(order.Id, dealJson, TimeSpan.FromMinutes(45));
            }

            await _context.SaveChangesAsync();

            // Notify Restaurant Group via SignalR
            await _hubContext.Clients.Group(order.RestaurantId.ToString())
                .SendAsync("OrderCancelledByCustomer", new { orderId = order.Id.ToString() });

            // Notify Active Order status update
            await _hubContext.Clients.Group(order.Id.ToString())
                .SendAsync("OrderStatusUpdated", new { orderId = order.Id, newStatus = order.Status.ToString() });

            // Notify all drivers to refresh available/active lists
            await _hubContext.Clients.All.SendAsync("OrderStatusUpdated");

            return true;
        }

        public async Task<List<FlashRescueDealDto>> GetActiveRescueDealsAsync(Guid currentUserId)
        {
            var jsons = await _redisService.GetAllRescueDealsAsync();
            var list = new List<FlashRescueDealDto>();
            var options = new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = null };
            foreach (var json in jsons)
            {
                try
                {
                    var deal = System.Text.Json.JsonSerializer.Deserialize<FlashRescueDealDto>(json, options);
                    if (deal != null && deal.CancelledByUserId != currentUserId)
                    {
                        list.Add(deal);
                    }
                }
                catch
                {
                    // Ignore corrupted JSONs
                }
            }
            return list;
        }

        public async Task<Guid> BuyRescueDealAsync(Guid userId, Guid orderId, Guid addressId)
        {
            var dealJson = await _redisService.GetRescueDealAsync(orderId);
            if (dealJson == null)
            {
                throw new Exception("This Flash Rescue deal is no longer available or has expired.");
            }

            // Remove from Redis first to prevent race conditions
            await _redisService.RemoveRescueDealAsync(orderId);

            try
            {
                var options = new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = null };
                var deal = System.Text.Json.JsonSerializer.Deserialize<FlashRescueDealDto>(dealJson, options);
                if (deal == null) throw new Exception("Invalid rescue deal details.");

                decimal subtotal = deal.RescuedPrice;
                decimal deliveryFee = 5.00m;
                decimal totalAmount = subtotal + deliveryFee;

                var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
                if (wallet == null)
                {
                    wallet = new Domain.Entities.Wallet { UserId = userId, Balance = 100.00m };
                    _context.Wallets.Add(wallet);
                }

                if (wallet.Balance < totalAmount)
                {
                    throw new Exception($"Insufficient funds in DineDrop Wallet. Balance: ₹{wallet.Balance:F2}, Deal Total: ₹{totalAmount:F2}.");
                }

                var originalOrder = await _context.Orders
                    .Include(o => o.OrderItems)
                    .FirstOrDefaultAsync(o => o.Id == orderId);
                if (originalOrder == null) throw new Exception("Original cancelled order details not found.");

                wallet.Balance -= totalAmount;

                // Credit restaurant owner the rescued food amount (combining with cancellation fee = 100% revenue!)
                var restaurant = await _context.Restaurants.FindAsync(deal.RestaurantId);
                if (restaurant == null) throw new Exception("Restaurant not found.");

                var restOwnerWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == restaurant.OwnerId);
                if (restOwnerWallet == null)
                {
                    restOwnerWallet = new Domain.Entities.Wallet { UserId = restaurant.OwnerId, Balance = 0.00m };
                    _context.Wallets.Add(restOwnerWallet);
                }
                restOwnerWallet.Balance += subtotal;

                // Ledger entries
                var userLedger = new Domain.Entities.LedgerEntry
                {
                    EntityId = userId,
                    EntityType = Domain.Enums.LedgerEntityType.User,
                    Type = Domain.Enums.LedgerType.Debit,
                    Amount = totalAmount,
                    OrderId = Guid.NewGuid(),
                    Description = $"Payment for Flash Rescue order from {deal.RestaurantName}"
                };
                _context.LedgerEntries.Add(userLedger);

                var restaurantLedger = new Domain.Entities.LedgerEntry
                {
                    EntityId = restaurant.OwnerId,
                    EntityType = Domain.Enums.LedgerEntityType.Restaurant,
                    Type = Domain.Enums.LedgerType.Credit,
                    Amount = subtotal,
                    OrderId = Guid.NewGuid(),
                    Description = $"Rescued order food revenue for cancelled order #{orderId.ToString().Substring(0, 8)}"
                };
                _context.LedgerEntries.Add(restaurantLedger);

                // Insert the new rescued order (starts from the status it was cancelled from)
                var newOrder = new Order
                {
                    UserId = userId,
                    RestaurantId = deal.RestaurantId,
                    AddressId = addressId,
                    Status = (deal.PreviousStatus == OrderStatus.Preparing || deal.PreviousStatus == OrderStatus.Ready)
                        ? deal.PreviousStatus 
                        : OrderStatus.Ready,
                    PaymentStatus = PaymentStatus.Success,
                    CreatedAt = DateTime.UtcNow.AddHours(5).AddMinutes(30),
                    DeliveryFee = deliveryFee,
                    TotalAmount = totalAmount,
                    OrderItems = originalOrder.OrderItems.Select(oi => new OrderItem
                    {
                        MenuItemId = oi.MenuItemId,
                        Quantity = oi.Quantity,
                        UnitPrice = oi.UnitPrice * 0.5m // Sold at 50% discount
                    }).ToList()
                };

                _context.Orders.Add(newOrder);
                await _context.SaveChangesAsync();

                // Notify Restaurant
                await _hubContext.Clients.Group(newOrder.RestaurantId.ToString())
                    .SendAsync("NewOrderReceived", new 
                    { 
                        orderId = newOrder.Id, 
                        customerName = newOrder.User?.Name ?? "Guest",
                        totalAmount = newOrder.TotalAmount 
                    });

                // Notify Drivers of new Ready order
                await _hubContext.Clients.All.SendAsync("OrderStatusUpdated");

                return newOrder.Id;
            }
            catch (Exception)
            {
                // Restore rescue deal to Redis if something failed
                await _redisService.SaveRescueDealAsync(orderId, dealJson, TimeSpan.FromMinutes(30));
                throw;
            }
        }

        public async Task<bool> RateOrderAsync(Guid userId, Guid orderId, RateOrderDto dto)
        {
            var order = await _context.Orders
                .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);

            if (order == null || order.Status != OrderStatus.Delivered || order.IsRated)
            {
                return false;
            }

            // Mark order as rated
            order.IsRated = true;

            // Create Restaurant Rating
            if (dto.RestaurantRating > 0)
            {
                var restRating = new Rating
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    RestaurantId = order.RestaurantId,
                    Value = dto.RestaurantRating,
                    Comment = dto.RestaurantFeedback ?? string.Empty
                };
                _context.Ratings.Add(restRating);

                // Update restaurant average rating
                var restaurant = await _context.Restaurants.FindAsync(order.RestaurantId);
                if (restaurant != null)
                {
                    var allRestRatings = await _context.Ratings
                        .Where(r => r.RestaurantId == order.RestaurantId)
                        .Select(r => r.Value)
                        .ToListAsync();
                    allRestRatings.Add(dto.RestaurantRating);
                    restaurant.Rating = allRestRatings.Average();
                }
            }

            if (order.DriverId.HasValue)
            {
                // Create Driver Rating
                var driverRating = new Rating
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    DriverId = order.DriverId.Value,
                    Value = dto.DriverRating,
                    Comment = dto.DriverFeedback ?? string.Empty
                };
                _context.Ratings.Add(driverRating);

                // Update driver average rating
                var driver = await _context.Drivers.FindAsync(order.DriverId.Value);
                if (driver != null)
                {
                    var allDriverRatings = await _context.Ratings
                        .Where(r => r.DriverId == order.DriverId.Value)
                        .Select(r => r.Value)
                        .ToListAsync();
                    allDriverRatings.Add(dto.DriverRating);
                    driver.Rating = allDriverRatings.Average();
                }
            }

            await _context.SaveChangesAsync();
            return true;
        }
    }
}
