using MediatR;

namespace Techlar.Audit;

// Auditoria: guarda o total anterior. LÊ `total`, que pricing e tax escrevem.
// MediatR não garante ordem entre handlers -> read-after-write imprevisível.
public class AuditHandler : INotificationHandler<OrderUpdated>
{
    public Task Handle(OrderUpdated notification, CancellationToken ct)
    {
        notification.PrevTotal = notification.Total;
        return Task.CompletedTask;
    }
}
