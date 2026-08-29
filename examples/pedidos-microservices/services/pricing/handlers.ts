import { bus, type Order } from "../../shared/bus.ts";

// Serviço de PRECIFICAÇÃO: quando um pedido é atualizado, aplica o desconto do tier.
bus.on<Order>("order.updated", (order) => {
  order.total = order.subtotal * (1 - (order.tier === "vip" ? 0.1 : 0));
});
