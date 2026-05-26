using DineDrop.Application.Modules.Drivers.DTOs;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace DineDrop.Application.Modules.Drivers.Interfaces
{
    public interface IDriverService
    {
        /// <summary>
        /// Returns all orders with status "Ready", grouped by restaurant.
        /// </summary>
        Task<List<AvailableOrdersByRestaurantDto>> GetAvailableOrdersAsync(Guid userId);

        /// <summary>
        /// Toggles a driver's online/offline availability status.
        /// </summary>
        Task<bool> ToggleAvailabilityAsync(Guid userId);

        /// <summary>
        /// Gets a driver's current availability status.
        /// </summary>
        Task<bool> GetAvailabilityAsync(Guid userId);

        /// <summary>
        /// Assigns a driver to a placed/accepted/preparing/ready order.
        /// </summary>
        Task<bool> AcceptOrderAsync(Guid orderId, Guid userId);

        /// <summary>
        /// Updates the order status to Picked when the driver picks up the order at the restaurant.
        /// </summary>
        Task<bool> PickupOrderAsync(Guid orderId, Guid userId);

        /// <summary>
        /// Returns active/assigned orders for the current driver.
        /// </summary>
        Task<List<ActiveOrderDto>> GetActiveOrdersAsync(Guid userId);

        /// <summary>
        /// Marks an order as delivered, updates wallets and logs ledgers.
        /// </summary>
        Task<bool> CompleteDeliveryAsync(Guid orderId, Guid userId, string otp);

        /// <summary>
        /// Updates the driver's live coordinate position in Redis and broadcasts it to order tracking groups.
        /// </summary>
        Task<bool> UpdateLocationAsync(Guid userId, double latitude, double longitude);

        /// <summary>
        /// Gets delivery stats, wallet balance, and completed delivery history for the driver.
        /// </summary>
        Task<DriverStatsDto> GetDriverStatsAsync(Guid userId);

        /// <summary>
        /// Generates a new 4-digit OTP for the delivery.
        /// </summary>
        Task<bool> GenerateDeliveryOtpAsync(Guid orderId, Guid userId);
    }
}
