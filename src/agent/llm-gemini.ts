// Cliente da API do Google Gemini — via fetch nativo (zero dependência).
// Trocar de IA = trocar só este arquivo; o resto do sistema é agnóstico de LLM.
// Chave em GEMINI_API_KEY; modelo em GEMINI_MODEL (padrão gemini-2.5-flash).

const DEFAULT_MODEL = "gemini-3.6-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Status transitórios do lado do Google — vale reesperar e tentar de novo. */
const TRANSIENT = new Set([429, 500, 503]);
/** Nº de tentativas e espera (ms) crescente entre elas ao receber 503/429/500. */
const RETRIES = 4;
const BACKOFF_MS = [800, 2000, 4000, 8000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** true se há chave configurada — usado pelo maestro para decidir Gemini vs offline. */
export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * POST genérico ao :generateContent com retry/backoff nos status transitórios.
 * Recebe o corpo já serializado e devolve o TEXTO concatenado das partes de resposta.
 */
async function generate(body: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY não definida");
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `${BASE}/${model}:generateContent`;

  let res: Response | undefined;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body,
    });
    if (res.ok) break;
    // 503/429/500 = congestionamento temporário do Google -> espera e tenta de novo
    if (TRANSIENT.has(res.status) && attempt < RETRIES) {
      const wait = BACKOFF_MS[attempt] ?? 8000;
      console.error(`⏳ Gemini ${res.status} (congestionado). Reesperando ${wait}ms e tentando de novo...`);
      await sleep(wait);
      continue;
    }
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini respondeu ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await res!.json()) as GeminiResponse;
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  // modelos "pensantes" (gemini 3.x) mandam partes de raciocínio (thought:true)
  // antes da resposta — junta só as partes de resposta de fato.
  const text = parts
    .filter((p) => p.thought !== true && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  if (!text) throw new Error("resposta do Gemini sem texto");
  return text;
}

/**
 * Envia o prompt ao Gemini e devolve o TEXTO da resposta (esperado: JSON).
 * `responseMimeType: application/json` força a IA a responder em JSON.
 */
export async function callGemini(prompt: string): Promise<string> {
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  });
  return stripFences(await generate(body));
}

/** Um turno da conversa: quem falou (`user`/`model`) e o texto. */
export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

/**
 * Modo CONVERSA (multi-turno). `system` = persona/guardrails + fatos provados
 * (a âncora anti-alucinação). Devolve TEXTO livre (prosa), não JSON.
 */
export async function callGeminiChat(system: string, turns: ChatTurn[]): Promise<string> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    generationConfig: { temperature: 0.3 },
  });
  return (await generate(body)).trim();
}

/** Remove cercas de markdown (```json ... ```) caso a IA as inclua. */
function stripFences(s: string): string {
  const t = s.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  return t;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
}
