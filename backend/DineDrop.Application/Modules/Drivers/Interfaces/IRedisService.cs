using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace DineDrop.Application.Modules.Drivers.Interfaces
{
    public interface IRedisService
    {
        /// <summary>
        /// Updates the driver's current coordinates in the Redis Geo index.
        /// </summary>
        Task UpdateDriverLocationAsync(Guid driverId, double latitude, double longitude);

        /// <summary>
        /// Retrieves the driver's current coordinates from the Redis Geo index.
        /// </summary>
        Task<(double Latitude, double Longitude)?> GetDriverLocationAsync(Guid driverId);

        /// <summary>
        /// Finds driver IDs within a given radius (in kilometers) from a specific coordinate.
        /// </summary>
        Task<List<Guid>> GetNearbyDriversAsync(double latitude, double longitude, double radiusKm);

        // --- DELIVERY OTP SECURITY ---
        Task SetDeliveryOtpAsync(Guid orderId, string otp);
        Task<string?> GetDeliveryOtpAsync(Guid orderId);
        Task RemoveDeliveryOtpAsync(Guid orderId);

        // --- FLASH SURPLUS FOOD RESCUE ---
        Task SaveRescueDealAsync(Guid orderId, string dealJson, TimeSpan expiry);
        Task<string?> GetRescueDealAsync(Guid orderId);
        Task<List<string>> GetAllRescueDealsAsync();
        Task RemoveRescueDealAsync(Guid orderId);
    }
}
