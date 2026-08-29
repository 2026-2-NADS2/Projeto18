// Serviço de FRETE — reage a "pedido.atualizado" mas escreve um campo
// EXCLUSIVO (valorFrete). Não briga com ninguém: é o controle "saudável"
// que mostra que o motor não gera falso-positivo.
import { bus } from "./bus";

bus.on("pedido.atualizado", (pedido) => {
  pedido.valorFrete = pedido.peso * 2.5;
});
