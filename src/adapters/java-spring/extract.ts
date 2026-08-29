// Adapter Java / Spring. Acha métodos anotados com @EventListener.
//   @EventListener
//   public void onOrderUpdated(OrderUpdated e) { e.setTotal(e.getSubtotal()...); }
// evento = tipo do parâmetro; recurso = evento sem o sufixo verbal ("OrderUpdated"->"Order").
// lê/escreve = getters/setters chamados no parâmetro (e.getX / e.setX).

import { stripCComments, braceBlock, getterSetterAccess, deriveResource } from "../shared/text.ts";
import type { ParsedRule } from "../shared/types.ts";

const HANDLER_RE =
  /@EventListener\s+(?:@\w+[^\n]*\s+)*(?:public\s+|private\s+|protected\s+)?(?:void|[\w.<>]+)\s+\w+\s*\(\s*(?:final\s+)?([A-Za-z_][\w.]*)\s+(\w+)\s*\)\s*\{/g;

export function parseJava(source: string): ParsedRule[] {
  const clean = stripCComments(source);
  const out: ParsedRule[] = [];

  for (const m of clean.matchAll(HANDLER_RE)) {
    const event = m[1];
    const param = m[2];
    const openIdx = clean.indexOf("{", m.index + m[0].length - 1);
    const body = braceBlock(clean, openIdx);
    const { reads, writes } = getterSetterAccess(body, param);
    out.push({ event, resource: deriveResource(event), reads, writes });
  }

  return out;
}
