// Serviço de IMPOSTO — reage ao MESMO evento "pedido.atualizado"
// e também escreve o total (agora somando o imposto). Sozinho, também está perfeito.
// Mas ninguém garante quem roda por último → o total final é imprevisível.
import { bus } from "./bus";

bus.on("pedido.atualizado", (pedido) => {
  const imposto = pedido.subtotal * pedido.aliquota;
  pedido.total = pedido.subtotal + imposto;
});
