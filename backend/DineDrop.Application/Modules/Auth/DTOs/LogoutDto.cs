using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Application.Modules.Auth.DTOs
{
    public class LogoutDto
    {
        public string AccessToken { get; set; }
        public string RefreshToken { get; set; }
    }
}
