// Utilitários de leitura de texto reusados pelos extratores de código.
// Filosofia MVP: heurística por convenção (regex + contagem de chaves), como no
// adapter Postgres. Robusto para os padrões comuns; não é um compilador.

export function stripCComments(src: string): string {
  return src.replace(/\/\/[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}

export function stripHashComments(src: string): string {
  return src.replace(/#[^\n]*/g, " ");
}

/** Extrai o bloco entre chaves começando no `{` em openIdx (conta profundidade). */
export function braceBlock(src: string, openIdx: number): string {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
  }
  return src.slice(openIdx + 1);
}

/** Acessos no estilo `param.campo`: `param.campo = ...` é escrita; `param.campo` é leitura. */
export function dotFieldAccess(
  body: string,
  param: string,
): { reads: string[]; writes: string[] } {
  if (!param) return { reads: [], writes: [] };
  const p = escapeRegExp(param);
  const writeRe = new RegExp(`\\b${p}\\s*\\.\\s*([A-Za-z_]\\w*)\\s*=(?![=])`, "g");
  const refRe = new RegExp(`\\b${p}\\s*\\.\\s*([A-Za-z_]\\w*)`, "g");

  const writes = new Set<string>();
  for (const m of body.matchAll(writeRe)) writes.add(m[1]);

  const bodyNoLhs = body.replace(writeRe, " ");
  const reads = new Set<string>();
  for (const m of bodyNoLhs.matchAll(refRe)) reads.add(m[1]);

  return { reads: [...reads].sort(), writes: [...writes].sort() };
}

/** Acessos no estilo getter/setter (Java): `param.setX(...)` escreve x; `param.getX(...)` lê x. */
export function getterSetterAccess(
  body: string,
  param: string,
): { reads: string[]; writes: string[] } {
  if (!param) return { reads: [], writes: [] };
  const p = escapeRegExp(param);
  const setRe = new RegExp(`\\b${p}\\s*\\.\\s*set([A-Z]\\w*)\\s*\\(`, "g");
  const getRe = new RegExp(`\\b${p}\\s*\\.\\s*get([A-Z]\\w*)\\s*\\(`, "g");

  const writes = new Set<string>();
  for (const m of body.matchAll(setRe)) writes.add(decap(m[1]));
  const reads = new Set<string>();
  for (const m of body.matchAll(getRe)) reads.add(decap(m[1]));

  return { reads: [...reads].sort(), writes: [...writes].sort() };
}

const RESOURCE_SUFFIXES = [
  "Updated", "Created", "Deleted", "Paid", "Changed",
  "Removed", "Added", "Placed", "Cancelled", "Canceled",
];

/** Deriva o recurso de um nome de evento (ex.: "OrderUpdated" -> "Order"). */
export function deriveResource(event: string): string {
  for (const s of RESOURCE_SUFFIXES) {
    if (event.endsWith(s) && event.length > s.length) return event.slice(0, -s.length);
  }
  return event;
}

export function decap(s: string): string {
  return s.length ? s[0].toLowerCase() + s.slice(1) : s;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
