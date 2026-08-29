package com.techlar.tax;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class TaxListener {

    // Impostos: também reage a OrderUpdated e reescreve o total.
    // BRIGA (write-write) com PricingListener: os dois escrevem `total`.
    @EventListener
    public void onOrderUpdated(OrderUpdated e) {
        e.setTotal(e.getSubtotal() * 1.1);
    }
}
