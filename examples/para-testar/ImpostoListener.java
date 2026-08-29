package com.loja.imposto;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

// IMPOSTO (Java/Spring): reage ao MESMO PedidoAtualizado e também escreve o total.
// BRIGA write-write com PrecoListener — os dois gravam `total`.
@Component
public class ImpostoListener {

    @EventListener
    public void onPedidoAtualizado(PedidoAtualizado e) {
        e.setTotal(e.getSubtotal() * e.getAliquota());
    }
}
