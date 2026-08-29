import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { parseCSharp } from "../src/adapters/dotnet-mediatr/extract.ts";
import { scan } from "../src/adapters/shared/scan.ts";
import { toRules } from "../src/adapters/shared/translate.ts";
import { buildGraph } from "../src/core/graph.ts";
import { findCollisions } from "../src/core/detector.ts";
import type { Collision } from "../src/core/model.ts";

// --- 1) extrator lê o handler e os acessos a notification.Prop ---------------

test("parseCSharp: acha evento (INotificationHandler<T>), recurso e campos", () => {
  const src = `
    public class AuditHandler : INotificationHandler<OrderUpdated> {
      public Task Handle(OrderUpdated notification, CancellationToken ct) {
        notification.PrevTotal = notification.Total;
        return Task.CompletedTask;
      }
    }
  `;
  const hs = parseCSharp(src);
  assert.equal(hs.length, 1);
  assert.equal(hs[0].event, "OrderUpdated");
  assert.equal(hs[0].resource, "Order"); // sufixo "Updated" removido
  assert.deepEqual(hs[0].reads, ["total"]); // normalizado p/ minúscula inicial
  assert.deepEqual(hs[0].writes, ["prevTotal"]);
});

// --- 2) varre o backend MediatR de exemplo e acha as brigas ------------------

const servicesDir = fileURLToPath(
  new URL("../examples/pedidos-mediatr/services", import.meta.url),
);
const rules = toRules(scan(servicesDir, ".cs", parseCSharp));
const collisions = findCollisions(buildGraph(rules));

const ww = (cs: Collision[]) => cs.filter((c) => c.type === "write-write");
const raw = (cs: Collision[]) => cs.filter((c) => c.type === "read-after-write");

test("MediatR: write-write entre pricing e tax no campo total", () => {
  const hits = ww(collisions);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].field, "total");
  assert.equal(hits[0].resource, "Order");
  assert.equal(hits[0].event, "OrderUpdated");
});

test("MediatR: read-after-write do audit com ordering UNKNOWN (imprevisível)", () => {
  const hits = raw(collisions);
  assert.equal(hits.length, 2); // audit lê total escrito por pricing E por tax
  for (const c of hits) {
    assert.equal(c.field, "total");
    assert.equal(c.ordering, "unknown");
  }
});

test("MediatR: não acusa shipping (campo exclusivo) nem notification (outro evento)", () => {
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

test("MediatR: total de colisões = 3", () => {
  assert.equal(collisions.length, 3);
});
