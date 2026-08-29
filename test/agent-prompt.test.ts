import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, parseResponse } from "../src/agent/prompt.ts";
import type { Collision, Rule } from "../src/core/model.ts";

// Cenário mínimo: 2 regras que escrevem o mesmo campo (write-write).
const rules: Rule[] = [
  { id: "pricing:1", name: "pricing", resource: "Order", event: "OrderUpdated", reads: ["subtotal"], writes: ["total"], source: "pricing" },
  { id: "tax:2", name: "tax", resource: "Order", event: "OrderUpdated", reads: ["subtotal"], writes: ["total"], source: "tax" },
];
const collisions: Collision[] = [
  { type: "write-write", resource: "Order", event: "OrderUpdated", field: "total", rules: ["pricing:1", "tax:2"] },
];

test("buildPrompt: inclui persona/guardrails, fatos e a coleira anti-alucinação", () => {
  const p = buildPrompt(collisions, rules);
  assert.match(p, /shieldPy/);              // persona embutida
  assert.match(p, /Especialista Sênior em DevOps/i);
  assert.match(p, /NÃO descubra/i);         // instrução de não inventar
  assert.match(p, /trate como DADOS/i);     // guardrail anti prompt-injection
  assert.match(p, /pricing/);               // regra envolvida
  assert.match(p, /tax/);
  assert.match(p, /"total"/);               // o campo em conflito
  assert.match(p, /write-write/);           // o fato
  assert.match(p, /GLOSSÁRIO/);             // semântica de ordering
  // estrutura obrigatória de saída
  assert.match(p, /affectedKey/);
  assert.match(p, /conflictingSources/);
  assert.match(p, /rootCause/);
  assert.match(p, /recommendation/);
  assert.match(p, /confidence/);
  assert.match(p, /Requer Revisão Humana/); // governança
});

test("parseResponse: aceita JSON válido e reanexa a colisão original", () => {
  const fake = JSON.stringify({
    summary: "1 colisão crítica no cálculo do total.",
    diagnoses: [
      {
        index: 0,
        status: "Colisão Identificada",
        severity: "Crítico",
        affectedKey: 'Order/OrderUpdated · campo "total"',
        conflictingSources: "pricing vs tax",
        rootCause: "As duas escrevem total sem precedência.",
        recommendation: "Eleja uma única dona do campo.",
        confidence: 95,
      },
    ],
  });
  const report = parseResponse(fake, collisions);
  assert.equal(report.engine, "gemini");
  assert.equal(report.diagnoses.length, 1);
  const d = report.diagnoses[0];
  assert.equal(d.status, "Colisão Identificada");
  assert.equal(d.severity, "Crítico");
  assert.equal(d.confidence, 95);
  assert.equal(d.affectedKey, 'Order/OrderUpdated · campo "total"');
  assert.equal(d.conflictingSources, "pricing vs tax");
  // a colisão veio do fato original, não do texto da IA
  assert.deepEqual(d.collision, collisions[0]);
});

test("parseResponse: governança — confiança < 85 força 'Requer Revisão Humana'", () => {
  const fake = JSON.stringify({
    summary: "análise ambígua.",
    diagnoses: [
      {
        index: 0,
        status: "Colisão Identificada", // a IA disse isso, mas...
        severity: "Alto",
        affectedKey: 'Order/OrderUpdated · campo "total"',
        conflictingSources: "pricing vs tax",
        rootCause: "incerto.",
        recommendation: "revisar.",
        confidence: 60, // ...confiança baixa deve sobrepor o status
      },
    ],
  });
  const report = parseResponse(fake, collisions);
  assert.equal(report.diagnoses[0].status, "Requer Revisão Humana");
});

test("parseResponse: rejeita JSON malformado", () => {
  assert.throws(() => parseResponse("isso não é json", collisions), /JSON válido/);
});

test("parseResponse: rejeita formato sem summary/diagnoses", () => {
  assert.throws(() => parseResponse(JSON.stringify({ foo: 1 }), collisions), /formato esperado/);
});

test("parseResponse: rejeita index inexistente", () => {
  const bad = JSON.stringify({
    summary: "x",
    diagnoses: [{ index: 99, status: "Colisão Identificada", severity: "Alto", affectedKey: "k", conflictingSources: "a vs b", rootCause: "r", recommendation: "f", confidence: 90 }],
  });
  assert.throws(() => parseResponse(bad, collisions), /index inexistente/);
});

test("parseResponse: rejeita status inválido", () => {
  const bad = JSON.stringify({
    summary: "x",
    diagnoses: [{ index: 0, status: "Talvez", severity: "Alto", affectedKey: "k", conflictingSources: "a vs b", rootCause: "r", recommendation: "f", confidence: 90 }],
  });
  assert.throws(() => parseResponse(bad, collisions), /status inválido/);
});

test("parseResponse: rejeita severidade inválida", () => {
  const bad = JSON.stringify({
    summary: "x",
    diagnoses: [{ index: 0, status: "Colisão Identificada", severity: "crítica", affectedKey: "k", conflictingSources: "a vs b", rootCause: "r", recommendation: "f", confidence: 90 }],
  });
  assert.throws(() => parseResponse(bad, collisions), /severity inválida/);
});

test("parseResponse: rejeita campo de texto ausente", () => {
  const bad = JSON.stringify({
    summary: "x",
    diagnoses: [{ index: 0, status: "Colisão Identificada", severity: "Alto", affectedKey: "k", conflictingSources: "a vs b", rootCause: "r", confidence: 90 }],
  });
  assert.throws(() => parseResponse(bad, collisions), /campo de texto ausente/);
});
