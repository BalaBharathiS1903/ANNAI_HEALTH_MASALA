import orders.models
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Category",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("tamil_name", models.CharField(blank=True, max_length=160)),
                ("icon", models.CharField(blank=True, max_length=8)),
                ("description", models.TextField(blank=True)),
                ("tamil_description", models.TextField(blank=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
            ],
            options={
                "verbose_name_plural": "categories",
                "ordering": ["sort_order", "name"],
            },
        ),
        migrations.CreateModel(
            name="CustomerOrder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order_number", models.CharField(default=orders.models.make_order_number, max_length=16, unique=True)),
                ("customer_name", models.CharField(max_length=120)),
                ("customer_phone", models.CharField(max_length=30)),
                ("customer_address", models.TextField()),
                ("customer_notes", models.TextField(blank=True)),
                ("language", models.CharField(default="en", max_length=8)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("received", "Order Received"),
                            ("confirmed", "Confirmed"),
                            ("grinding", "Fresh Grinding"),
                            ("packed", "Packed"),
                            ("ready", "Ready"),
                            ("delivered", "Delivered"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="received",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="Product",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=160)),
                ("tamil_name", models.CharField(blank=True, max_length=180)),
                ("description", models.TextField(blank=True)),
                ("tamil_description", models.TextField(blank=True)),
                ("price_per_kg", models.DecimalField(decimal_places=2, default=0, max_digits=8)),
                ("image_url", models.URLField(blank=True)),
                ("is_available", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                (
                    "category",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="products", to="orders.category"),
                ),
            ],
            options={
                "ordering": ["category__sort_order", "sort_order", "name"],
            },
        ),
        migrations.CreateModel(
            name="OrderItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("product_name", models.CharField(max_length=160)),
                ("tamil_name", models.CharField(blank=True, max_length=180)),
                ("quantity_kg", models.DecimalField(decimal_places=2, max_digits=7)),
                ("unit_price", models.DecimalField(decimal_places=2, max_digits=8)),
                (
                    "order",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="orders.customerorder"),
                ),
                (
                    "product",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="orders.product"),
                ),
            ],
        ),
        migrations.CreateModel(
            name="OrderStatusEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("received", "Order Received"),
                            ("confirmed", "Confirmed"),
                            ("grinding", "Fresh Grinding"),
                            ("packed", "Packed"),
                            ("ready", "Ready"),
                            ("delivered", "Delivered"),
                            ("cancelled", "Cancelled"),
                        ],
                        max_length=20,
                    ),
                ),
                ("message", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "order",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="events", to="orders.customerorder"),
                ),
            ],
            options={
                "ordering": ["created_at"],
            },
        ),
    ]
