using DineDrop.Domain.Entities;
using DineDrop.Domain.Enums;

public class User : BaseEntity
{
    public string Name { get; set; }
    public string Email { get; set; }
    public string Phone { get; set; }
    public string PasswordHash { get; set; }

    public UserRole Role { get; set; }

    public ApprovalStatus ApprovalStatus { get; set; } = ApprovalStatus.Pending;

    public bool IsActive { get; set; } = true;
    public bool IsBlocked { get; set; } = false;

    public ICollection<UserAddress> Addresses { get; set; }
}