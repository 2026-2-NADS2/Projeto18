import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { parseHandlers, extractFieldAccess } from "../src/adapters/node-events/extract.ts";
import { scanServices } from "../src/adapters/node-events/scan.ts";
import { translateHandlers } from "../src/adapters/node-events/translate.ts";
import { buildGraph } from "../src/core/graph.ts";
import { findCollisions } from "../src/core/detector.ts";
import type { Collision } from "../src/core/model.ts";

// --- 1) extrator lê leitura/escrita do corpo do handler ----------------------

test("extractFieldAccess: escreve e lê no mesmo agregado", () => {
  const body = `order.total = order.subtotal * 1.1;`;
  assert.deepEqual(extractFieldAccess(body, "order"), {
    reads: ["subtotal"],
    writes: ["total"],
  });
});

test("parseHandlers: acha o evento, o recurso e os campos", () => {
  const src = `bus.on<Order>("order.updated", (order) => { order.prevTotal = order.total; });`;
  const hs = parseHandlers(src);
  assert.equal(hs.length, 1);
  assert.equal(hs[0].event, "order.updated");
  assert.equal(hs[0].resource, "order"); // prefixo do evento
  assert.deepEqual(hs[0].reads, ["total"]);
  assert.deepEqual(hs[0].writes, ["prevTotal"]);
});

// --- 2) varre o backend-exemplo real e acha as brigas ------------------------

const servicesDir = fileURLToPath(
  new URL("../examples/pedidos-microservices/services", import.meta.url),
);
const rules = translateHandlers(scanServices(servicesDir));
const collisions = findCollisions(buildGraph(rules));

const ww = (cs: Collision[]) => cs.filter((c) => c.type === "write-write");
const raw = (cs: Collision[]) => cs.filter((c) => c.type === "read-after-write");

test("microsserviços: write-write entre pricing e tax no campo total", () => {
  const hits = ww(collisions);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].field, "total");
  assert.equal(hits[0].resource, "order");
  assert.equal(hits[0].event, "order.updated");
});

test("microsserviços: read-after-write do audit com ordering UNKNOWN (imprevisível)", () => {
  const hits = raw(collisions);
  assert.equal(hits.length, 2); // audit lê total escrito por pricing E por tax
  for (const c of hits) {
    assert.equal(c.field, "total");
    // a reviravolta distribuída: sem ordem garantida entre serviços
    assert.equal(c.ordering, "unknown");
  }
});

test("microsserviços: não acusa shipping (campo exclusivo) nem notification (outro evento)", () => {
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

test("microsserviços: total de colisões = 3", () => {
  assert.equal(collisions.length, 3);
});
