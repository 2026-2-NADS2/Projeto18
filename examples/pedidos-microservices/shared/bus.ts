// Event bus compartilhado entre os microsserviços (exemplo simplificado).
// Cada serviço se inscreve num evento de domínio e reage a ele.

type Handler<T> = (payload: T) => void | Promise<void>;

const registry = new Map<string, Handler<any>[]>();

export const bus = {
  on<T>(event: string, handler: Handler<T>): void {
    const list = registry.get(event) ?? [];
    list.push(handler);
    registry.set(event, list);
  },
  emit<T>(event: string, payload: T): void {
    for (const h of registry.get(event) ?? []) h(payload);
  },
};

/** O agregado "Pedido" que trafega nos eventos. */
export interface Order {
  subtotal: number;
  total: number;
  prevTotal: number;
  tier: string;
  trackingCode: string;
  email: string;
}
