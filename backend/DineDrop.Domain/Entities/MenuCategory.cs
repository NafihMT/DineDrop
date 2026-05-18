using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Domain.Entities
{
    public class MenuCategory : BaseEntity
    {
        public Guid RestaurantId { get; set; }
        public string Name { get; set; }
        public Restaurant Restaurant { get; set; }
    }
}
