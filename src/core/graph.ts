import type { Rule, InteractionGraph } from "./model.ts";

/** Chave canônica de um balde do grafo. */
export function keyOf(resource: string, event: string): string {
  return `${resource}::${event}`;
}

/**
 * Monta o Grafo de Interações: agrupa as regras por recurso+evento
 * e ordena cada balde pela ordem de execução (menor primeiro).
 * Regras sem `order` vão para o fim; empate desfeito pelo id (determinístico).
 */
export function buildGraph(rules: Rule[]): InteractionGraph {
  const buckets = new Map<string, Rule[]>();

  for (const rule of rules) {
    const k = keyOf(rule.resource, rule.event);
    const list = buckets.get(k);
    if (list) list.push(rule);
    else buckets.set(k, [rule]);
  }

  for (const list of buckets.values()) {
    list.sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

  return { buckets };
}
