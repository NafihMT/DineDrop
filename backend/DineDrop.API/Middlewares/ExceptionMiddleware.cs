namespace DineDrop.API.Middlewares
{
    using Serilog;

    public class ExceptionMiddleware
    {
        private readonly RequestDelegate _next;

        public ExceptionMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task Invoke(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Unhandled Exception");

                context.Response.ContentType = "application/json";

                int statusCode = 400;

                if (ex is UnauthorizedAccessException)
                    statusCode = 401;

                context.Response.StatusCode = statusCode;

                var response = new
                {
                    message = ex.Message
                };

                await context.Response.WriteAsJsonAsync(response);
            }
        }
    }
}
