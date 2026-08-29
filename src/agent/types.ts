// Formatos de saída da camada de IA (Fase 2), no padrão declarativo do shieldPy.
// A IA NUNCA descobre colisões — ela só diagnostica as que o motor (core/) provou.
// Por isso todo Diagnosis carrega a `collision` original: rastreabilidade total.

import type { Collision } from "../core/model.ts";

/** Status do diagnóstico (guardrail de saída). */
export type Status = "Colisão Identificada" | "Sem Colisão" | "Requer Revisão Humana";

/** Nível de severidade (guardrail de saída). */
export type Severity = "Baixo" | "Médio" | "Alto" | "Crítico";

export const STATUSES: Status[] = ["Colisão Identificada", "Sem Colisão", "Requer Revisão Humana"];
export const SEVERITIES: Severity[] = ["Baixo", "Médio", "Alto", "Crítico"];

/** Diagnóstico declarativo de UMA colisão provada pelo motor. */
export interface Diagnosis {
  /** O fato original (do detector determinístico). Prova de onde a análise veio. */
  collision: Collision;
  /** Status: colisão identificada, sem colisão, ou requer revisão humana. */
  status: Status;
  /** Nível de severidade. */
  severity: Severity;
  // --- Mapeamento do Conflito ---
  /** Chave/Namespace Afetado (ex.: 'order/order.updated · campo "total"'). */
  affectedKey: string;
  /** Origens em Conflito ('<fonte_A> vs <fonte_B>'). */
  conflictingSources: string;
  /** Causa Raiz: motivo técnico da colisão, em até 2 frases. */
  rootCause: string;
  /** Recomendação Declarativa: como corrigir a estrutura de forma segura. */
  recommendation: string;
  /** Confiança da análise (0–100). < 85 força Status "Requer Revisão Humana". */
  confidence: number;
}

/** Relatório completo: visão geral + diagnósticos ordenados por gravidade. */
export interface DiagnosisReport {
  /** Visão geral do que foi analisado (uma frase). */
  summary: string;
  /** Diagnósticos, do mais grave para o menos grave. */
  diagnoses: Diagnosis[];
  /** De onde veio o texto: IA (Gemini) ou explicador determinístico. Transparência. */
  engine: "gemini" | "offline";
}

const RANK: Record<Severity, number> = { "Crítico": 0, "Alto": 1, "Médio": 2, "Baixo": 3 };

/** Peso de ordenação: menor = mais grave (vem primeiro). */
export function severityRank(sev: Severity): number {
  return RANK[sev];
}

/** Limiar de governança: abaixo disso, exige revisão humana. */
export const CONFIDENCE_THRESHOLD = 85;
