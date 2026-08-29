// Carregadores de regras por "fonte" — compartilhados pela CLI.
// Cada fonte devolve Rule[] (o idioma padrão do motor), independente do sistema.

import { readFileSync } from "node:fs";
import type { Rule } from "../core/model.ts";
import { scan, type Parser } from "../adapters/shared/scan.ts";
import { toRules } from "../adapters/shared/translate.ts";
import { parseJava } from "../adapters/java-spring/extract.ts";
import { parsePython } from "../adapters/python-django/extract.ts";
import { parseCSharp } from "../adapters/dotnet-mediatr/extract.ts";
import { scanServices } from "../adapters/node-events/scan.ts";
import { translateHandlers } from "../adapters/node-events/translate.ts";

export interface LoadedSource {
  label: string;
  rules: Rule[];
}

function codeSource(ext: string, parse: Parser, defDir: string, lang: string) {
  return (arg?: string): LoadedSource => {
    const dir = arg ?? defDir;
    const items = scan(dir, ext, parse);
    return { label: `${lang} em ${dir} (${items.length} handlers)`, rules: toRules(items) };
  };
}

/** Fontes síncronas (não precisam de banco). `arg` = pasta ou caminho, conforme a fonte. */
const SYNC: Record<string, (arg?: string) => LoadedSource> = {
  node: (arg) => {
    const dir = arg ?? "examples/pedidos-microservices/services";
    const handlers = scanServices(dir);
    return { label: `microsserviços em ${dir} (${handlers.length} handlers)`, rules: translateHandlers(handlers) };
  },
  java: codeSource(".java", parseJava, "examples/pedidos-spring/services", "java"),
  python: codeSource(".py", parsePython, "examples/pedidos-django/services", "python"),
  csharp: codeSource(".cs", parseCSharp, "examples/pedidos-mediatr/services", "csharp"),
  fixture: (arg) => {
    if (!arg) throw new Error("fixture requer um caminho: explain fixture <arquivo.json>");
    return { label: arg, rules: JSON.parse(readFileSync(arg, "utf8")) as Rule[] };
  },
};

export const SOURCES = [...Object.keys(SYNC), "pg"];

/** Carrega as regras de uma fonte. `pg` é assíncrono (conecta no Postgres). */
export async function loadSource(source: string, arg?: string): Promise<LoadedSource> {
  if (source === "pg") {
    const { loadRulesFromPostgres } = await import("../adapters/postgres/connect.ts");
    const url =
      process.env.DATABASE_URL ??
      arg ??
      `postgres://${process.env.USER ?? "postgres"}@localhost:5432/grafo_teste`;
    console.error(`(conectando em: ${url})`);
    const rules = await loadRulesFromPostgres(url);
    return { label: `Postgres (${rules.length} triggers)`, rules };
  }

  const loader = SYNC[source];
  if (!loader) throw new Error(`fonte desconhecida: ${source}`);
  return loader(arg);
}
