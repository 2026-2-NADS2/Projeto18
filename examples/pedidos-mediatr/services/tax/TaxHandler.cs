using MediatR;

namespace Techlar.Tax;

// Impostos: também reage a OrderUpdated e reescreve o total.
// BRIGA (write-write) com precificação: os dois escrevem `total`.
public class TaxHandler : INotificationHandler<OrderUpdated>
{
    public Task Handle(OrderUpdated notification, CancellationToken ct)
    {
        notification.Total = notification.Subtotal * 1.1m;
        return Task.CompletedTask;
    }
}
