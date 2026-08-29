import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { parseJava } from "../src/adapters/java-spring/extract.ts";
import { scan } from "../src/adapters/shared/scan.ts";
import { toRules } from "../src/adapters/shared/translate.ts";
import { buildGraph } from "../src/core/graph.ts";
import { findCollisions } from "../src/core/detector.ts";
import { explainOffline } from "../src/agent/offline.ts";
import { severityRank } from "../src/agent/types.ts";

// Usa o backend Spring de exemplo: 1 write-write (total) + 2 read-after-write unknown.
const servicesDir = fileURLToPath(
  new URL("../examples/pedidos-spring/services", import.meta.url),
);
const rules = toRules(scan(servicesDir, ".java", parseJava));
const collisions = findCollisions(buildGraph(rules));
const report = explainOffline(collisions, rules);

test("offline: gera um diagnóstico por colisão, marcado como offline", () => {
  assert.equal(report.engine, "offline");
  assert.equal(report.diagnoses.length, collisions.length);
  assert.equal(report.diagnoses.length, 3);
});

test("offline: severidades no padrão declarativo (write-write=Crítico, RAW unknown=Alto)", () => {
  const ww = report.diagnoses.filter((d) => d.collision.type === "write-write");
  assert.equal(ww.length, 1);
  assert.equal(ww[0].severity, "Crítico");

  const raw = report.diagnoses.filter((d) => d.collision.type === "read-after-write");
  assert.equal(raw.length, 2);
  for (const d of raw) assert.equal(d.severity, "Alto"); // ordering unknown
});

test("offline: status e confiança determinísticos (Colisão Identificada, 100%)", () => {
  for (const d of report.diagnoses) {
    assert.equal(d.status, "Colisão Identificada");
    assert.equal(d.confidence, 100);
  }
});

test("offline: diagnósticos ordenados do mais grave para o menos grave", () => {
  for (let i = 1; i < report.diagnoses.length; i++) {
    const prev = severityRank(report.diagnoses[i - 1].severity);
    const cur = severityRank(report.diagnoses[i].severity);
    assert.ok(prev <= cur, "gravidade fora de ordem");
  }
});

test("offline: estrutura obrigatória preenchida + rastreabilidade", () => {
  for (const d of report.diagnoses) {
    assert.ok(d.collision, "diagnóstico sem colisão de origem");
    assert.ok(d.affectedKey.includes(d.collision.field)); // Chave/Namespace menciona o campo
    assert.ok(d.conflictingSources.includes("vs"));       // Origens em Conflito
    assert.ok(d.rootCause.length > 0);                    // Causa Raiz
    assert.ok(d.recommendation.length > 0);               // Recomendação Declarativa
  }
});

test("offline: recomendações não sugerem comandos destrutivos", () => {
  const proibido = /rm -rf|kubectl delete|git push --force|DROP TABLE/i;
  for (const d of report.diagnoses) assert.doesNotMatch(d.recommendation, proibido);
});

test("offline: visão geral menciona a contagem e as severidades", () => {
  assert.match(report.summary, /3 colis/);
  assert.match(report.summary, /Crítico/);
});

// caso vazio: regras que não brigam
test("offline: sem colisões -> Sem Colisão", () => {
  const empty = explainOffline([], rules);
  assert.equal(empty.diagnoses.length, 0);
  assert.match(empty.summary, /Sem Colisão/);
});
