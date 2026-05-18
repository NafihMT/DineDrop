using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Domain.Entities
{
    public class RestaurantProfile : BaseEntity
    {
        public Guid UserId { get; set; }
        public string BusinessName { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string BusinessType { get; set; } = string.Empty; 
        public string RegistrationNumber { get; set; } = string.Empty;
        public string BusinessHours { get; set; } = string.Empty;
    }
}
