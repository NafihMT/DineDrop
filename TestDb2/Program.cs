using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using DineDrop.Infrastructure.Data;
using DineDrop.Domain.Entities;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer("Server=.;Database=DineDropDb;Trusted_Connection=True;TrustServerCertificate=True;")
            .Options;
            
        using var context = new AppDbContext(options);
        
        try
        {
            var userId = Guid.Parse("f7345344-a13c-45b5-0837-08dea50a7f16"); // some random user ID from the Users table I checked
            var restaurantId = context.Restaurants.First().Id;
            var menuItem = context.MenuItems.First();
            
            var order = new Order
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                RestaurantId = restaurantId,
                Status = DineDrop.Domain.Enums.OrderStatus.Placed,
                PaymentStatus = DineDrop.Domain.Enums.PaymentStatus.Pending,
                PaymentMethod = DineDrop.Domain.Enums.PaymentMethod.Wallet,
                TotalAmount = 10,
                DeliveryFee = 5
            };
            
            var orderItem = new OrderItem
            {
                MenuItemId = menuItem.Id,
                Quantity = 1,
                UnitPrice = menuItem.Price
            };
            order.OrderItems = new System.Collections.Generic.List<OrderItem> { orderItem };

            context.Orders.Add(order);

            var ledger = new LedgerEntry
            {
                EntityId = userId,
                EntityType = DineDrop.Domain.Enums.LedgerEntityType.User,
                Type = DineDrop.Domain.Enums.LedgerType.Debit,
                Amount = 10,
                OrderId = order.Id,
                Description = "Test"
            };
            context.LedgerEntries.Add(ledger);
            
            var adminId = Guid.Parse("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b");
            var adminLedger = new LedgerEntry
            {
                EntityId = adminId,
                EntityType = DineDrop.Domain.Enums.LedgerEntityType.Admin,
                Type = DineDrop.Domain.Enums.LedgerType.Credit,
                Amount = 10,
                OrderId = order.Id,
                Description = "Test Admin"
            };
            context.LedgerEntries.Add(adminLedger);
            
            var wallet = new Wallet { UserId = userId, Balance = 90 };
            context.Wallets.Add(wallet);

            await context.SaveChangesAsync();
            Console.WriteLine("Success!");
        }
        catch (DbUpdateException ex)
        {
            Console.WriteLine("DbUpdateException!");
            Console.WriteLine("Inner Exception: " + ex.InnerException?.Message);
        }
        catch (Exception ex)
        {
            Console.WriteLine("Other Exception: " + ex.Message);
        }
    }
}
