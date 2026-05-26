using DineDrop.Application.Modules.Auth.DTOs;
using DineDrop.Application.Modules.Auth.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace DineDrop.API.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterDto dto)
        {
            var result = await _authService.RegisterAsync(dto);
            SetTokenCookies(result.Token, result.RefreshToken);
            return Ok(result);
        }

        [HttpPost("register-restaurant")]
        public async Task<IActionResult> RegisterRestaurant(RestaurantRegisterDto dto)
        {
            var result = await _authService.RegisterRestaurantAsync(dto);
            SetTokenCookies(result.Token, result.RefreshToken);
            return Ok(result);
        }

        [HttpPost("register-driver")]
        public async Task<IActionResult> RegisterDriver(DriverRegisterDto dto)
        {
            var result = await _authService.RegisterDriverAsync(dto);
            SetTokenCookies(result.Token, result.RefreshToken);
            return Ok(result);
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginDto dto)
        {
            var result = await _authService.LoginAsync(dto);
            SetTokenCookies(result.Token, result.RefreshToken);
            return Ok(result);
        }

        [HttpPost("google")]
        public async Task<IActionResult> GoogleLogin(GoogleLoginDto dto)
        {
            var result = await _authService.GoogleLoginAsync(dto.Token);
            SetTokenCookies(result.Token, result.RefreshToken);
            return Ok(result);
        }

        private void SetTokenCookies(string token, string refreshToken)
        {
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = true, 
                SameSite = SameSiteMode.Lax
            };

            // Access Token
            Response.Cookies.Append("jwtToken", token, new CookieOptions 
            { 
                HttpOnly = true, 
                Secure = false, // Set to false for localhost testing
                SameSite = SameSiteMode.Lax,
                Expires = DateTime.UtcNow.AddHours(2) 
            });

            // Refresh Token
            Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions 
            { 
                HttpOnly = true, 
                Secure = false, // Set to false for localhost testing
                SameSite = SameSiteMode.Lax,
                Expires = DateTime.UtcNow.AddDays(7) 
            });
        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout([FromBody] LogoutDto? dto)
        {
            var accessToken = Request.Cookies["jwtToken"] ?? dto?.AccessToken;
            var rToken = Request.Cookies["refreshToken"] ?? dto?.RefreshToken;

            if (string.IsNullOrEmpty(accessToken) || string.IsNullOrEmpty(rToken))
                return BadRequest("Missing tokens for logout");

            try 
            {
                await _authService.LogoutAsync(accessToken, rToken);
            }
            catch (Exception) 
            {
                // We still want to clear cookies even if service logic fails 
                // (e.g. token already revoked)
            }
            
            Response.Cookies.Delete("jwtToken");
            Response.Cookies.Delete("refreshToken");
            
            return Ok(new { message = "Logged out successfully" });
        }

        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh()
        {
            var refreshToken = Request.Cookies["refreshToken"];
            if (string.IsNullOrEmpty(refreshToken))
                return BadRequest("Refresh token is missing");

            var result = await _authService.RefreshAsync(refreshToken);
            SetTokenCookies(result.Token, result.RefreshToken);
            return Ok(result);
        }

        [Authorize]
        [HttpGet("verify")]
        public IActionResult Verify()
        {
            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            return Ok(new { role });
        }
    }
}
