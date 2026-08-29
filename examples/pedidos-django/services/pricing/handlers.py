from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import Order


# Precificação: aplica o desconto do tier antes de salvar.
@receiver(pre_save, sender=Order)
def apply_discount(sender, instance, **kwargs):
    instance.total = instance.subtotal * (0.9 if instance.tier == "vip" else 1.0)
