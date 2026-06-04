using DineDrop.Application.Modules.Drivers.DTOs;
using DineDrop.Application.Modules.Drivers.Interfaces;
using DineDrop.Domain.Enums;
using DineDrop.Domain.Entities;
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
    public class DriverService : IDriverService
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<OrderHub> _hubContext;
        private readonly IRedisService _redisService;

        public DriverService(AppDbContext context, IHubContext<OrderHub> hubContext, IRedisService redisService)
        {
            _context = context;
            _hubContext = hubContext;
            _redisService = redisService;
        }

        public async Task<List<AvailableOrdersByRestaurantDto>> GetAvailableOrdersAsync(Guid userId)
        {
            var driver = await _context.Drivers.Include(d => d.User).FirstOrDefaultAsync(d => d.UserId == userId);
            if (driver == null || driver.User.IsBlocked) return new List<AvailableOrdersByRestaurantDto>();

            var driverPos = await _redisService.GetDriverLocationAsync(driver.Id);

            // Fetch all available orders that don't have a driver assigned
            var availableOrders = await _context.Orders
                .Where(o => o.DriverId == null && 
                           (o.Status == OrderStatus.Accepted || 
                            o.Status == OrderStatus.Preparing || 
                            o.Status == OrderStatus.Ready))
                .Include(o => o.Restaurant)
                .Include(o => o.User)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.MenuItem)
                .OrderBy(o => o.RestaurantId)
                .ThenByDescending(o => o.CreatedAt)
                .ToListAsync();

            // Only show restaurants within 20km of the driver
            if (driverPos.HasValue)
            {
                var driverLat = driverPos.Value.Latitude;
                var driverLng = driverPos.Value.Longitude;

                availableOrders = availableOrders.Where(o => 
                    o.Restaurant != null && 
                    CalculateDistance(driverLat, driverLng, o.Restaurant.Latitude, o.Restaurant.Longitude) <= 20.0
                ).ToList();
            }

            // Group by restaurant
            var grouped = availableOrders
                .GroupBy(o => o.RestaurantId)
                .Select(g => new AvailableOrdersByRestaurantDto
                {
                    RestaurantId = g.Key,
                    RestaurantName = g.First().Restaurant.Name,
                    Latitude = g.First().Restaurant.Latitude,
                    Longitude = g.First().Restaurant.Longitude,
                    Address = g.First().Restaurant.Description, // fallback — address field if added later
                    Orders = g.Select(o => new AvailableOrderDto
                    {
                        Id = o.Id,
                        CustomerName = o.User.Name,
                        TotalAmount = o.TotalAmount,
                        DeliveryFee = o.DeliveryFee,
                        Status = o.Status,
                        CreatedAt = o.CreatedAt,
                        Items = o.OrderItems.Select(oi => new AvailableOrderItemDto
                        {
                            DishName = oi.MenuItem.Name,
                            Quantity = oi.Quantity,
                            UnitPrice = oi.UnitPrice
                        }).ToList()
                    }).ToList()
                }).ToList();

            return grouped;
        }

        public async Task<bool> ToggleAvailabilityAsync(Guid userId)
        {
            var driver = await _context.Drivers.Include(d => d.User).FirstOrDefaultAsync(d => d.UserId == userId);
            if (driver == null || driver.User.IsBlocked) return false;

            driver.IsAvailable = !driver.IsAvailable;
            await _context.SaveChangesAsync();
            return driver.IsAvailable;
        }

        public async Task<bool> GetAvailabilityAsync(Guid userId)
        {
            var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.UserId == userId);
            return driver?.IsAvailable ?? false;
        }

        public async Task<bool> AcceptOrderAsync(Guid orderId, Guid userId)
        {
            var order = await _context.Orders
                .Include(o => o.Restaurant)
                .FirstOrDefaultAsync(o => o.Id == orderId);
            if (order == null || order.DriverId != null || 
                (order.Status != OrderStatus.Accepted && 
                 order.Status != OrderStatus.Preparing && 
                 order.Status != OrderStatus.Ready))
                return false;

            var driver = await _context.Drivers.Include(d => d.User).FirstOrDefaultAsync(d => d.UserId == userId);
            if (driver == null || driver.User.IsBlocked) return false;

            // Business Rule: Don't allow accepting if driver has already committed to active delivery tasks,
            // unless the new order is from the same restaurant AND for the same customer (user).
            var activeOrders = await _context.Orders
                .Where(o => o.DriverId == driver.Id && 
                           (o.Status == OrderStatus.Accepted || 
                            o.Status == OrderStatus.Preparing || 
                            o.Status == OrderStatus.Ready || 
                            o.Status == OrderStatus.Picked))
                .ToListAsync();

            if (activeOrders.Any())
            {
                var sameRestaurant = activeOrders.All(o => o.RestaurantId == order.RestaurantId);
                var sameUser = activeOrders.All(o => o.UserId == order.UserId);

                if (!sameRestaurant || !sameUser)
                {
                    throw new Exception("You cannot accept this order because you already have active deliveries. You can only accept multiple orders if they are from the same restaurant and for the same customer.");
                }
            }

            order.DriverId = driver.Id;

            await _context.SaveChangesAsync();

            // Notify Customer (order group)
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

            // Notify all Drivers to refresh list
            await _hubContext.Clients.All.SendAsync("OrderStatusUpdated");

            return true;
        }

        public async Task<bool> PickupOrderAsync(Guid orderId, Guid userId)
        {
            var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.UserId == userId);
            if (driver == null) return false;

            var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId && o.DriverId == driver.Id);
            if (order == null || order.Status != OrderStatus.Ready) return false;

            order.Status = OrderStatus.Picked;

            await _context.SaveChangesAsync();

            // Notify Customer (order group)
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

            // Notify all Drivers to refresh list
            await _hubContext.Clients.All.SendAsync("OrderStatusUpdated");

            return true;
        }

        public async Task<List<ActiveOrderDto>> GetActiveOrdersAsync(Guid userId)
        {
            var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.UserId == userId);
            if (driver == null) return new List<ActiveOrderDto>();

            var activeOrders = await _context.Orders
                .Where(o => o.DriverId == driver.Id && 
                           (o.Status == OrderStatus.Accepted || 
                            o.Status == OrderStatus.Preparing || 
                            o.Status == OrderStatus.Ready || 
                            o.Status == OrderStatus.Picked))
                .Include(o => o.Restaurant)
                .Include(o => o.User)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.MenuItem)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

            var result = new List<ActiveOrderDto>();
            foreach (var order in activeOrders)
            {
                // Get customer address
                var addressText = "No Address Provided";
                double customerLat = 0;
                double customerLng = 0;
                if (order.AddressId.HasValue)
                {
                    var addr = await _context.UserAddresses.FirstOrDefaultAsync(a => a.Id == order.AddressId.Value);
                    if (addr != null)
                    {
                        addressText = $"{addr.AddressLine}, {addr.City}, {addr.State} - {addr.Pincode}";
                        customerLat = addr.Latitude;
                        customerLng = addr.Longitude;
                    }
                }

                // Get restaurant profile/address
                var restaurantAddressText = "No Address Provided";
                var restProfile = await _context.RestaurantProfiles.FirstOrDefaultAsync(p => p.UserId == order.Restaurant.OwnerId);
                if (restProfile != null)
                {
                    restaurantAddressText = restProfile.Address;
                }

                result.Add(new ActiveOrderDto
                {
                    Id = order.Id,
                    RestaurantName = order.Restaurant.Name,
                    RestaurantAddress = restaurantAddressText,
                    RestaurantLatitude = order.Restaurant.Latitude,
                    RestaurantLongitude = order.Restaurant.Longitude,
                    CustomerName = order.User.Name,
                    CustomerAddress = addressText,
                    CustomerLatitude = customerLat,
                    CustomerLongitude = customerLng,
                    TotalAmount = order.TotalAmount,
                    DeliveryFee = order.DeliveryFee,
                    Status = order.Status,
                    CreatedAt = order.CreatedAt,
                    Items = order.OrderItems.Select(oi => new AvailableOrderItemDto
                    {
                        DishName = oi.MenuItem.Name,
                        Quantity = oi.Quantity,
                        UnitPrice = oi.UnitPrice
                    }).ToList()
                });
            }

            return result;
        }

        public async Task<bool> CompleteDeliveryAsync(Guid orderId, Guid userId, string otp)
        {
            var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.UserId == userId);
            if (driver == null) return false;

            var order = await _context.Orders
                .Include(o => o.Restaurant)
                .Include(o => o.Offer)
                .Include(o => o.OrderItems)
                .FirstOrDefaultAsync(o => o.Id == orderId && o.DriverId == driver.Id);
            if (order == null || order.Status != OrderStatus.Picked) return false;

            // Retrieve and validate Hand-off OTP from Redis
            var savedOtp = await _redisService.GetDeliveryOtpAsync(orderId);
            if (savedOtp == null)
            {
                throw new Exception("Delivery verification code has expired or is invalid.");
            }
            if (savedOtp != otp?.Trim())
            {
                throw new Exception("Invalid verification code. Please request the correct 4-digit code from the customer.");
            }

            // Clean up verification state in Redis
            await _redisService.RemoveDeliveryOtpAsync(orderId);

            order.Status = OrderStatus.Delivered;

            // 1. Calculate the exact revenue splits
            decimal subtotalBeforeDiscount = order.OrderItems.Sum(oi => oi.UnitPrice * oi.Quantity);
            decimal subtotal = subtotalBeforeDiscount - order.DiscountAmount;
            
            // Commission should be calculated on the original amount before discount
            decimal adminCommission = Math.Round(subtotalBeforeDiscount * 0.15m, 2);
            decimal gstOnFood = Math.Round(subtotal * 0.05m, 2);
            
            // Base earnings for restaurant assuming they don't bear the discount
            decimal restaurantEarnings = subtotalBeforeDiscount - adminCommission + gstOnFood;

            // If coupon was created by the Restaurant, the Restaurant bears the cost of discount.
            if (order.Offer != null && order.Offer.CreatedBy == "Restaurant")
            {
                restaurantEarnings -= order.DiscountAmount;
            }

            var adminId = Guid.Parse("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b");
            var adminWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == adminId);
            if (adminWallet == null)
            {
                adminWallet = new Domain.Entities.Wallet { UserId = adminId, Balance = 0.00m };
                _context.Wallets.Add(adminWallet);
            }

            var driverWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
            if (driverWallet == null)
            {
                driverWallet = new Domain.Entities.Wallet { UserId = userId, Balance = 0.00m };
                _context.Wallets.Add(driverWallet);
            }

            // 2. Handle Driver Payout and COD Cash Collection
            if (order.PaymentMethod == PaymentMethod.COD)
            {
                // Driver collected Cash. They owe Admin (TotalAmount - DeliveryFee)
                decimal amountOwedToAdmin = order.TotalAmount - order.DeliveryFee;
                driverWallet.Balance -= amountOwedToAdmin;
                adminWallet.Balance += amountOwedToAdmin;

                // Driver Entry 1: Debt to Admin for cash collected
                var driverDebitLedger = new Domain.Entities.LedgerEntry
                {
                    EntityId = userId,
                    EntityType = Domain.Enums.LedgerEntityType.Driver,
                    Type = Domain.Enums.LedgerType.Debit,
                    Amount = order.TotalAmount,
                    OrderId = order.Id,
                    Description = $"Collected COD cash for order #{order.Id.ToString().Substring(0, 8)}"
                };
                _context.LedgerEntries.Add(driverDebitLedger);

                // Driver Entry 2: Earnings credited for the delivery
                var driverCreditLedger = new Domain.Entities.LedgerEntry
                {
                    EntityId = userId,
                    EntityType = Domain.Enums.LedgerEntityType.Driver,
                    Type = Domain.Enums.LedgerType.Credit,
                    Amount = order.DeliveryFee,
                    OrderId = order.Id,
                    Description = $"Earnings for delivery of order #{order.Id.ToString().Substring(0, 8)}"
                };
                _context.LedgerEntries.Add(driverCreditLedger);

                // Admin Entry 1: Total collected via COD
                var adminCodCreditLedger = new Domain.Entities.LedgerEntry
                {
                    EntityId = adminId,
                    EntityType = Domain.Enums.LedgerEntityType.Admin,
                    Type = Domain.Enums.LedgerType.Credit,
                    Amount = order.TotalAmount,
                    OrderId = order.Id,
                    Description = $"Collected amount via COD for order #{order.Id.ToString().Substring(0, 8)}"
                };
                _context.LedgerEntries.Add(adminCodCreditLedger);

                // Admin Entry 2: Payout to Driver (retained by driver)
                var adminDriverPayoutLedger = new Domain.Entities.LedgerEntry
                {
                    EntityId = adminId,
                    EntityType = Domain.Enums.LedgerEntityType.Admin,
                    Type = Domain.Enums.LedgerType.Debit,
                    Amount = order.DeliveryFee,
                    OrderId = order.Id,
                    Description = $"Payout to Driver (Retained from COD) for order #{order.Id.ToString().Substring(0, 8)}"
                };
                _context.LedgerEntries.Add(adminDriverPayoutLedger);
            }
            else
            {
                // Admin already has the money. Admin pays Driver the DeliveryFee.
                adminWallet.Balance -= order.DeliveryFee;
                driverWallet.Balance += order.DeliveryFee;

                var driverLedger = new Domain.Entities.LedgerEntry
                {
                    EntityId = userId,
                    EntityType = Domain.Enums.LedgerEntityType.Driver,
                    Type = Domain.Enums.LedgerType.Credit,
                    Amount = order.DeliveryFee,
                    OrderId = order.Id,
                    Description = $"Earnings for delivery of order #{order.Id.ToString().Substring(0, 8)}"
                };
                _context.LedgerEntries.Add(driverLedger);

                var adminDriverPayoutLedger = new Domain.Entities.LedgerEntry
                {
                    EntityId = adminId,
                    EntityType = Domain.Enums.LedgerEntityType.Admin,
                    Type = Domain.Enums.LedgerType.Debit,
                    Amount = order.DeliveryFee,
                    OrderId = order.Id,
                    Description = $"Payout to Driver for order #{order.Id.ToString().Substring(0, 8)}"
                };
                _context.LedgerEntries.Add(adminDriverPayoutLedger);
            }

            // 3. Pay Restaurant from Admin Wallet
            if (order.Restaurant != null)
            {
                var restaurantOwnerId = order.Restaurant.OwnerId;
                var restOwnerWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == restaurantOwnerId);
                if (restOwnerWallet == null)
                {
                    restOwnerWallet = new Domain.Entities.Wallet { UserId = restaurantOwnerId, Balance = 0.00m };
                    _context.Wallets.Add(restOwnerWallet);
                }

                restOwnerWallet.Balance += restaurantEarnings;
                adminWallet.Balance -= restaurantEarnings;

                var restLedger = new Domain.Entities.LedgerEntry
                {
                    EntityId = restaurantOwnerId,
                    EntityType = Domain.Enums.LedgerEntityType.Restaurant,
                    Type = Domain.Enums.LedgerType.Credit,
                    Amount = restaurantEarnings,
                    OrderId = order.Id,
                    Description = $"Earnings for order #{order.Id.ToString().Substring(0, 8)} (Less 15% commission)"
                };
                _context.LedgerEntries.Add(restLedger);

                var adminRestPayoutLedger = new Domain.Entities.LedgerEntry
                {
                    EntityId = adminId,
                    EntityType = Domain.Enums.LedgerEntityType.Admin,
                    Type = Domain.Enums.LedgerType.Debit,
                    Amount = restaurantEarnings,
                    OrderId = order.Id,
                    Description = $"Payout to Restaurant for order #{order.Id.ToString().Substring(0, 8)}"
                };
                _context.LedgerEntries.Add(adminRestPayoutLedger);
            }

            await _context.SaveChangesAsync();

            // Notify Customer (order group)
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

            // Notify all drivers to refresh stats and history lists
            await _hubContext.Clients.All.SendAsync("OrderStatusUpdated");

            return true;
        }

        public async Task<bool> UpdateLocationAsync(Guid userId, double latitude, double longitude)
        {
            var driver = await _context.Drivers
                .Include(d => d.User)
                .FirstOrDefaultAsync(d => d.UserId == userId);
            
            if (driver == null)
            {
                driver = new Driver
                {
                    UserId = userId,
                    IsAvailable = true,
                    Rating = 5.0
                };
                _context.Drivers.Add(driver);
                await _context.SaveChangesAsync();
                
                driver = await _context.Drivers
                    .Include(d => d.User)
                    .FirstOrDefaultAsync(d => d.UserId == userId);
                    
                if (driver == null) return false;
            }

            // 1. Update live tracking position in Redis (Option B)
            await _redisService.UpdateDriverLocationAsync(driver.Id, latitude, longitude);

            // Notify driver of any waiting orders within 20km
            if (driver.IsAvailable && driver.User.ApprovalStatus == ApprovalStatus.Approved && !driver.User.IsBlocked)
            {
                var waitingOrders = await _context.Orders
                    .Include(o => o.Restaurant)
                    .Where(o => o.DriverId == null && 
                               (o.Status == OrderStatus.Accepted || 
                                o.Status == OrderStatus.Preparing || 
                                o.Status == OrderStatus.Ready))
                    .ToListAsync();

                foreach (var order in waitingOrders)
                {
                    if (order.Restaurant != null)
                    {
                        var dist = CalculateDistance(latitude, longitude, order.Restaurant.Latitude, order.Restaurant.Longitude);
                        if (dist <= 20.0)
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
            }

            // 2. Also save to database for persistence/fallback
            var driverLoc = await _context.DriverLocations.FirstOrDefaultAsync(l => l.DriverId == driver.Id);
            if (driverLoc == null)
            {
                driverLoc = new DriverLocation
                {
                    DriverId = driver.Id,
                    Latitude = latitude,
                    Longitude = longitude,
                    UpdatedAt = DateTime.UtcNow.AddHours(5).AddMinutes(30)
                };
                _context.DriverLocations.Add(driverLoc);
            }
            else
            {
                driverLoc.Latitude = latitude;
                driverLoc.Longitude = longitude;
                driverLoc.UpdatedAt = DateTime.UtcNow.AddHours(5).AddMinutes(30);
            }
            await _context.SaveChangesAsync();

            // 3. Find if driver has any active order (Accepted, Preparing, Ready, or Picked)
            var activeOrder = await _context.Orders
                .FirstOrDefaultAsync(o => o.DriverId == driver.Id && 
                                         (o.Status == OrderStatus.Accepted || 
                                          o.Status == OrderStatus.Preparing || 
                                          o.Status == OrderStatus.Ready || 
                                          o.Status == OrderStatus.Picked));

            if (activeOrder != null)
            {
                // 4. Broadcast live coordinates to customer's SignalR order tracking group
                await _hubContext.Clients.Group(activeOrder.Id.ToString())
                    .SendAsync("DriverLocationUpdated", new
                    {
                        orderId = activeOrder.Id,
                        latitude = latitude,
                        longitude = longitude
                    });
            }

            return true;
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

        public async Task<DriverStatsDto> GetDriverStatsAsync(Guid userId)
        {
            var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.UserId == userId);
            if (driver == null)
            {
                return new DriverStatsDto();
            }

            // Wallet balance
            var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
            decimal balance = wallet?.Balance ?? 0.00m;

            // Deliveries history
            var deliveredOrders = await _context.Orders
                .Where(o => o.DriverId == driver.Id && o.Status == OrderStatus.Delivered)
                .Include(o => o.Restaurant)
                .Include(o => o.User)
                .OrderByDescending(o => o.UpdatedAt)
                .ToListAsync();

            // Fetch all ratings for this driver
            var ratings = await _context.Ratings
                .Where(r => r.DriverId == driver.Id)
                .OrderBy(r => r.CreatedAt)
                .ToListAsync();

            var history = new List<DeliveryHistoryDto>();
            foreach (var o in deliveredOrders)
            {
                Rating? matchingRating = null;
                if (o.IsRated)
                {
                    matchingRating = ratings
                        .Where(r => r.UserId == o.UserId && r.CreatedAt >= o.CreatedAt)
                        .OrderBy(r => r.CreatedAt)
                        .FirstOrDefault();
                }

                history.Add(new DeliveryHistoryDto
                {
                    OrderId = o.Id,
                    RestaurantName = o.Restaurant?.Name ?? "Unknown Restaurant",
                    CustomerName = o.User?.Name ?? "Customer",
                    TotalAmount = o.TotalAmount,
                    Earnings = o.DeliveryFee,
                    DeliveredAt = o.UpdatedAt ?? DateTime.UtcNow.AddHours(5).AddMinutes(30),
                    DriverRating = matchingRating?.Value,
                    DriverFeedback = matchingRating?.Comment
                });
            }

            decimal totalEarnings = history.Sum(h => h.Earnings);

            return new DriverStatsDto
            {
                WalletBalance = balance,
                TotalEarnings = totalEarnings,
                TotalDeliveries = history.Count,
                Rating = driver.Rating,
                DeliveryHistory = history
            };
        }

        public async Task<bool> GenerateDeliveryOtpAsync(Guid orderId, Guid userId)
        {
            var driver = await _context.Drivers.FirstOrDefaultAsync(d => d.UserId == userId);
            if (driver == null) return false;

            var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId && o.DriverId == driver.Id);
            if (order == null || order.Status != OrderStatus.Picked) return false;

            // Generate secure 4-digit Hand-off OTP
            var random = new Random();
            var otp = random.Next(1000, 10000).ToString();
            await _redisService.SetDeliveryOtpAsync(order.Id, otp);

            // Notify Customer via SignalR order group so they auto-fetch the newly generated OTP
            await _hubContext.Clients.Group(order.Id.ToString())
                .SendAsync("OrderStatusUpdated", new
                {
                    orderId = order.Id,
                    newStatus = order.Status.ToString()
                });

            return true;
        }
    }
}
