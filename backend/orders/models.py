import secrets
from uuid import uuid4

from django.contrib.auth.models import User
from django.db import models


def make_order_number():
    return f"AHM-{uuid4().hex[:8].upper()}"


def make_tracking_pin():
    return f"{secrets.randbelow(9000) + 1000}"


def make_auth_token():
    return secrets.token_hex(32)


class Category(models.Model):
    name = models.CharField(max_length=120)
    tamil_name = models.CharField(max_length=160, blank=True)
    icon = models.CharField(max_length=8, blank=True)
    description = models.TextField(blank=True)
    tamil_description = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Product(models.Model):
    category = models.ForeignKey(Category, related_name="products", on_delete=models.CASCADE)
    name = models.CharField(max_length=160)
    tamil_name = models.CharField(max_length=180, blank=True)
    description = models.TextField(blank=True)
    tamil_description = models.TextField(blank=True)
    price_per_kg = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    image_url = models.CharField(max_length=400, blank=True)
    is_available = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["category__sort_order", "sort_order", "name"]

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    user = models.OneToOneField(User, related_name="profile", on_delete=models.CASCADE)
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.user.username


class AuthToken(models.Model):
    user = models.ForeignKey(User, related_name="auth_tokens", on_delete=models.CASCADE)
    key = models.CharField(max_length=64, unique=True, default=make_auth_token)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} token"


class CustomerOrder(models.Model):
    STATUS_RECEIVED = "received"
    STATUS_CONFIRMED = "confirmed"
    STATUS_GRINDING = "grinding"
    STATUS_PACKED = "packed"
    STATUS_READY = "ready"
    STATUS_DELIVERED = "delivered"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_RECEIVED, "Order Received"),
        (STATUS_CONFIRMED, "Confirmed"),
        (STATUS_GRINDING, "Fresh Grinding"),
        (STATUS_PACKED, "Packed"),
        (STATUS_READY, "Ready"),
        (STATUS_DELIVERED, "Delivered"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    PAYMENT_COD = "cod"
    PAYMENT_CARD = "card"
    PAYMENT_NETBANKING = "netbanking"
    PAYMENT_UPI = "upi"
    PAYMENT_WALLET = "wallet"
    PAYMENT_ONLINE = "online"
    PAYMENT_METHOD_CHOICES = [
        (PAYMENT_COD, "Cash on Delivery"),
        (PAYMENT_CARD, "Debit / Credit Card"),
        (PAYMENT_NETBANKING, "Net Banking"),
        (PAYMENT_UPI, "UPI"),
        (PAYMENT_WALLET, "Payment Apps"),
        (PAYMENT_ONLINE, "Online Payment"),
    ]

    ONLINE_PAYMENT_METHODS = {
        PAYMENT_CARD,
        PAYMENT_NETBANKING,
        PAYMENT_UPI,
        PAYMENT_WALLET,
        PAYMENT_ONLINE,
    }

    PAYMENT_PENDING = "pending"
    PAYMENT_PAID = "paid"
    PAYMENT_FAILED = "failed"
    PAYMENT_REFUNDED = "refunded"
    PAYMENT_STATUS_CHOICES = [
        (PAYMENT_PENDING, "Pending"),
        (PAYMENT_PAID, "Paid"),
        (PAYMENT_FAILED, "Failed"),
        (PAYMENT_REFUNDED, "Refunded"),
    ]

    user = models.ForeignKey(User, null=True, blank=True, related_name="orders", on_delete=models.SET_NULL)
    order_number = models.CharField(max_length=16, unique=True, default=make_order_number)
    customer_name = models.CharField(max_length=120)
    customer_phone = models.CharField(max_length=30)
    customer_email = models.EmailField(blank=True)
    customer_address = models.TextField()
    customer_notes = models.TextField(blank=True)
    language = models.CharField(max_length=8, default="en")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_RECEIVED)
    order_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=16, choices=PAYMENT_METHOD_CHOICES, default=PAYMENT_COD)
    payment_status = models.CharField(max_length=16, choices=PAYMENT_STATUS_CHOICES, default=PAYMENT_PENDING)
    razorpay_order_id = models.CharField(max_length=100, blank=True)
    razorpay_payment_id = models.CharField(max_length=100, blank=True)
    tracking_pin = models.CharField(max_length=6, default=make_tracking_pin)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.order_number} - {self.customer_name}"


class OrderItem(models.Model):
    order = models.ForeignKey(CustomerOrder, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, null=True, blank=True, on_delete=models.SET_NULL)
    product_name = models.CharField(max_length=160)
    tamil_name = models.CharField(max_length=180, blank=True)
    quantity_kg = models.DecimalField(max_digits=7, decimal_places=2)
    unit_price = models.DecimalField(max_digits=8, decimal_places=2)

    @property
    def line_total(self):
        return self.quantity_kg * self.unit_price

    def __str__(self):
        return f"{self.product_name} x {self.quantity_kg}kg"


class Payment(models.Model):
    order = models.ForeignKey(CustomerOrder, related_name="payments", on_delete=models.CASCADE)
    method = models.CharField(max_length=16, choices=CustomerOrder.PAYMENT_METHOD_CHOICES)
    status = models.CharField(max_length=16, choices=CustomerOrder.PAYMENT_STATUS_CHOICES, default=CustomerOrder.PAYMENT_PENDING)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    razorpay_order_id = models.CharField(max_length=64, blank=True)
    razorpay_payment_id = models.CharField(max_length=64, blank=True)
    razorpay_signature = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.order.order_number} - {self.method} ({self.status})"


class OrderStatusEvent(models.Model):
    order = models.ForeignKey(CustomerOrder, related_name="events", on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=CustomerOrder.STATUS_CHOICES)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.order.order_number}: {self.status}"
