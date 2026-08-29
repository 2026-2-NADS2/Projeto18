from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Order


# Notificação: reage a OUTRO evento (post_save).
# CONTROLE: balde diferente -> não deve brigar com os de pre_save.
@receiver(post_save, sender=Order)
def send_confirmation(sender, instance, **kwargs):
    Mailer.send(instance.email)
