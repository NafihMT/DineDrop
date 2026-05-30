using DineDrop.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Domain.Entities
{
    public class Order : BaseEntity
    {
        public Guid UserId { get; set; }
        public User User { get; set; }

        public Guid RestaurantId { get; set; }
        public Restaurant Restaurant { get; set; }
        public Guid? DriverId { get; set; }

        public Guid? AddressId { get; set; }

        public OrderStatus Status { get; set; }
        public PaymentStatus PaymentStatus { get; set; }

        public decimal TotalAmount { get; set; }
        public decimal DeliveryFee { get; set; }
        public decimal DiscountAmount { get; set; }

        public Guid? OfferId { get; set; }
        public Offer? Offer { get; set; }

        public bool IsRated { get; set; }
        //public ICollection<OrderItem> Items { get; set; }
        public ICollection<OrderItem> OrderItems { get; set; }
    }
}
