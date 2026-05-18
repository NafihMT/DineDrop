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
        public OfferType Type { get; set; }
        public decimal Value { get; set; }
        public decimal MinOrderAmount { get; set; }

        public DateTime ExpiryDate { get; set; }
    }
}
