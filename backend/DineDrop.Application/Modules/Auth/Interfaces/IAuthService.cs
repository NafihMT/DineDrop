using DineDrop.Application.Modules.Auth.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Application.Modules.Auth.Interfaces
{
    public interface IAuthService
    {
        Task<AuthResponseDto> RegisterAsync(RegisterDto dto);
        Task<AuthResponseDto> RegisterRestaurantAsync(RestaurantRegisterDto dto);
        Task<AuthResponseDto> LoginAsync(LoginDto dto);
        Task<AuthResponseDto> GoogleLoginAsync(string token);
        Task<AuthResponseDto> RefreshAsync(string refreshToken);
        Task LogoutAsync(string accessToken, string refreshToken);
    }
}
