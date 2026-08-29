import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { parseHandlers } from "./extract.ts";
import type { ServiceHandler } from "./translate.ts";

/**
 * Varre uma pasta de microsserviços (`services/`), lê cada arquivo .ts e extrai
 * os handlers. O nome do serviço = a primeira subpasta abaixo da raiz varrida
 * (ex.: services/pricing/handlers.ts -> serviço "pricing").
 */
export function scanServices(root: string): ServiceHandler[] {
  const out: ServiceHandler[] = [];

  const entries = readdirSync(root, { recursive: true }) as string[];
  for (const rel of entries) {
    if (!rel.endsWith(".ts")) continue;
    const service = rel.split(sep)[0];
    const source = readFileSync(join(root, rel), "utf8");
    for (const h of parseHandlers(source)) {
      out.push({ ...h, service });
    }
  }

  return out;
}
