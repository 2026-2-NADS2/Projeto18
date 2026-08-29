import { bus, type Order } from "../../shared/bus.ts";

// Serviço de LOGÍSTICA: gera o código de rastreio.
// CONTROLE: reage ao mesmo evento, mas escreve um campo exclusivo (trackingCode)
// -> não deve acusar briga.
bus.on<Order>("order.updated", (order) => {
  order.trackingCode = "BR" + order.subtotal;
});
