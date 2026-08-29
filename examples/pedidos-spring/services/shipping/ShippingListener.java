package com.techlar.shipping;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class ShippingListener {

    // Logística: gera o código de rastreio.
    // CONTROLE: mesmo evento, mas campo exclusivo -> não deve acusar briga.
    @EventListener
    public void onOrderUpdated(OrderUpdated e) {
        e.setTrackingCode("BR");
    }
}
