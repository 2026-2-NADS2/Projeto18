package com.techlar.pricing;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class PricingListener {

    // Precificação: aplica o desconto do tier ao total.
    @EventListener
    public void onOrderUpdated(OrderUpdated e) {
        e.setTotal(e.getSubtotal() * (e.getTier().equals("vip") ? 0.9 : 1.0));
    }
}
