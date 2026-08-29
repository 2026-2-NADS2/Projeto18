package com.techlar.audit;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class AuditListener {

    // Auditoria: guarda o total anterior. LÊ `total`, que pricing e tax escrevem.
    // Spring não garante ordem entre listeners -> read-after-write imprevisível.
    @EventListener
    public void onOrderUpdated(OrderUpdated e) {
        e.setPrevTotal(e.getTotal());
    }
}
