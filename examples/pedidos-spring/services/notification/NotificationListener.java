package com.techlar.notification;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class NotificationListener {

    private Mailer mailer;

    // Notificação: reage a OUTRO evento (OrderPaid).
    // CONTROLE: balde diferente -> não deve brigar com os de OrderUpdated.
    @EventListener
    public void onOrderPaid(OrderPaid e) {
        mailer.send(e.getEmail());
    }
}
