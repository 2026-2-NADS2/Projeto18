// Comando que roda o motor sobre um backend de microsserviços Node.
// Uso:  npm run report:node -- [pasta_dos_servicos]
// Padrão: examples/pedidos-microservices/services

import { scanServices } from "../adapters/node-events/scan.ts";
import { translateHandlers } from "../adapters/node-events/translate.ts";
import { runReport } from "./print.ts";

const dir = process.argv[2] ?? "examples/pedidos-microservices/services";
const handlers = scanServices(dir);
const rules = translateHandlers(handlers);
runReport(rules, `microsserviços em ${dir} (${handlers.length} handlers)`);
