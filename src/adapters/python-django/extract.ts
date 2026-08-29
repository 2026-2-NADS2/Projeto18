// Adapter Python / Django. Acha receivers de signals:
//   @receiver(pre_save, sender=Order)
//   def apply_tax(sender, instance, **kwargs):
//       instance.total = instance.subtotal * 1.1
// evento = o signal (pre_save); recurso = o sender (Order).
// lê/escreve = acessos a `instance.campo` no corpo (indentado).

import { stripHashComments, dotFieldAccess } from "../shared/text.ts";
import type { ParsedRule } from "../shared/types.ts";

const RECEIVER_RE =
  /@receiver\s*\(\s*([A-Za-z_]\w*)\s*,\s*sender\s*=\s*([A-Za-z_]\w*)\s*\)\s*\n\s*def\s+\w+\s*\([^)]*\)\s*:/g;

export function parsePython(source: string): ParsedRule[] {
  const clean = stripHashComments(source);
  const out: ParsedRule[] = [];

  for (const m of clean.matchAll(RECEIVER_RE)) {
    const event = m[1];
    const resource = m[2];
    const body = indentedBody(clean, m.index + m[0].length);
    const { reads, writes } = dotFieldAccess(body, "instance");
    out.push({ event, resource, reads, writes });
  }

  return out;
}

/** Corpo de uma função Python: do fim da linha `def ...:` até a próxima linha em coluna 0. */
function indentedBody(src: string, fromIdx: number): string {
  const rest = src.slice(fromIdx);
  // próxima linha que começa em coluna 0 (não-espaço) encerra o corpo indentado
  const end = rest.search(/\n(?=\S)/);
  return end === -1 ? rest : rest.slice(0, end);
}
