using DineDrop.Domain.Entities;
using DineDrop.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Infrastructure.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<UserAddress> UserAddresses { get; set; }
        public DbSet<Restaurant> Restaurants { get; set; }
        public DbSet<MenuItem> MenuItems { get; set; }
        public DbSet<MenuCategory> MenuCategories { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderItem> OrderItems { get; set; }
        public DbSet<Cart> Carts { get; set; }
        public DbSet<CartItem> CartItems { get; set; }
        public DbSet<Driver> Drivers { get; set; }
        public DbSet<DriverLocation> DriverLocations { get; set; }
        public DbSet<Payment> Payments { get; set; }
        public DbSet<Wallet> Wallets { get; set; }
        public DbSet<LedgerEntry> LedgerEntries { get; set; }
        public DbSet<Offer> Offers { get; set; }
        public DbSet<Rating> Ratings { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<RevokedToken> RevokedTokens { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<RestaurantProfile> RestaurantProfiles { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

            modelBuilder.Entity<User>().HasData(
                new User
                {
                    Id = Guid.Parse("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b"),
                    Name = "Admin",
                    Email = "admin@dinedrop.com",
                    Phone = "9999999999",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
                    Role = UserRole.Admin,
                    ApprovalStatus = ApprovalStatus.Approved,
                    IsActive = true,
                    IsBlocked = false
                }
            );

            modelBuilder.Entity<Offer>().HasData(
                new Offer
                {
                    Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                    Code = "NEW50",
                    CreatedBy = "Platform",
                    RestaurantId = null,
                    IsActive = true,
                    Type = OfferType.Percentage,
                    Value = 50.00m,
                    MinOrderAmount = 0.00m,
                    ExpiryDate = DateTime.Parse("2030-01-01T00:00:00Z"),
                    CreatedAt = DateTime.Parse("2026-01-01T00:00:00Z")
                },
                new Offer
                {
                    Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                    Code = "FIRST50",
                    CreatedBy = "Platform",
                    RestaurantId = null,
                    IsActive = true,
                    Type = OfferType.Percentage,
                    Value = 50.00m,
                    MinOrderAmount = 0.00m,
                    ExpiryDate = DateTime.Parse("2030-01-01T00:00:00Z"),
                    CreatedAt = DateTime.Parse("2026-01-01T00:00:00Z")
                }
            );
        }
    }

}
