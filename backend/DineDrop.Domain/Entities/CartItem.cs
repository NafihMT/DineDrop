using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Domain.Entities
{
    public class CartItem : BaseEntity
    {
        public Guid CartId { get; set; }
        public Guid MenuItemId { get; set; }

        public int Quantity { get; set; }

        public Cart Cart { get; set; }
        public MenuItem MenuItem { get; set; }
    }
}
