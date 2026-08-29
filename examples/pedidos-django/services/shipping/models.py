from django.db import models


class Order(models.Model):
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    prev_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tier = models.CharField(max_length=20, default="regular")
    tracking_code = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
