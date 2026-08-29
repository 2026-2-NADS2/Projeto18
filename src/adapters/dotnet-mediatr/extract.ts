// Adapter .NET / C# (MediatR). Acha handlers de notificação:
//   public class TaxHandler : INotificationHandler<OrderUpdated> {
//     public Task Handle(OrderUpdated notification, CancellationToken ct) {
//       notification.Total = notification.Subtotal * 1.1m;
//     }
//   }
// evento = tipo em INotificationHandler<T>; recurso = evento sem sufixo verbal.
// lê/escreve = acessos a `notification.Prop` (normalizados p/ minúscula inicial).

import { stripCComments, braceBlock, dotFieldAccess, deriveResource, decap } from "../shared/text.ts";
import type { ParsedRule } from "../shared/types.ts";

const HANDLER_IFACE_RE = /INotificationHandler\s*<\s*([A-Za-z_]\w*)\s*>/g;

export function parseCSharp(source: string): ParsedRule[] {
  const clean = stripCComments(source);
  const out: ParsedRule[] = [];

  for (const m of clean.matchAll(HANDLER_IFACE_RE)) {
    const event = m[1];
    // acha o método Handle(<Event> <param>, ...) e o corpo dele
    const handleRe = new RegExp(`\\bHandle\\s*\\(\\s*${event}\\s+(\\w+)\\b`, "g");
    handleRe.lastIndex = m.index;
    const hm = handleRe.exec(clean);
    if (!hm) continue;
    const param = hm[1];
    const openIdx = clean.indexOf("{", hm.index);
    if (openIdx === -1) continue;
    const body = braceBlock(clean, openIdx);
    const raw = dotFieldAccess(body, param);
    out.push({
      event,
      resource: deriveResource(event),
      reads: raw.reads.map(decap),
      writes: raw.writes.map(decap),
    });
  }

  return out;
}
