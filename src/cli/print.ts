import { buildGraph } from "../core/graph.ts";
import { findCollisions } from "../core/detector.ts";
import type { Rule } from "../core/model.ts";

/** Monta o grafo, acha as colisões e imprime o relatório. Usado pelos dois comandos. */
export function runReport(rules: Rule[], sourceLabel: string): void {
  const graph = buildGraph(rules);
  const collisions = findCollisions(graph);

  console.log(`\n📋 ${rules.length} regras lidas de ${sourceLabel}`);
  console.log(`🗺️  ${graph.buckets.size} balde(s) — recurso × evento\n`);

  if (collisions.length === 0) {
    console.log("✅ nenhuma colisão detectada.\n");
    return;
  }

  console.log(`⚠️  ${collisions.length} colisão(ões) detectada(s):\n`);
  for (const c of collisions) {
    if (c.type === "write-write") {
      console.log(`  [write-write]      ${c.resource} / ${c.event} — campo "${c.field}"`);
      console.log(`      ${c.rules[0]} e ${c.rules[1]} escrevem o mesmo campo\n`);
    } else {
      const nota =
        c.ordering === "reader-first"
          ? "lê valor DESATUALIZADO (roda antes de quem escreve)"
          : c.ordering === "writer-first"
            ? "lê o valor já alterado (roda depois de quem escreve)"
            : "ordem indefinida — resultado imprevisível";
      console.log(`  [read-after-write] ${c.resource} / ${c.event} — campo "${c.field}"`);
      console.log(`      ${c.reader} lê o que ${c.writer} escreve → ${nota}\n`);
    }
  }
}
