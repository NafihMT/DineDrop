using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using StackExchange.Redis;
using DineDrop.Application.Modules.Drivers.Interfaces;

namespace DineDrop.Infrastructure.Services
{
    public class RedisService : IRedisService
    {
        private readonly IConnectionMultiplexer _redis;
        private readonly IDatabase _db;
        private const string DriverGeoKey = "driver_locations";

        public RedisService(IConnectionMultiplexer redis)
        {
            _redis = redis;
            _db = _redis.GetDatabase();
        }

        public async Task UpdateDriverLocationAsync(Guid driverId, double latitude, double longitude)
        {
            // Note: StackExchange.Redis GeoAdd takes longitude first, then latitude
            await _db.GeoAddAsync(DriverGeoKey, longitude, latitude, driverId.ToString());
        }

        public async Task<(double Latitude, double Longitude)?> GetDriverLocationAsync(Guid driverId)
        {
            var pos = await _db.GeoPositionAsync(DriverGeoKey, driverId.ToString());
            if (pos == null)
                return null;

            return (pos.Value.Latitude, pos.Value.Longitude);
        }

        public async Task<List<Guid>> GetNearbyDriversAsync(double latitude, double longitude, double radiusKm)
        {
            // GeoRadius uses longitude first, then latitude
            var results = await _db.GeoRadiusAsync(DriverGeoKey, longitude, latitude, radiusKm, GeoUnit.Kilometers);
            
            var list = new List<Guid>();
            if (results == null) return list;

            foreach (var result in results)
            {
                if (Guid.TryParse(result.Member, out var driverId))
                {
                    list.Add(driverId);
                }
            }

            return list;
        }

        // --- DELIVERY OTP SECURITY ---

        public async Task SetDeliveryOtpAsync(Guid orderId, string otp)
        {
            var key = $"delivery_otp:{orderId}";
            await _db.StringSetAsync(key, otp, TimeSpan.FromMinutes(30));
        }

        public async Task<string?> GetDeliveryOtpAsync(Guid orderId)
        {
            var key = $"delivery_otp:{orderId}";
            var value = await _db.StringGetAsync(key);
            return value.HasValue ? value.ToString() : null;
        }

        public async Task RemoveDeliveryOtpAsync(Guid orderId)
        {
            var key = $"delivery_otp:{orderId}";
            await _db.KeyDeleteAsync(key);
        }

        // --- FLASH SURPLUS FOOD RESCUE ---

        public async Task SaveRescueDealAsync(Guid orderId, string dealJson, TimeSpan expiry)
        {
            await _db.HashSetAsync("rescue_deals", orderId.ToString(), dealJson);
        }

        public async Task<string?> GetRescueDealAsync(Guid orderId)
        {
            var value = await _db.HashGetAsync("rescue_deals", orderId.ToString());
            return value.HasValue ? value.ToString() : null;
        }

        public async Task<List<string>> GetAllRescueDealsAsync()
        {
            var hashEntries = await _db.HashGetAllAsync("rescue_deals");
            var activeDeals = new List<string>();
            var now = DateTime.UtcNow;

            foreach (var entry in hashEntries)
            {
                var json = entry.Value.ToString();
                try
                {
                    using (var doc = System.Text.Json.JsonDocument.Parse(json))
                    {
                        if (doc.RootElement.TryGetProperty("ExpiresAt", out var expiresProp))
                        {
                            var expiresAt = expiresProp.GetDateTime();
                            if (expiresAt > now)
                            {
                                activeDeals.Add(json);
                            }
                            else
                            {
                                // Remove expired item asynchronously
                                _ = _db.HashDeleteAsync("rescue_deals", entry.Name);
                            }
                        }
                    }
                }
                catch
                {
                    _ = _db.HashDeleteAsync("rescue_deals", entry.Name);
                }
            }

            return activeDeals;
        }

        public async Task RemoveRescueDealAsync(Guid orderId)
        {
            await _db.HashDeleteAsync("rescue_deals", orderId.ToString());
        }
    }
}
