import { bus, type Order } from "../../shared/bus.ts";

// Serviço de IMPOSTOS: também reage a order.updated e recalcula o total com imposto.
// BRIGA (write-write) com o serviço de precificação: os dois escrevem `total`.
bus.on<Order>("order.updated", (order) => {
  order.total = order.subtotal * 1.1;
});
