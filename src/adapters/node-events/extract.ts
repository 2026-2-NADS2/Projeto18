// Adapter Node (event bus) · extrator.
// Lê o código de um serviço e acha os handlers `bus.on('evento', (param) => { ... })`,
// extraindo o que cada um LÊ e ESCREVE no agregado.
//
// MVP honesto (mesma filosofia do adapter Postgres): leitura de texto por convenção.
// Assume handlers no formato `on('evento', (param) => { corpo })`. NÃO cobre
// destructuring de parâmetro, chamadas a outras funções que mutam o objeto, etc.

export interface ParsedHandler {
  /** nome do evento de domínio, ex.: "order.updated" */
  event: string;
  /** recurso = prefixo do evento antes do ponto (ex.: "order"). Convenção de microsserviços. */
  resource: string;
  reads: string[];
  writes: string[];
}

// cabeçalho do handler: [algo.]on[<Genérico>]('evento', [async] (param) => {
const HEADER_RE =
  /\bon\s*(?:<[^>]*>)?\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*(?:async\s*)?\(?\s*([a-zA-Z_]\w*)?\s*\)?\s*=>\s*\{/g;

export function parseHandlers(source: string): ParsedHandler[] {
  const clean = stripComments(source);
  const out: ParsedHandler[] = [];

  for (const m of clean.matchAll(HEADER_RE)) {
    const event = m[2];
    const param = m[3] ?? "";
    const openIdx = clean.indexOf("{", m.index);
    const body = extractBraceBlock(clean, openIdx);
    const { reads, writes } = extractFieldAccess(body, param);
    out.push({
      event,
      resource: event.split(".")[0],
      reads,
      writes,
    });
  }

  return out;
}

/** Dado o corpo de um handler e o nome do parâmetro, acha `param.campo` lidos/escritos. */
export function extractFieldAccess(
  body: string,
  param: string,
): { reads: string[]; writes: string[] } {
  if (!param) return { reads: [], writes: [] };
  const p = escapeRegExp(param);
  // escrita: param.campo = ...  (mas não ==, ===, <=, >=, !=)
  const writeRe = new RegExp(`\\b${p}\\s*\\.\\s*([a-zA-Z_]\\w*)\\s*=(?![=])`, "g");
  // qualquer referência param.campo
  const refRe = new RegExp(`\\b${p}\\s*\\.\\s*([a-zA-Z_]\\w*)`, "g");

  const writes = new Set<string>();
  for (const m of body.matchAll(writeRe)) writes.add(m[1]);

  const bodyNoLhs = body.replace(writeRe, " ");
  const reads = new Set<string>();
  for (const m of bodyNoLhs.matchAll(refRe)) reads.add(m[1]);

  return { reads: [...reads].sort(), writes: [...writes].sort() };
}

/** Extrai o bloco entre chaves começando no `{` em openIdx (conta profundidade). */
function extractBraceBlock(src: string, openIdx: number): string {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
  }
  return src.slice(openIdx + 1); // fallback se desbalanceado
}

function stripComments(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
