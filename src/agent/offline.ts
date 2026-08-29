// Explicador determinístico (sem IA). Plano B que roda SEM chave/internet.
// Segue a MESMA estrutura declarativa do shieldPy (Status/Severidade/Mapeamento/Recomendação).
// Como vem direto da prova do motor, a confiança é 100% (nunca "Requer Revisão Humana").

import type { Collision, Rule } from "../core/model.ts";
import type { Diagnosis, DiagnosisReport, Severity } from "./types.ts";
import { severityRank } from "./types.ts";

/** Nome legível de uma regra pelo id (cai no próprio id se não achar). */
function nameOf(rules: Map<string, Rule>, id: string): string {
  return rules.get(id)?.name ?? id;
}

function diagnose(c: Collision, rules: Map<string, Rule>): Diagnosis {
  const affectedKey = `${c.resource}/${c.event} · campo "${c.field}"`;
  const common = { collision: c, status: "Colisão Identificada" as const, affectedKey, confidence: 100 };

  if (c.type === "write-write") {
    const a = nameOf(rules, c.rules[0]);
    const b = nameOf(rules, c.rules[1]);
    return {
      ...common,
      severity: "Crítico",
      conflictingSources: `${a} vs ${b}`,
      rootCause:
        `Duas regras escrevem o mesmo campo "${c.field}" no mesmo recurso+evento, sem precedência definida. ` +
        `O valor final depende de quem gravar por último, sobrescrevendo a outra escrita silenciosamente.`,
      recommendation:
        `Eleja uma única regra responsável por escrever "${c.field}" nesse evento, ou encadeie "${a}" e "${b}" ` +
        `em ordem explícita (uma consome o resultado da outra) em vez de escreverem em paralelo.`,
    };
  }

  // read-after-write
  const reader = nameOf(rules, c.reader);
  const writer = nameOf(rules, c.writer);
  const sources = `${reader} (leitura) vs ${writer} (escrita)`;

  if (c.ordering === "unknown") {
    return {
      ...common,
      severity: "Alto",
      conflictingSources: sources,
      rootCause:
        `"${reader}" lê "${c.field}" que "${writer}" escreve, mas a ordem de execução não é garantida. ` +
        `O valor lido é intermitente (ora atualizado, ora não), tornando o resultado imprevisível entre execuções.`,
      recommendation:
        `Estabeleça uma ordem explícita para "${writer}" executar antes de "${reader}", ` +
        `ou separe em eventos encadeados; alternativamente, "${reader}" deve recalcular o valor em vez de depender do gravado.`,
    };
  }

  if (c.ordering === "reader-first") {
    return {
      ...common,
      severity: "Médio",
      conflictingSources: sources,
      rootCause:
        `Pela ordem atual, "${reader}" executa antes de "${writer}" e lê o valor desatualizado de "${c.field}". ` +
        `O erro é determinístico, porém silencioso (usa sempre o valor antigo).`,
      recommendation:
        `Inverta a ordem para "${writer}" executar antes de "${reader}", ` +
        `ou faça "${reader}" recalcular "${c.field}" em vez de ler o valor previamente gravado.`,
    };
  }

  // writer-first
  return {
    ...common,
    severity: "Baixo",
    conflictingSources: sources,
    rootCause:
      `Pela ordem atual, "${writer}" executa antes de "${reader}", que lê o valor já atualizado de "${c.field}". ` +
      `Está correto hoje, mas é frágil: qualquer mudança de ordem reintroduz o defeito.`,
    recommendation:
      `Documente e trave essa dependência de ordem (a corretude depende de "${writer}" preceder "${reader}").`,
  };
}

function buildSummary(diagnoses: Diagnosis[]): string {
  const n = diagnoses.length;
  if (n === 0) {
    return "Sem Colisão: analisei os metadados e não encontrei conflitos nos eventos avaliados.";
  }
  const criticos = diagnoses.filter((d) => d.severity === "Crítico").length;
  const altos = diagnoses.filter((d) => d.severity === "Alto").length;
  const partes = [`Analisei os metadados e identifiquei ${n} colisão(ões)`];
  if (criticos) partes.push(`${criticos} de severidade Crítico`);
  if (altos) partes.push(`${altos} de severidade Alto`);
  const pior = diagnoses[0]; // já ordenado por gravidade
  partes.push(`a mais grave afeta ${pior.affectedKey}`);
  return partes.join("; ") + ".";
}

/** Gera o relatório de diagnóstico por regras determinísticas (sem rede). */
export function explainOffline(collisions: Collision[], rules: Rule[]): DiagnosisReport {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const diagnoses = collisions
    .map((c) => diagnose(c, byId))
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

  return { summary: buildSummary(diagnoses), diagnoses, engine: "offline" };
}
