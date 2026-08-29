// Passo 7 · Parte B — comando que roda contra um Postgres real.
// Uso:  DATABASE_URL="postgres://user:pass@localhost:5432/db" npm run report:pg
// Requer `npm install pg` e o banco carregado com fixtures/postgres-schema.sql.

import { loadRulesFromPostgres } from "../adapters/postgres/connect.ts";
import { runReport } from "./print.ts";

// Ordem de preferência: variável DATABASE_URL > argumento > padrão local (Postgres.app).
const defaultUrl = `postgres://${process.env.USER ?? "postgres"}@localhost:5432/grafo_teste`;
const url = process.env.DATABASE_URL ?? process.argv[2] ?? defaultUrl;
console.error(`(conectando em: ${url})`);

const rules = await loadRulesFromPostgres(url);
runReport(rules, `Postgres (${rules.length} triggers)`);
