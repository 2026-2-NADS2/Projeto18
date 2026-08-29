// Ponto de entrada da camada de IA (Fase 2). A CLI importa daqui.
// core/ NUNCA importa deste módulo — dependência de mão única.
export * from "./types.ts";
export { explain } from "./explain.ts";
export { explainOffline } from "./offline.ts";
export { buildPrompt, parseResponse } from "./prompt.ts";
export { callGemini, hasGeminiKey } from "./llm-gemini.ts";
