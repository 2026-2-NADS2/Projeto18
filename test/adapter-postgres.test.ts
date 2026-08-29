import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFieldAccess } from "../src/adapters/postgres/extract.ts";
import { translateTriggers, type PgTriggerRow } from "../src/adapters/postgres/translate.ts";
import { buildGraph } from "../src/core/graph.ts";
import { findCollisions } from "../src/core/detector.ts";
import type { Collision } from "../src/core/model.ts";

// --- 1) O extrator lê corretamente o que a função lê/escreve -----------------

test("extractFieldAccess: escrita simples", () => {
  const src = `BEGIN NEW.updated_at := now(); RETURN NEW; END;`;
  assert.deepEqual(extractFieldAccess(src), { reads: [], writes: ["updated_at"] });
});

test("extractFieldAccess: lê no lado direito e escreve no esquerdo", () => {
  const src = `BEGIN NEW.total := NEW.subtotal * (1 - discount(NEW.customer_tier)); RETURN NEW; END;`;
  assert.deepEqual(extractFieldAccess(src), {
    reads: ["customer_tier", "subtotal"],
    writes: ["total"],
  });
});

test("extractFieldAccess: ignora comentários e RETURN NEW", () => {
  const src = `BEGIN -- NEW.ignorado := 1;\n NEW.audit_prev_total := NEW.total; RETURN NEW; END;`;
  assert.deepEqual(extractFieldAccess(src), {
    reads: ["total"],
    writes: ["audit_prev_total"],
  });
});

// --- 2) Triggers realistas -> mesmas 3 colisões do fixture -------------------

const fn = (body: string) =>
  `CREATE FUNCTION f() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${body} RETURN NEW; END; $$;`;

// nomes com prefixo numérico = padrão real p/ forçar a ordem de disparo do Postgres
const rows: PgTriggerRow[] = [
  {
    triggerName: "trg_00_snapshot_total",
    tableName: "orders",
    timing: "BEFORE",
    events: ["UPDATE"],
    functionName: "fn_snapshot_total",
    functionSource: fn(`NEW.audit_prev_total := NEW.total;`),
  },
  {
    triggerName: "trg_10_apply_discount",
    tableName: "orders",
    timing: "BEFORE",
    events: ["UPDATE"],
    functionName: "fn_apply_discount",
    functionSource: fn(`NEW.total := NEW.subtotal * (1 - discount(NEW.customer_tier));`),
  },
  {
    triggerName: "trg_20_apply_tax",
    tableName: "orders",
    timing: "BEFORE",
    events: ["UPDATE"],
    functionName: "fn_apply_tax",
    functionSource: fn(`NEW.total := NEW.subtotal * 1.1;`),
  },
  {
    triggerName: "trg_90_set_updated_at",
    tableName: "orders",
    timing: "BEFORE",
    events: ["UPDATE"],
    functionName: "fn_set_updated_at",
    functionSource: fn(`NEW.updated_at := now();`),
  },
  {
    triggerName: "trg_welcome_email",
    tableName: "customers",
    timing: "AFTER",
    events: ["INSERT"],
    functionName: "fn_welcome_email",
    functionSource: fn(`INSERT INTO outbox(addr) VALUES (NEW.email); NEW.welcome_sent_at := now();`),
  },
];

const collisions = findCollisions(buildGraph(translateTriggers(rows)));
const ww = (cs: Collision[]) => cs.filter((c) => c.type === "write-write");
const raw = (cs: Collision[]) => cs.filter((c) => c.type === "read-after-write");

test("adapter: ordem alfabética do nome vira `order` (Postgres semantics)", () => {
  const rules = translateTriggers(rows);
  const snap = rules.find((r) => r.name === "trg_00_snapshot_total")!;
  const disc = rules.find((r) => r.name === "trg_10_apply_discount")!;
  assert.equal(snap.order, 0); // 'trg_00...' roda primeiro
  assert.equal(disc.order, 1);
});

test("adapter: detecta write-write em orders.total (discount × tax)", () => {
  const hits = ww(collisions);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].field, "total");
});

test("adapter: snapshot lê total ANTES de discount/tax escreverem (reader-first)", () => {
  const hits = raw(collisions);
  assert.equal(hits.length, 2);
  for (const c of hits) {
    assert.equal(c.field, "total");
    assert.equal(c.reader, "orders.trg_00_snapshot_total:update");
    assert.equal(c.ordering, "reader-first");
  }
});

test("adapter: total de colisões = 3 (mesmo resultado do fixture manual)", () => {
  assert.equal(collisions.length, 3);
});
