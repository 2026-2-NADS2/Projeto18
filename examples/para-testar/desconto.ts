// Serviço de DESCONTO — reage a "pedido.atualizado" e escreve o total.
// Sozinho, está perfeito.
import { bus } from "./bus";

bus.on("pedido.atualizado", (pedido) => {
  const desconto = pedido.subtotal * pedido.percentualDesconto;
  pedido.total = pedido.subtotal - desconto;
});
