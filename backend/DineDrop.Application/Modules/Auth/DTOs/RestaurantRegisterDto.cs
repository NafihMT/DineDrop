using DineDrop.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Application.Modules.Auth.DTOs
{
    public class RestaurantRegisterDto : RegisterDto
    {
        // Business Details for RestaurantProfile
        public string BusinessName { get; set; } = default!;
        public string Address { get; set; } = default!;
        public string BusinessType { get; set; } = default!;
        public string RegistrationNumber { get; set; } = default!;
        public string BusinessHours { get; set; } = default!;

        // Basic details for Restaurant entity (Location etc)
        public string Description { get; set; } = default!;
        public double Latitude { get; set; }
        public double Longitude { get; set; }
    }
}
