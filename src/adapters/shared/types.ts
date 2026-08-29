// Formato intermediário que TODO extrator de linguagem produz.
export interface ParsedRule {
  /** evento de domínio (ex.: "order.updated", "OrderUpdated", "pre_save"). */
  event: string;
  /** recurso afetado (ex.: "order", "Order"). */
  resource: string;
  reads: string[];
  writes: string[];
}

/** Uma regra já associada ao serviço/módulo de onde veio. */
export interface ServiceRule extends ParsedRule {
  service: string;
}
