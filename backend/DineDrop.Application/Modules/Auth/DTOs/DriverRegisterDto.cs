using System;

namespace DineDrop.Application.Modules.Auth.DTOs
{
    public class DriverRegisterDto : RegisterDto
    {
        public string VehicleType { get; set; } = default!;    // e.g. Bike, Car, Scooter
        public string LicenseNumber { get; set; } = default!;
        public string? VehicleNumber { get; set; }
    }
}
