using System;

namespace DineDrop.Domain.Entities
{
    public class RevokedToken : BaseEntity
    {
        public string Token { get; set; } = default!;
        public DateTime RevokedAt { get; set; } = DateTime.UtcNow;
    }
}
