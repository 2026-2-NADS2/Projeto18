import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { parseJava } from "../src/adapters/java-spring/extract.ts";
import { getterSetterAccess } from "../src/adapters/shared/text.ts";
import { scan } from "../src/adapters/shared/scan.ts";
import { toRules } from "../src/adapters/shared/translate.ts";
import { buildGraph } from "../src/core/graph.ts";
import { findCollisions } from "../src/core/detector.ts";
import type { Collision } from "../src/core/model.ts";

// --- 1) extrator lê getters/setters do corpo do listener ---------------------

test("getterSetterAccess: setX escreve, getX lê", () => {
  const body = `e.setTotal(e.getSubtotal() * 1.1);`;
  assert.deepEqual(getterSetterAccess(body, "e"), {
    reads: ["subtotal"],
    writes: ["total"],
  });
});

test("parseJava: acha evento, recurso e campos", () => {
  const src = `
    @EventListener
    public void onOrderUpdated(OrderUpdated e) { e.setPrevTotal(e.getTotal()); }
  `;
  const hs = parseJava(src);
  assert.equal(hs.length, 1);
  assert.equal(hs[0].event, "OrderUpdated");
  assert.equal(hs[0].resource, "Order"); // sufixo "Updated" removido
  assert.deepEqual(hs[0].reads, ["total"]);
  assert.deepEqual(hs[0].writes, ["prevTotal"]);
});

// --- 2) varre o backend Spring de exemplo e acha as brigas -------------------

const servicesDir = fileURLToPath(
  new URL("../examples/pedidos-spring/services", import.meta.url),
);
const rules = toRules(scan(servicesDir, ".java", parseJava));
const collisions = findCollisions(buildGraph(rules));

const ww = (cs: Collision[]) => cs.filter((c) => c.type === "write-write");
const raw = (cs: Collision[]) => cs.filter((c) => c.type === "read-after-write");

test("Spring: write-write entre pricing e tax no campo total", () => {
  const hits = ww(collisions);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].field, "total");
  assert.equal(hits[0].resource, "Order");
  assert.equal(hits[0].event, "OrderUpdated");
});

test("Spring: read-after-write do audit com ordering UNKNOWN (imprevisível)", () => {
  const hits = raw(collisions);
  assert.equal(hits.length, 2); // audit lê total escrito por pricing E por tax
  for (const c of hits) {
    assert.equal(c.field, "total");
    assert.equal(c.ordering, "unknown");
  }
});

test("Spring: não acusa shipping (campo exclusivo) nem notification (outro evento)", () => {
  const envolvidos = new Set<string>();
  for (const c of collisions) {
    if (c.type === "write-write") {
      envolvidos.add(c.rules[0]);
      envolvidos.add(c.rules[1]);
    } else {
      envolvidos.add(c.reader);
      envolvidos.add(c.writer);
    }
  }
  assert.equal([...envolvidos].some((id) => id.startsWith("shipping:")), false);
  assert.equal([...envolvidos].some((id) => id.startsWith("notification:")), false);
});

test("Spring: total de colisões = 3", () => {
  assert.equal(collisions.length, 3);
});
