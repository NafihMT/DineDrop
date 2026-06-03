
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Domain.Enums
{
    public enum OrderStatus
    {
        Placed,
        Accepted,
        Preparing,
        Ready,
        Picked,
        Delivered,
        Cancelled
    }
}
