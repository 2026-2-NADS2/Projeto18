from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import Order


# Logística: gera o código de rastreio.
# CONTROLE: mesmo evento, mas campo exclusivo -> não deve acusar briga.
@receiver(pre_save, sender=Order)
def set_tracking_code(sender, instance, **kwargs):
    instance.tracking_code = "BR"
