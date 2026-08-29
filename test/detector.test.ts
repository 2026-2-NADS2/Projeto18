import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildGraph } from "../src/core/graph.ts";
import { findCollisions } from "../src/core/detector.ts";
import type { Rule, Collision } from "../src/core/model.ts";

const fixturePath = fileURLToPath(
  new URL("../fixtures/postgres-example.json", import.meta.url),
);
const rules = JSON.parse(readFileSync(fixturePath, "utf8")) as Rule[];
const collisions = findCollisions(buildGraph(rules));

const ww = (cs: Collision[]) => cs.filter((c) => c.type === "write-write");
const raw = (cs: Collision[]) => cs.filter((c) => c.type === "read-after-write");

test("detecta a colisão write-write plantada (orders.total)", () => {
  const hits = ww(collisions);
  assert.equal(hits.length, 1);
  const c = hits[0];
  assert.equal(c.type, "write-write");
  assert.equal(c.resource, "orders");
  assert.equal(c.event, "before update");
  assert.equal(c.field, "total");
  assert.deepEqual(
    [...c.rules].sort(),
    ["trg_apply_discount", "trg_apply_tax"],
  );
});

test("detecta os read-after-write no campo orders.total (leitura desatualizada)", () => {
  const hits = raw(collisions);
  assert.equal(hits.length, 2);
  for (const c of hits) {
    assert.equal(c.type, "read-after-write");
    assert.equal(c.field, "total");
    assert.equal(c.reader, "trg_log_prev_total");
    // log roda em order=5, discount(10)/tax(20) rodam depois -> lê valor velho
    assert.equal(c.ordering, "reader-first");
  }
});

test("não inventa colisão onde não há (regras de controle)", () => {
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
  // escreve um campo exclusivo (updated_at) -> não briga com ninguém
  assert.equal(envolvidos.has("trg_set_updated_at"), false);
  // está em outro balde (customers/after insert), sozinho
  assert.equal(envolvidos.has("trg_welcome_email"), false);
});

test("total de colisões detectadas = 3", () => {
  assert.equal(collisions.length, 3);
});
