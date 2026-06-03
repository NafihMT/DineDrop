
namespace DineDrop.Application.Modules.Restaurants.DTOs
{
    public class EarningsDto
    {
        public decimal DailyRevenue { get; set; }
        public decimal WeeklyRevenue { get; set; }
        public decimal MonthlyRevenue { get; set; }
    }
    public class PopularItemDto
    {
        public string Name { get; set; } = string.Empty;
        public int TotalSold { get; set; }
        public decimal TotalRevenue { get; set; }
    }
    public class RestaurantAnalyticsSummaryDto
    {
        public int TotalOrders { get; set; }
        public double AverageRating { get; set; }
        public decimal TotalEarnings { get; set; }
        public double GrowthPercentage { get; set; }
    }
}
