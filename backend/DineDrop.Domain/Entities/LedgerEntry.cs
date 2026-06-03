using DineDrop.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Domain.Entities
{
    public class LedgerEntry : BaseEntity
    {
        public Guid EntityId { get; set; }
        public LedgerEntityType EntityType { get; set; }

        public LedgerType Type { get; set; }

        public decimal Amount { get; set; }

        public Guid? OrderId { get; set; }

        public string Description { get; set; }
    }
}
