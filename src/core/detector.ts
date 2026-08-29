import type {
  Rule,
  InteractionGraph,
  Collision,
  ReadAfterWriteCollision,
} from "./model.ts";

/**
 * Encontra todas as colisões do grafo. Determinístico, sem IA.
 * Só compara regras que caem no MESMO balde (mesmo recurso+evento) —
 * é lá que uma briga é possível.
 */
export function findCollisions(graph: InteractionGraph): Collision[] {
  const collisions: Collision[] = [];

  for (const rules of graph.buckets.values()) {
    // cada par não-ordenado uma única vez
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        collisions.push(...pairCollisions(rules[i], rules[j]));
      }
    }
  }

  return collisions;
}

/** Todas as colisões entre um par de regras do mesmo balde. */
function pairCollisions(a: Rule, b: Rule): Collision[] {
  const out: Collision[] = [];

  // write-write: ambas escrevem o mesmo campo
  for (const field of intersect(a.writes, b.writes)) {
    const [r1, r2] = orderedIds(a.id, b.id);
    out.push({
      type: "write-write",
      resource: a.resource,
      event: a.event,
      field,
      rules: [r1, r2],
    });
  }

  // read-after-write, direção 1: `a` lê o que `b` escreve
  for (const field of intersect(a.reads, b.writes)) {
    out.push(rawCollision(a, b, field));
  }
  // read-after-write, direção 2: `b` lê o que `a` escreve
  for (const field of intersect(b.reads, a.writes)) {
    out.push(rawCollision(b, a, field));
  }

  return out;
}

function rawCollision(
  reader: Rule,
  writer: Rule,
  field: string,
): ReadAfterWriteCollision {
  let ordering: ReadAfterWriteCollision["ordering"] = "unknown";
  if (reader.order !== undefined && writer.order !== undefined) {
    ordering = reader.order < writer.order ? "reader-first" : "writer-first";
  }
  return {
    type: "read-after-write",
    resource: reader.resource,
    event: reader.event,
    field,
    reader: reader.id,
    writer: writer.id,
    ordering,
  };
}

function intersect(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

function orderedIds(x: string, y: string): [string, string] {
  return x <= y ? [x, y] : [y, x];
}
