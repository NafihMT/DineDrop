using DineDrop.Application.Modules.Auth.DTOs;
using DineDrop.Application.Modules.Auth.Interfaces;
using DineDrop.Domain.Entities;
using DineDrop.Domain.Enums;
using DineDrop.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Net.Http;
using System.Text.Json;
namespace DineDrop.Infrastructure.Services
{
    public class AuthService : IAuthService
    {
        private readonly AppDbContext _context;
        private readonly IJwtService _jwtService;

        public AuthService(AppDbContext context, IJwtService jwtService)
        {
            _context = context;
            _jwtService = jwtService;
        }


        private string GenerateRefreshToken()
        {
            return Guid.NewGuid().ToString();
        }

        public async Task<AuthResponseDto> RegisterAsync(RegisterDto dto)
        {
            if (await _context.Users.AnyAsync(x => x.Email == dto.Email))
                throw new Exception("Email already exists");

            var user = new User
            {
                Name = dto.Name,
                Email = dto.Email,
                Phone = dto.Phone,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),

                Role = dto.Role ?? UserRole.User,

                ApprovalStatus = (dto.Role == UserRole.User || dto.Role == null)
                     ? ApprovalStatus.Approved
                     : ApprovalStatus.Pending
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var refreshToken = new RefreshToken
            {
                UserId = user.Id,
                Token = GenerateRefreshToken(),
                ExpiryDate = DateTime.UtcNow.AddHours(5).AddMinutes(30).AddDays(7)
            };

            _context.RefreshTokens.Add(refreshToken);
            await _context.SaveChangesAsync();

            return new AuthResponseDto
            {
                Token = _jwtService.GenerateToken(user),
                RefreshToken = refreshToken.Token
            };

        }

        public async Task<AuthResponseDto> RegisterRestaurantAsync(RestaurantRegisterDto dto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                if (await _context.Users.AnyAsync(x => x.Email == dto.Email))
                    throw new Exception("Email already exists");

                var user = new User
                {
                    Name = dto.Name,
                    Email = dto.Email,
                    Phone = dto.Phone,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                    Role = UserRole.Restaurant,
                    ApprovalStatus = ApprovalStatus.Pending
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                var profile = new RestaurantProfile
                {
                    UserId = user.Id,
                    BusinessName = dto.BusinessName,
                    Address = dto.Address,
                    BusinessType = dto.BusinessType,
                    RegistrationNumber = dto.RegistrationNumber,
                    BusinessHours = dto.BusinessHours
                };
                _context.RestaurantProfiles.Add(profile);

                
                var restaurant = new Restaurant
                {
                    OwnerId = user.Id,
                    Name = dto.BusinessName,
                    Description = dto.Description,
                    Latitude = dto.Latitude,
                    Longitude = dto.Longitude,
                    IsOpen = false 
                };
                _context.Restaurants.Add(restaurant);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                var refreshToken = new RefreshToken
                {
                    UserId = user.Id,
                    Token = GenerateRefreshToken(),
                    ExpiryDate = DateTime.UtcNow.AddHours(5).AddMinutes(30).AddDays(7)
                };

                _context.RefreshTokens.Add(refreshToken);
                await _context.SaveChangesAsync();

                return new AuthResponseDto
                {
                    Token = _jwtService.GenerateToken(user),
                    RefreshToken = refreshToken.Token,
                    Role = user.Role.ToString()
                };
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<AuthResponseDto> RegisterDriverAsync(DriverRegisterDto dto)
        {
            if (await _context.Users.AnyAsync(x => x.Email == dto.Email))
                throw new Exception("Email already exists");

            var user = new User
            {
                Name = dto.Name,
                Email = dto.Email,
                Phone = dto.Phone,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = UserRole.Driver,
                ApprovalStatus = ApprovalStatus.Pending
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            // Store driver-specific info
            var driver = new Driver
            {
                UserId = user.Id,
                IsAvailable = false
            };
            _context.Drivers.Add(driver);
            await _context.SaveChangesAsync();

            var refreshToken = new RefreshToken
            {
                UserId = user.Id,
                Token = GenerateRefreshToken(),
                ExpiryDate = DateTime.UtcNow.AddHours(5).AddMinutes(30).AddDays(7)
            };

            _context.RefreshTokens.Add(refreshToken);
            await _context.SaveChangesAsync();

            return new AuthResponseDto
            {
                Token = _jwtService.GenerateToken(user),
                RefreshToken = refreshToken.Token,
                Role = user.Role.ToString()
            };
        }



        public async Task<AuthResponseDto> LoginAsync(LoginDto dto)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(x => x.Email == dto.Email);

            if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                throw new Exception("Invalid credentials");

            if (!user.IsActive || user.IsBlocked)
                throw new Exception("User is not allowed");

            if (user.ApprovalStatus != ApprovalStatus.Approved)
                throw new Exception("Your account is pending admin approval");

            var refreshToken = new RefreshToken
            {
                UserId = user.Id,
                Token = GenerateRefreshToken(),
                ExpiryDate = DateTime.UtcNow.AddHours(5).AddMinutes(30).AddDays(7)
            };

            _context.RefreshTokens.Add(refreshToken);
            await _context.SaveChangesAsync();

            return new AuthResponseDto
            {
                Token = _jwtService.GenerateToken(user),
                RefreshToken = refreshToken.Token,
                Role = user.Role.ToString()
            };
        }

        public async Task<AuthResponseDto> RefreshAsync(string refreshToken)
        {
            var token = await _context.RefreshTokens
                .Include(x => x.User)
                .FirstOrDefaultAsync(x => x.Token == refreshToken);

            if (token == null)
                throw new Exception("Invalid refresh token");

          
            if (token.IsRevoked)
            {
                var activeTokens = await _context.RefreshTokens
                    .Where(t => t.UserId == token.UserId && !t.IsRevoked)
                    .ToListAsync();
                
                foreach (var t in activeTokens) t.IsRevoked = true;
                await _context.SaveChangesAsync();
                
                throw new Exception("Security Breach Detected: This token has already been used. All sessions invalidated.");
            }

            if (token.ExpiryDate < DateTime.UtcNow.AddHours(5).AddMinutes(30))
                throw new Exception("Refresh token expired");

            token.IsRevoked = true;

            var newRefreshToken = new RefreshToken
            {
                UserId = token.UserId,
                Token = GenerateRefreshToken(),
                ExpiryDate = DateTime.UtcNow.AddHours(5).AddMinutes(30).AddDays(7)
            };

            _context.RefreshTokens.Add(newRefreshToken);
            await _context.SaveChangesAsync();

            var newJwt = _jwtService.GenerateToken(token.User);

            return new AuthResponseDto
            {
                Token = newJwt,
                RefreshToken = newRefreshToken.Token,
                Role = token.User.Role.ToString()
            };
        }

        public async Task<AuthResponseDto> GoogleLoginAsync(string token)
        {
            using var httpClient = new HttpClient();
            var response = await httpClient.GetAsync($"https://www.googleapis.com/oauth2/v3/userinfo?access_token={token}");

            if (!response.IsSuccessStatusCode)
            {
                throw new Exception("Invalid Google token");
            }

            var payloadStr = await response.Content.ReadAsStringAsync();
            var payload = JsonDocument.Parse(payloadStr).RootElement;
            
            var email = payload.GetProperty("email").GetString();
            var name = payload.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : email;

            if (string.IsNullOrEmpty(email))
                throw new Exception("Email not found in Google profile");

            var user = await _context.Users
                .FirstOrDefaultAsync(x => x.Email == email);

            if (user == null)
            {
                user = new User
                {
                    Name = name,
                    Email = email,
                    Phone = "", 
                    PasswordHash = "", 
                    Role = UserRole.User,
                    ApprovalStatus = ApprovalStatus.Approved
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }

            if (user.Role != UserRole.User)
                throw new Exception("Google login is only allowed for customer accounts");

            if (!user.IsActive || user.IsBlocked)
                throw new Exception("User is not allowed");

            var refreshToken = new RefreshToken
            {
                UserId = user.Id,
                Token = GenerateRefreshToken(),
                ExpiryDate = DateTime.UtcNow.AddHours(5).AddMinutes(30).AddDays(7)
            };

            _context.RefreshTokens.Add(refreshToken);
            await _context.SaveChangesAsync();

            return new AuthResponseDto
            {
                Token = _jwtService.GenerateToken(user),
                RefreshToken = refreshToken.Token,
                Role = user.Role.ToString()
            };
        }

        public async Task LogoutAsync(string accessToken, string refreshToken)
        {
            if (string.IsNullOrWhiteSpace(accessToken) || !_jwtService.ValidateToken(accessToken))
            {
                throw new Exception("Invalid access token provided for logout.");
            }

            var token = await _context.RefreshTokens
                .FirstOrDefaultAsync(x => x.Token == refreshToken);

            if (token == null || token.IsRevoked)
            {
                throw new Exception("Invalid tokens provided for logout.");
            }

            token.IsRevoked = true;

            var revoked = new RevokedToken { Token = accessToken };
            _context.RevokedTokens.Add(revoked);

            await _context.SaveChangesAsync();
        }
    }
}
