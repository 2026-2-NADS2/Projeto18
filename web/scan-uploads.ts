// Traduz arquivos ENVIADOS (em memória, não do disco) para o idioma padrão (Rule[]).
// Espelha o scan() de disco: escolhe o extrator pela extensão e usa o service
// derivado do nome do arquivo. Reaproveita os mesmos parsers da CLI.

import type { Rule } from "../src/core/model.ts";
import type { ParsedRule, ServiceRule } from "../src/adapters/shared/types.ts";
import { toRules } from "../src/adapters/shared/translate.ts";
import { parseJava } from "../src/adapters/java-spring/extract.ts";
import { parsePython } from "../src/adapters/python-django/extract.ts";
import { parseCSharp } from "../src/adapters/dotnet-mediatr/extract.ts";
import { parseHandlers } from "../src/adapters/node-events/extract.ts";

/** Um arquivo enviado pelo navegador. */
export interface UploadFile {
  name: string;
  content: string;
}

type Parse = (source: string) => ParsedRule[];

/** Extensão -> extrator. .ts/.js caem no adapter de microsserviços (event bus). */
const BY_EXT: Record<string, Parse> = {
  ".java": parseJava,
  ".py": parsePython,
  ".cs": parseCSharp,
  ".ts": parseHandlers,
  ".js": parseHandlers,
};

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

/** Nome do "serviço" = nome do arquivo sem extensão (ex.: "PricingHandler.cs" -> "PricingHandler"). */
function serviceOf(name: string): string {
  const base = (name.split("/").pop() ?? name).replace(/\.[^.]+$/, "");
  return base || name;
}

export interface UploadResult {
  rules: Rule[];
  parsed: number;
  skipped: string[];
}

/**
 * Converte os arquivos enviados em Rule[].
 * - Código (.java/.py/.cs/.ts/.js): extrai as regras com o parser da linguagem.
 * - Fixture (.json): interpreta o conteúdo como Rule[] já pronto.
 * Arquivos de extensão desconhecida entram em `skipped`.
 */
export function rulesFromUploads(files: UploadFile[]): UploadResult {
  const items: ServiceRule[] = [];
  const fixtures: Rule[] = [];
  const skipped: string[] = [];

  for (const f of files) {
    const ext = extOf(f.name);
    if (ext === ".json") {
      try {
        const parsed = JSON.parse(f.content);
        if (Array.isArray(parsed)) fixtures.push(...(parsed as Rule[]));
        else skipped.push(f.name);
      } catch {
        skipped.push(f.name);
      }
      continue;
    }
    const parse = BY_EXT[ext];
    if (!parse) {
      skipped.push(f.name);
      continue;
    }
    const service = serviceOf(f.name);
    for (const r of parse(f.content)) items.push({ ...r, service });
  }

  return {
    rules: [...toRules(items), ...fixtures],
    parsed: files.length - skipped.length,
    skipped,
  };
}
