using MediatR;

namespace Techlar.Notification;

// Notificação: reage a OUTRO evento (OrderPaid).
// CONTROLE: balde diferente -> não deve brigar com os de OrderUpdated.
public class NotificationHandler : INotificationHandler<OrderPaid>
{
    private readonly IMailer _mailer;

    public Task Handle(OrderPaid notification, CancellationToken ct)
    {
        _mailer.Send(notification.Email);
        return Task.CompletedTask;
    }
}
