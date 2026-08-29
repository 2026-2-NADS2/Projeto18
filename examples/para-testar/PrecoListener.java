package com.loja.preco;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

// PRECIFICAÇÃO (Java/Spring): reage a PedidoAtualizado e escreve o total.
@Component
public class PrecoListener {

    @EventListener
    public void onPedidoAtualizado(PedidoAtualizado e) {
        e.setTotal(e.getSubtotal() - e.getDesconto());
    }
}
