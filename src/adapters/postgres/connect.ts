// Passo 7 · Parte B — a "tomada": conecta num Postgres real e puxa os triggers.
//
// ⚠️ REQUER: `npm install pg` + um Postgres rodando. De propósito, este arquivo
// fica ISOLADO — o core e os testes NÃO o importam, então o projeto continua
// rodando com zero dependências até você decidir ligar num banco de verdade.

import { Client } from "pg";
import { translateTriggers, type PgTriggerRow } from "./translate.ts";
import type { Rule } from "../../core/model.ts";

// Lê, do catálogo do Postgres, cada trigger + o código-fonte da sua função.
// tgtype é um bitmask: 2=BEFORE, 4=INSERT, 8=DELETE, 16=UPDATE, 64=INSTEAD OF.
const TRIGGER_QUERY = `
  SELECT
    t.tgname AS trigger_name,
    c.relname AS table_name,
    CASE
      WHEN (t.tgtype & 64) <> 0 THEN 'INSTEAD OF'
      WHEN (t.tgtype & 2)  <> 0 THEN 'BEFORE'
      ELSE 'AFTER'
    END AS timing,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN (t.tgtype & 4)  <> 0 THEN 'INSERT' END,
      CASE WHEN (t.tgtype & 8)  <> 0 THEN 'DELETE' END,
      CASE WHEN (t.tgtype & 16) <> 0 THEN 'UPDATE' END
    ], NULL) AS events,
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_source
  FROM pg_trigger t
  JOIN pg_class c     ON c.oid = t.tgrelid
  JOIN pg_proc p      ON p.oid = t.tgfoid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal
    AND n.nspname = 'public'
  ORDER BY c.relname, t.tgname;
`;

/** Conecta no Postgres e devolve as regras já traduzidas para o idioma padrão. */
export async function loadRulesFromPostgres(connectionString: string): Promise<Rule[]> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query(TRIGGER_QUERY);
    const triggerRows: PgTriggerRow[] = rows.map((r) => ({
      triggerName: r.trigger_name,
      tableName: r.table_name,
      timing: r.timing,
      events: r.events,
      functionName: r.function_name,
      functionSource: r.function_source,
    }));
    return translateTriggers(triggerRows);
  } finally {
    await client.end();
  }
}
