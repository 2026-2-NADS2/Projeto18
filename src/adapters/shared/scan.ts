import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import type { ParsedRule, ServiceRule } from "./types.ts";

/** Assinatura de um extrator de linguagem: recebe o texto de um arquivo, devolve as regras. */
export type Parser = (source: string) => ParsedRule[];

/**
 * Varre uma pasta de serviços, lê cada arquivo com a extensão dada e aplica o
 * extrator. O nome do serviço = a primeira subpasta abaixo da raiz.
 * (services/pricing/PricingListener.java -> serviço "pricing")
 */
export function scan(root: string, ext: string, parse: Parser): ServiceRule[] {
  const out: ServiceRule[] = [];
  const entries = readdirSync(root, { recursive: true }) as string[];
  for (const rel of entries) {
    if (!rel.endsWith(ext)) continue;
    const service = rel.split(sep)[0];
    const source = readFileSync(join(root, rel), "utf8");
    for (const h of parse(source)) out.push({ ...h, service });
  }
  return out;
}
