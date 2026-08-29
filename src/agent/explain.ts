// O maestro da camada de IA. Decide a origem do texto e sempre entrega um
// DiagnosisReport — nunca quebra: se a IA falhar, cai no explicador offline.

import type { Collision, Rule } from "../core/model.ts";
import type { DiagnosisReport } from "./types.ts";
import { explainOffline } from "./offline.ts";
import { buildPrompt, parseResponse } from "./prompt.ts";
import { callGemini, hasGeminiKey } from "./llm-gemini.ts";

/**
 * Gera o relatório de diagnóstico.
 * - Com GEMINI_API_KEY: tenta o Gemini (1 retry); qualquer falha -> cai no offline.
 * - Sem chave: usa o offline direto.
 * O offline é determinístico e não depende de rede — a demo nunca falha.
 */
export async function explain(collisions: Collision[], rules: Rule[]): Promise<DiagnosisReport> {
  if (collisions.length === 0 || !hasGeminiKey()) {
    return explainOffline(collisions, rules);
  }

  const prompt = buildPrompt(collisions, rules);
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const text = await callGemini(prompt);
      return parseResponse(text, collisions);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`⚠️  Gemini falhou (tentativa ${attempt}/2): ${msg}`);
    }
  }

  console.error("↩️  usando explicador offline (fallback).");
  return explainOffline(collisions, rules);
}
