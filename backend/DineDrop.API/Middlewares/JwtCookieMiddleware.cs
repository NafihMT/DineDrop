using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace DineDrop.API.Middlewares
{
    public class JwtCookieMiddleware
    {
        private readonly RequestDelegate _next;

        public JwtCookieMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // If the request doesn't have an Authorization header but has our jwtToken cookie
            var token = context.Request.Cookies["jwtToken"];
            
            if (!string.IsNullOrEmpty(token) && !context.Request.Headers.ContainsKey("Authorization"))
            {
                // Inject the token into the Authorization header so standard JwtBearer can find it
                context.Request.Headers.Append("Authorization", $"Bearer {token}");
            }

            await _next(context);
        }
    }
}
