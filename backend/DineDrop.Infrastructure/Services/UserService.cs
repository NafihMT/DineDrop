using DineDrop.Application.Modules.Restaurants.DTOs;
using DineDrop.Application.Modules.Users.DTOs;
using DineDrop.Application.Modules.Users.Interfaces;
using DineDrop.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Infrastructure.Services
{
    public class UserService : IUserService
    {
        private readonly AppDbContext _context;
        public UserService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<RestaurantProfileDto>> GetAllRestaurantAsync()
        {
            var restaurants = await _context.Restaurants
                    .Include(r => r.Owner)
                    .OrderByDescending(r => r.Rating)
                    .Select(r => new RestaurantProfileDto
                    {
                        Id = r.Id,
                        Name = r.Name,
                        Description = r.Description,
                        IsOpen = r.IsOpen,
                        Rating = r.Rating,
                        Latitude = r.Latitude,
                        Longitude = r.Longitude,
                        ImageUrl = r.ImageUrl,
                        ContactNumber = r.Owner.Phone,
                        Address = _context.RestaurantProfiles.Where(p => p.UserId == r.OwnerId).Select(p => p.Address).FirstOrDefault() ?? string.Empty,
                        DishCount = _context.MenuItems.Count(m => m.RestaurantId == r.Id && !m.IsDeleted && m.IsAvailable)
                    }).ToListAsync();

            var menuItems = await _context.MenuItems
                .Include(m => m.Category)
                .Where(m => !m.IsDeleted && m.IsAvailable)
                .ToListAsync();

            foreach (var r in restaurants)
            {
                r.Categories = menuItems
                    .Where(m => m.RestaurantId == r.Id)
                    .Select(m => m.Category != null ? m.Category.Name : "General")
                    .Distinct()
                    .ToList();
            }

            return restaurants;
        }

        public async Task<IEnumerable<MenuItemDto>> GetAllDishesAsync()
        {
            return await _context.MenuItems
                .Include(m => m.Category)
                .Include(m => m.Restaurant)
                .Where(m => !m.IsDeleted)
                .Select(m => new MenuItemDto
                {
                    Id = m.Id,
                    Name = m.Name,
                    Description = m.Description,
                    Price = m.Price,
                    ImageUrl = m.ImageUrl,
                    CategoryName = m.Category != null ? m.Category.Name : "General",
                    RestaurantId = m.RestaurantId,
                    RestaurantName = m.Restaurant.Name,
                    RestaurantLatitude = m.Restaurant.Latitude,
                    RestaurantLongitude = m.Restaurant.Longitude,
                    RestaurantIsOpen = m.Restaurant.IsOpen,
                    IsAvailable = m.IsAvailable,
                    IsVeg = m.IsVeg
                }).ToListAsync();
        }

        public async Task<IEnumerable<MenuItemDto>> GetRestaurantMenuAsync(Guid restaurantId)
        {
            return await _context.MenuItems
                .Include(m => m.Category)
                .Where(m => m.RestaurantId == restaurantId && !m.IsDeleted)
                .Select(m => new MenuItemDto
                {
                    Id = m.Id,
                    Name = m.Name,
                    Description = m.Description,
                    Price = m.Price,
                    ImageUrl = m.ImageUrl,
                    CategoryName = m.Category != null ? m.Category.Name : "General",
                    IsAvailable = m.IsAvailable,
                    IsVeg = m.IsVeg
                }).ToListAsync();
        }
        public async Task<UserProfileDto?> GetUserProfileAsync(Guid userId)
        {
            var user = await _context.Users
                .Include(u => u.Addresses)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return null;

            var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
            if (wallet == null)
            {
                wallet = new Domain.Entities.Wallet { UserId = userId, Balance = 0.00m };
                _context.Wallets.Add(wallet);
                await _context.SaveChangesAsync();
            }

            return new UserProfileDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                Phone = user.Phone ?? string.Empty,
                ProfileImageUrl = user.ProfileImageUrl,
                DateOfBirth = user.DateOfBirth,
                Gender = user.Gender,
                WalletBalance = wallet.Balance,
                Addresses = user.Addresses.OrderByDescending(a => a.CreatedAt).Select(a => new UserAddressDto
                {
                    Id = a.Id,
                    AddressLine = a.AddressLine ?? string.Empty,
                    City = a.City ?? string.Empty,
                    State = a.State ?? string.Empty,
                    Pincode = a.Pincode ?? string.Empty,
                    Latitude = a.Latitude,
                    Longitude = a.Longitude,
                    IsDefault = a.IsDefault
                }).ToList()
            };
        }

        public async Task<bool> UpdateUserProfileAsync(Guid userId, UpdateUserProfileDto dto)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return false;

            user.Name = dto.Name;
            user.Phone = dto.Phone;
            user.ProfileImageUrl = dto.ProfileImageUrl;
            user.DateOfBirth = dto.DateOfBirth;
            user.Gender = dto.Gender;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<UserAddressDto> AddUserAddressAsync(Guid userId, AddUserAddressDto dto)
        {
            if (dto.IsDefault)
            {
                var existingDefaults = await _context.UserAddresses.Where(a => a.UserId == userId && a.IsDefault).ToListAsync();
                foreach (var d in existingDefaults) d.IsDefault = false;
            }

            var address = new Domain.Entities.UserAddress
            {
                UserId = userId,
                AddressLine = dto.AddressLine,
                City = dto.City,
                State = dto.State,
                Pincode = dto.Pincode,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                IsDefault = dto.IsDefault
            };

            _context.UserAddresses.Add(address);
            await _context.SaveChangesAsync();

            return new UserAddressDto
            {
                Id = address.Id,
                AddressLine = address.AddressLine,
                City = address.City,
                State = address.State,
                Pincode = address.Pincode,
                Latitude = address.Latitude,
                Longitude = address.Longitude,
                IsDefault = address.IsDefault
            };
        }

        public async Task<bool> DeleteUserAddressAsync(Guid userId, Guid addressId)
        {
            var address = await _context.UserAddresses.FirstOrDefaultAsync(a => a.Id == addressId && a.UserId == userId);
            if (address == null) return false;

            _context.UserAddresses.Remove(address);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<UserAddressDto?> UpdateUserAddressAsync(Guid userId, Guid addressId, AddUserAddressDto dto)
        {
            var address = await _context.UserAddresses.FirstOrDefaultAsync(a => a.Id == addressId && a.UserId == userId);
            if (address == null) return null;

            if (dto.IsDefault)
            {
                var existingDefaults = await _context.UserAddresses.Where(a => a.UserId == userId && a.IsDefault && a.Id != addressId).ToListAsync();
                foreach (var d in existingDefaults) d.IsDefault = false;
            }

            address.AddressLine = dto.AddressLine;
            address.City = dto.City;
            address.State = dto.State;
            address.Pincode = dto.Pincode;
            address.Latitude = dto.Latitude;
            address.Longitude = dto.Longitude;
            address.IsDefault = dto.IsDefault;

            await _context.SaveChangesAsync();

            return new UserAddressDto
            {
                Id = address.Id,
                AddressLine = address.AddressLine,
                City = address.City,
                State = address.State,
                Pincode = address.Pincode,
                Latitude = address.Latitude,
                Longitude = address.Longitude,
                IsDefault = address.IsDefault
            };
        }

        public async Task<decimal> AddWalletFundsAsync(Guid userId, decimal amount)
        {
            var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
            if (wallet == null)
            {
                wallet = new Domain.Entities.Wallet { UserId = userId, Balance = amount };
                _context.Wallets.Add(wallet);
            }
            else
            {
                wallet.Balance += amount;
            }

            var ledger = new Domain.Entities.LedgerEntry
            {
                EntityId = userId,
                EntityType = Domain.Enums.LedgerEntityType.User,
                Type = Domain.Enums.LedgerType.Credit,
                Amount = amount,
                Description = $"Added funds to wallet via direct deposit"
            };
            _context.LedgerEntries.Add(ledger);

            await _context.SaveChangesAsync();
            return wallet.Balance;
        }

        public async Task<decimal> WithdrawWalletFundsAsync(Guid userId, decimal amount)
        {
            if (amount <= 0) throw new Exception("Withdrawal amount must be greater than zero.");

            var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
            if (wallet == null || wallet.Balance < amount)
            {
                throw new Exception("Insufficient funds.");
            }

            wallet.Balance -= amount;

            var ledger = new Domain.Entities.LedgerEntry
            {
                EntityId = userId,
                // Determine entity type based on user role
                EntityType = _context.Users.FirstOrDefault(u => u.Id == userId)?.Role switch
                {
                    Domain.Enums.UserRole.Admin => Domain.Enums.LedgerEntityType.Admin,
                    Domain.Enums.UserRole.Restaurant => Domain.Enums.LedgerEntityType.Restaurant,
                    Domain.Enums.UserRole.Driver => Domain.Enums.LedgerEntityType.Driver,
                    _ => Domain.Enums.LedgerEntityType.User
                },
                Type = Domain.Enums.LedgerType.Debit,
                Amount = amount,
                Description = $"Withdrawal to Bank Account"
            };
            _context.LedgerEntries.Add(ledger);

            await _context.SaveChangesAsync();
            return wallet.Balance;
        }

        public async Task<WalletDetailsDto> GetWalletDetailsAsync(Guid userId)
        {
            var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
            if (wallet == null)
            {
                wallet = new Domain.Entities.Wallet { UserId = userId, Balance = 0.00m };
                _context.Wallets.Add(wallet);
                await _context.SaveChangesAsync();
            }

            var ledgers = await _context.LedgerEntries
                .Where(l => l.EntityId == userId)
                .OrderByDescending(l => l.CreatedAt)
                .Select(l => new LedgerEntryDto
                {
                    Id = l.Id,
                    Type = l.Type.ToString(),
                    Amount = l.Amount,
                    Description = l.Description,
                    CreatedAt = l.CreatedAt,
                    OrderId = l.OrderId
                })
                .ToListAsync();

            return new WalletDetailsDto
            {
                Balance = wallet.Balance,
                History = ledgers
            };
        }
        public async Task<bool> RateRestaurantAsync(Guid userId, Guid restaurantId, RateRestaurantDto dto)
        {
            var restaurant = await _context.Restaurants.FindAsync(restaurantId);
            if (restaurant == null) return false;

            var restRating = new Domain.Entities.Rating
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                RestaurantId = restaurantId,
                Value = dto.Rating,
                Comment = dto.Feedback ?? string.Empty
            };
            _context.Ratings.Add(restRating);

            var allRestRatings = await _context.Ratings
                .Where(r => r.RestaurantId == restaurantId)
                .Select(r => r.Value)
                .ToListAsync();
            allRestRatings.Add(dto.Rating);
            restaurant.Rating = allRestRatings.Average();

            await _context.SaveChangesAsync();
            return true;
        }
    }
}
