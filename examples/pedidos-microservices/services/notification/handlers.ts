import { bus, type Order } from "../../shared/bus.ts";

declare function sendEmail(addr: string): void;

// Serviço de NOTIFICAÇÃO: reage a OUTRO evento (order.paid).
// CONTROLE: balde diferente -> não deve brigar com os handlers de order.updated.
bus.on<Order>("order.paid", (order) => {
  sendEmail(order.email);
});
