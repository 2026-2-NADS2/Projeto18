// Serviço de AUDITORIA — reage ao MESMO evento "pedido.atualizado"
// e LÊ o total para gravar no log. Como não há ordem garantida entre os
// consumidores, ele pode ler o total ANTES de desconto/imposto escreverem →
// read-after-write com ordenação "unknown" (valor imprevisível no log).
import { bus } from "./bus";

bus.on("pedido.atualizado", (pedido) => {
  const registro = { id: pedido.id, valorRegistrado: pedido.total };
  gravarLog(registro);
});
