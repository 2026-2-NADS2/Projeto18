import type { Rule } from "../../core/model.ts";
import type { ServiceRule } from "./types.ts";

/**
 * Traduz regras de serviços (Java/Python/C#/Node) para o idioma padrão (IR).
 * `order` fica UNDEFINED: nesses sistemas a ordem entre listeners/handlers do
 * mesmo evento não é garantida -> read-after-write vira "unknown" (imprevisível).
 */
export function toRules(items: ServiceRule[]): Rule[] {
  return items.map((h, i) => ({
    id: `${h.service}:${h.event}#${i}`,
    name: `${h.service} (${h.event})`,
    resource: h.resource,
    event: h.event,
    reads: h.reads,
    writes: h.writes,
    order: undefined,
    condition: undefined,
    source: h.service,
  }));
}
