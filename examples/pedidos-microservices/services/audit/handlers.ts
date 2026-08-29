import { bus, type Order } from "../../shared/bus.ts";

// Serviço de AUDITORIA: guarda o total anterior.
// Ele LÊ `total` — que precificação e impostos ESCREVEM no mesmo evento.
// Em microsserviços não há ordem garantida entre consumidores: o valor que ele
// lê é imprevisível (read-after-write com ordering = unknown).
bus.on<Order>("order.updated", (order) => {
  order.prevTotal = order.total;
});
