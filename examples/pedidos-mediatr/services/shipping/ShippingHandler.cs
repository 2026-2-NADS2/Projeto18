using MediatR;

namespace Techlar.Shipping;

// Logística: gera o código de rastreio.
// CONTROLE: mesmo evento, mas campo exclusivo -> não deve acusar briga.
public class ShippingHandler : INotificationHandler<OrderUpdated>
{
    public Task Handle(OrderUpdated notification, CancellationToken ct)
    {
        notification.TrackingCode = "BR";
        return Task.CompletedTask;
    }
}
