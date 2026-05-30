using DineDrop.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Domain.Entities
{
    public class Offer : BaseEntity
    {
        public string Code { get; set; } = string.Empty;
        public string CreatedBy { get; set; } = "Platform"; // "Platform" or "Restaurant"
        public Guid? RestaurantId { get; set; }
        public bool IsActive { get; set; } = true;

        public OfferType Type { get; set; }
        public decimal Value { get; set; }
        public decimal MinOrderAmount { get; set; }

        public DateTime ExpiryDate { get; set; }
    }
}
