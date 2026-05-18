using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Domain.Entities
{
    public class Rating : BaseEntity
    {
        public Guid UserId { get; set; }

        public Guid? RestaurantId { get; set; }
        public Guid? DriverId { get; set; }

        public int Value { get; set; }
        public string Comment { get; set; }
    }
}
