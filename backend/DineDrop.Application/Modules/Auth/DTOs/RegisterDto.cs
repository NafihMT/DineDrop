using DineDrop.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Application.Modules.Auth.DTOs
{
    public class RegisterDto
    {
        public string Name { get; set; } = default!;
        public string Email { get; set; } = default!;
        public string Phone { get; set; } = default!;
        public string Password { get; set; } = default!;
        public UserRole? Role { get; set; }
    }
}
