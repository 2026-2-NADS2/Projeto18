from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import Order


# Impostos: também reage a pre_save de Order e reescreve o total.
# BRIGA (write-write) com precificação: os dois escrevem `total`.
@receiver(pre_save, sender=Order)
def apply_tax(sender, instance, **kwargs):
    instance.total = instance.subtotal * 1.1
