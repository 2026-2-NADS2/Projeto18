import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { parsePython } from "../src/adapters/python-django/extract.ts";
import { scan } from "../src/adapters/shared/scan.ts";
import { toRules } from "../src/adapters/shared/translate.ts";
import { buildGraph } from "../src/core/graph.ts";
import { findCollisions } from "../src/core/detector.ts";
import type { Collision } from "../src/core/model.ts";

// --- 1) extrator lê o receiver e os acessos a instance.campo -----------------

test("parsePython: acha signal (evento), sender (recurso) e campos", () => {
  const src = [
    "@receiver(pre_save, sender=Order)",
    "def snapshot(sender, instance, **kwargs):",
    "    instance.prev_total = instance.total",
    "",
  ].join("\n");
  const hs = parsePython(src);
  assert.equal(hs.length, 1);
  assert.equal(hs[0].event, "pre_save"); // o signal
  assert.equal(hs[0].resource, "Order"); // o sender
  assert.deepEqual(hs[0].reads, ["total"]);
  assert.deepEqual(hs[0].writes, ["prev_total"]);
});

// --- 2) varre o backend Django de exemplo e acha as brigas -------------------

const servicesDir = fileURLToPath(
  new URL("../examples/pedidos-django/services", import.meta.url),
);
const rules = toRules(scan(servicesDir, ".py", parsePython));
const collisions = findCollisions(buildGraph(rules));

const ww = (cs: Collision[]) => cs.filter((c) => c.type === "write-write");
const raw = (cs: Collision[]) => cs.filter((c) => c.type === "read-after-write");

test("Django: write-write entre pricing e tax no campo total", () => {
  const hits = ww(collisions);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].field, "total");
  assert.equal(hits[0].resource, "Order");
  assert.equal(hits[0].event, "pre_save");
});

test("Django: read-after-write do audit com ordering UNKNOWN (imprevisível)", () => {
  const hits = raw(collisions);
  assert.equal(hits.length, 2); // audit lê total escrito por pricing E por tax
  for (const c of hits) {
    assert.equal(c.field, "total");
    assert.equal(c.ordering, "unknown");
  }
});

test("Django: não acusa shipping (campo exclusivo) nem notification (outro signal)", () => {
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

test("Django: total de colisões = 3", () => {
  assert.equal(collisions.length, 3);
});
