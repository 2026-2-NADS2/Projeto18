// Adapter Postgres. Parte A (pura, testável, sem deps) e Parte B (conecta no banco).
export { extractFieldAccess, type FieldAccess } from "./extract.ts";
export { translateTriggers, type PgTriggerRow } from "./translate.ts";
// Parte B: exporte só quando `pg` estiver instalado.
// export { loadRulesFromPostgres } from "./connect.ts";
