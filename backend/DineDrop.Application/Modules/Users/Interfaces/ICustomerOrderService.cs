using DineDrop.Application.Modules.Users.DTOs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace DineDrop.Application.Modules.Users.Interfaces
{
    public interface ICustomerOrderService
    {
        Task<Guid> PlaceOrderAsync(Guid userId, PlaceOrderDto dto);
        Task<List<CustomerOrderSummaryDto>> GetMyOrdersAsync(Guid userId);
        Task<CustomerOrderDetailDto?> GetOrderDetailsAsync(Guid userId, Guid orderId);
        Task<bool> CancelOrderAsync(Guid userId, Guid orderId);
        Task<List<FlashRescueDealDto>> GetActiveRescueDealsAsync(Guid currentUserId);
        Task<Guid> BuyRescueDealAsync(Guid userId, Guid orderId, Guid addressId);
        Task<bool> RateOrderAsync(Guid userId, Guid orderId, RateOrderDto dto);
    }
}
