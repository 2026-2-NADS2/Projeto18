using MediatR;

namespace Techlar.Pricing;

// Precificação: aplica o desconto do tier ao total.
public class PricingHandler : INotificationHandler<OrderUpdated>
{
    public Task Handle(OrderUpdated notification, CancellationToken ct)
    {
        notification.Total = notification.Subtotal * (notification.Tier == "vip" ? 0.9m : 1.0m);
        return Task.CompletedTask;
    }
}
