using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Domain.Entities
{
    public class MenuItem : BaseEntity
    {
        public Guid RestaurantId { get; set; }
        public Guid CategoryId { get; set; }

        public string Name { get; set; }
        public string Description { get; set; }

        public decimal Price { get; set; }
        public string? ImageUrl { get; set; }
        public bool IsAvailable { get; set; } = true;
        public bool IsVeg { get; set; } = true;

        public Restaurant Restaurant { get; set; }
        public MenuCategory Category { get; set; }
    }
}
