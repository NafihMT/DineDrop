using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Application.Modules.Auth.DTOs
{
    public class RefreshTokenDto
    {
        public string RefreshToken { get; set; } = default!;
    }
}
