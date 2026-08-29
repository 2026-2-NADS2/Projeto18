// Adapter Node (event bus / microsserviços).
export { parseHandlers, extractFieldAccess, type ParsedHandler } from "./extract.ts";
export { translateHandlers, type ServiceHandler } from "./translate.ts";
export { scanServices } from "./scan.ts";
