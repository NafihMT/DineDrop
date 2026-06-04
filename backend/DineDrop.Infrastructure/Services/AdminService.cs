using DineDrop.Application.Modules.Admin.DTOs;
using DineDrop.Application.Modules.Admin.Interfaces;
using DineDrop.Domain.Enums;
using DineDrop.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DineDrop.Infrastructure.Services
{
    public class AdminService : IAdminService
    {
        private readonly AppDbContext _context;

        public AdminService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<RestaurantRequestDto>> GetPendingRestaurantsAsync()
        {
            var pendingRestaurants = await _context.Users
                .Where(u => u.Role == UserRole.Restaurant && u.ApprovalStatus == ApprovalStatus.Pending)
                .Join(_context.RestaurantProfiles,
                    u => u.Id,
                    p => p.UserId,
                    (u, p) => new RestaurantRequestDto
                    {
                        UserId = u.Id,
                        Name = u.Name,
                        Email = u.Email,
                        Phone = u.Phone,
                        BusinessName = p.BusinessName,
                        BusinessType = p.BusinessType,
                        CreatedAt = u.CreatedAt
                    })
                .ToListAsync();

            return pendingRestaurants;
        }

        public async Task ApproveRestaurantAsync(Guid userId, bool isApproved)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId && u.Role == UserRole.Restaurant);

            if (user == null)
                throw new Exception("Restaurant request not found.");

            if (isApproved)
            {
                user.ApprovalStatus = ApprovalStatus.Approved;
                user.IsActive = true;
                
                var restaurant = await _context.Restaurants
                    .FirstOrDefaultAsync(r => r.OwnerId == userId);
                if (restaurant != null)
                {
                    restaurant.IsOpen = true;
                }
            }
            else
            {
                user.ApprovalStatus = ApprovalStatus.Rejected;
                user.IsActive = false;
            }

            await _context.SaveChangesAsync();
        }

        public async Task<AdminStatsDto> GetStatsAsync()
        {
            var totalRestaurants = await _context.Users.CountAsync(u => u.Role == UserRole.Restaurant && u.ApprovalStatus == ApprovalStatus.Approved);
            var pendingRequests = await _context.Users.CountAsync(u => u.Role == UserRole.Restaurant && u.ApprovalStatus == ApprovalStatus.Pending);
            var totalUsers = await _context.Users.CountAsync(u => u.Role == UserRole.User);
            var activeOrders = await _context.Orders.CountAsync(o => 
                o.Status == OrderStatus.Placed || 
                o.Status == OrderStatus.Accepted || 
                o.Status == OrderStatus.Preparing || 
                o.Status == OrderStatus.Ready || 
                o.Status == OrderStatus.Picked);
                
            var adminWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.User.Role == UserRole.Admin);
            var totalRevenue = adminWallet?.Balance ?? 0m;
            
            // Only count drivers who are currently online (IsAvailable == true) and not blocked
            var totalDrivers = await _context.Drivers.CountAsync(d => 
                d.IsAvailable && 
                d.User.ApprovalStatus == ApprovalStatus.Approved && 
                !d.User.IsBlocked);
                
            var pendingDrivers = await _context.Users.CountAsync(u => u.Role == UserRole.Driver && u.ApprovalStatus == ApprovalStatus.Pending);

            return new AdminStatsDto
            {
                TotalRestaurants = totalRestaurants,
                PendingRequests = pendingRequests,
                TotalUsers = totalUsers,
                ActiveOrders = activeOrders,
                TotalRevenue = totalRevenue,
                TotalDrivers = totalDrivers,
                PendingDrivers = pendingDrivers
            };
        }

        public async Task<IEnumerable<AdminRestaurantDto>> GetAllRestaurantsAsync()
        {
            var users = await _context.Users
                .Where(u => u.Role == UserRole.Restaurant)
                .ToListAsync();

            var profiles = await _context.RestaurantProfiles.ToListAsync();
            var restaurants = await _context.Restaurants.ToListAsync();

            var list = from u in users
                       join p in profiles on u.Id equals p.UserId into pGroup
                       from p in pGroup.DefaultIfEmpty()
                       join r in restaurants on u.Id equals r.OwnerId into rGroup
                       from r in rGroup.DefaultIfEmpty()
                       orderby u.CreatedAt descending
                       select new AdminRestaurantDto
                       {
                           UserId = u.Id,
                           Name = u.Name,
                           Email = u.Email,
                           Phone = u.Phone,
                           BusinessName = p?.BusinessName ?? u.Name,
                           BusinessType = p?.BusinessType ?? "General",
                           Address = p?.Address ?? string.Empty,
                           ApprovalStatus = u.ApprovalStatus.ToString(),
                           IsOpen = r?.IsOpen ?? false,
                           IsActive = u.IsActive,
                           IsBlocked = u.IsBlocked,
                           CreatedAt = u.CreatedAt
                       };

            return list;
        }

        public async Task<IEnumerable<AdminUserDto>> GetAllUsersAsync()
        {
            return await _context.Users
                .Where(u => u.Role == UserRole.User)
                .OrderByDescending(u => u.CreatedAt)
                .Select(u => new AdminUserDto
                {
                    Id = u.Id,
                    Name = u.Name,
                    Email = u.Email,
                    Phone = u.Phone,
                    Role = u.Role.ToString(),
                    IsActive = u.IsActive,
                    IsBlocked = u.IsBlocked,
                    CreatedAt = u.CreatedAt
                })
                .ToListAsync();
        }

        public async Task ToggleUserBlockStatusAsync(Guid userId)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId && u.Role != UserRole.Admin);
            if (user != null)
            {
                user.IsBlocked = !user.IsBlocked;
                user.IsActive = !user.IsBlocked;
                await _context.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<AdminOrderDto>> GetAllOrdersAsync()
        {
            return await _context.Orders
                .Include(o => o.User)
                .Include(o => o.Restaurant)
                .OrderByDescending(o => o.CreatedAt)
                .Select(o => new AdminOrderDto
                {
                    Id = o.Id,
                    CustomerName = o.User != null ? o.User.Name : "Guest",
                    RestaurantName = o.Restaurant != null ? o.Restaurant.Name : "Unknown",
                    TotalAmount = o.TotalAmount,
                    Status = o.Status.ToString(),
                    PaymentStatus = o.PaymentStatus.ToString(),
                    CreatedAt = o.CreatedAt
                })
                .ToListAsync();
        }

        public async Task<IEnumerable<AdminDriverDto>> GetAllDriversAsync()
        {
            var driverUsers = await _context.Users
                .Where(u => u.Role == UserRole.Driver)
                .OrderByDescending(u => u.CreatedAt)
                .ToListAsync();

            var driverEntities = await _context.Drivers.ToListAsync();

            var result = from u in driverUsers
                         join d in driverEntities on u.Id equals d.UserId into dGroup
                         from d in dGroup.DefaultIfEmpty()
                         select new AdminDriverDto
                         {
                             UserId = u.Id,
                             Name = u.Name,
                             Email = u.Email,
                             Phone = u.Phone ?? string.Empty,
                             ApprovalStatus = u.ApprovalStatus.ToString(),
                             IsBlocked = u.IsBlocked,
                             IsAvailable = d?.IsAvailable ?? false,
                             CreatedAt = u.CreatedAt
                         };

            return result;
        }

        public async Task ApproveDriverAsync(Guid userId, bool isApproved)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId && u.Role == UserRole.Driver);

            if (user == null)
                throw new Exception("Driver not found.");

            user.ApprovalStatus = isApproved ? ApprovalStatus.Approved : ApprovalStatus.Rejected;
            user.IsActive = isApproved;
            await _context.SaveChangesAsync();
        }

        public async Task ToggleDriverBlockAsync(Guid userId)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId && u.Role == UserRole.Driver);

            if (user != null)
            {
                user.IsBlocked = !user.IsBlocked;
                user.IsActive = !user.IsBlocked;
                await _context.SaveChangesAsync();
            }
        }
    }
}
