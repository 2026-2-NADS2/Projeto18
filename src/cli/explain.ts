// Comando `explain`: roda o motor sobre uma fonte e explica as brigas em
// linguagem natural (Gemini, ou explicador offline se não houver chave).
// Uso:  npm run explain -- <node|java|python|csharp|pg|fixture> [pasta|arquivo|url]

import { buildGraph } from "../core/graph.ts";
import { findCollisions } from "../core/detector.ts";
import { explain } from "../agent/index.ts";
import type { DiagnosisReport } from "../agent/index.ts";
import type { Severity } from "../agent/index.ts";
import { AGENT_NAME, AGENT_TAGLINE } from "../agent/persona.ts";
import { loadSource, SOURCES } from "./sources.ts";

const ICON: Record<Severity, string> = { "Crítico": "🔴", "Alto": "🟠", "Médio": "🟡", "Baixo": "🟢" };

function printDiagnosis(report: DiagnosisReport, sourceLabel: string): void {
  const origem = report.engine === "gemini" ? "IA (Gemini)" : "explicador offline";
  console.log(`\n🛡️  ${AGENT_NAME} — ${AGENT_TAGLINE}`);
  console.log(`📋 Análise de ${sourceLabel}`);
  console.log(`🧠 origem do texto: ${origem}\n`);
  console.log(`📝 ${report.summary}\n`);

  if (report.diagnoses.length === 0) return;

  report.diagnoses.forEach((d, i) => {
    console.log(`${ICON[d.severity]} Status: ${d.status}  |  Severidade: ${d.severity}  |  Confiança: ${d.confidence}%`);
    console.log(`   Chave/Namespace Afetado: ${d.affectedKey}`);
    console.log(`   Origens em Conflito: ${d.conflictingSources}`);
    console.log(`   Causa Raiz: ${d.rootCause}`);
    console.log(`   Recomendação Declarativa: ${d.recommendation}`);
    if (i < report.diagnoses.length - 1) console.log("");
  });
  console.log("");
}

const source = process.argv[2];
const arg = process.argv[3];

if (!source || !SOURCES.includes(source)) {
  console.error(`uso: node src/cli/explain.ts <${SOURCES.join("|")}> [pasta|arquivo|url]`);
  process.exit(1);
}

const { label, rules } = await loadSource(source, arg);
const collisions = findCollisions(buildGraph(rules));
const report = await explain(collisions, rules);
printDiagnosis(report, label);
