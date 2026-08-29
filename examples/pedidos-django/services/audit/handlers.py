from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import Order


# Auditoria: guarda o total anterior. LÊ `total`, que pricing e tax escrevem.
# Django não garante ordem entre receivers -> read-after-write imprevisível.
@receiver(pre_save, sender=Order)
def snapshot_prev_total(sender, instance, **kwargs):
    instance.prev_total = instance.total
