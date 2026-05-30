using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Domain.Entities
{
    public class Restaurant : BaseEntity
    {
        public Guid OwnerId { get; set; }
        public User Owner { get; set; } = default!;

        public string Name { get; set; } = String.Empty;
        public string Description { get; set; } = String.Empty;

        public double Latitude { get; set; }
        public double Longitude { get; set; }

        public bool IsOpen { get; set; } = true;

        public double Rating { get; set; }

        public string? ImageUrl { get; set; }

        public ICollection<MenuItem> MenuItems { get; set; }
    }
}
