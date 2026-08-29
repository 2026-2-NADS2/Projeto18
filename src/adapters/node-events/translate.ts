import type { Rule } from "../../core/model.ts";
import type { ParsedHandler } from "./extract.ts";

/** Um handler já associado ao serviço (microsserviço) de onde veio. */
export interface ServiceHandler extends ParsedHandler {
  service: string;
}

/**
 * Traduz handlers de microsserviços para o idioma padrão (IR).
 *
 * Diferença crucial pro Postgres: aqui `order` fica UNDEFINED de propósito.
 * Em microsserviços não há ordem garantida de execução entre consumidores
 * independentes do mesmo evento — então um read-after-write vira "unknown"
 * (resultado imprevisível), que é exatamente o pesadelo distribuído.
 */
export function translateHandlers(handlers: ServiceHandler[]): Rule[] {
  return handlers.map((h, i) => ({
    id: `${h.service}:${h.event}#${i}`,
    name: `${h.service} (${h.event})`,
    resource: h.resource,
    event: h.event,
    reads: h.reads,
    writes: h.writes,
    order: undefined, // ordem não garantida entre microsserviços
    condition: undefined,
    source: h.service,
  }));
}
