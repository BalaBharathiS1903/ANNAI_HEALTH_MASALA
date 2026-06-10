import hashlib
import hmac
import json
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt

from .auth_helpers import (
    create_token,
    get_token_user,
    login_user,
    register_user,
    require_user,
    user_payload,
)
from .models import Category, CustomerOrder, OrderItem, OrderStatusEvent, Payment, Product

MIN_QUANTITY_KG = Decimal("0.25")
MAX_QUANTITY_KG = Decimal("100")


def options_response():
    response = JsonResponse({"ok": True})
    origin = settings.CORS_ALLOWED_ORIGIN
    response["Access-Control-Allow-Origin"] = origin
    response["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type, X-Admin-Pin, Authorization"
    return response


def json_response(data, status=200):
    response = JsonResponse(data, status=status)
    response["Access-Control-Allow-Origin"] = settings.CORS_ALLOWED_ORIGIN
    return response


def product_payload(product):
    return {
        "id": product.id,
        "name": product.name,
        "tamilName": product.tamil_name,
        "description": product.description,
        "tamilDescription": product.tamil_description,
        "price": float(product.price_per_kg),
        "image": product.image_url,
    }


def category_payload(category):
    return {
        "id": str(category.id),
        "icon": category.icon,
        "name": category.name,
        "tamilName": category.tamil_name,
        "description": category.description,
        "tamilDescription": category.tamil_description,
        "products": [product_payload(product) for product in category.products.filter(is_available=True)],
    }


def order_payload(order, include_sensitive=False):
    payload = {
        "order_number": order.order_number,
        "customer_name": order.customer_name,
        "status": order.status,
        "order_total": float(order.order_total),
        "payment_method": order.payment_method,
        "payment_status": order.payment_status,
        "created_at": order.created_at.isoformat(),
        "updated_at": order.updated_at.isoformat(),
        "items": [
            {
                "product_name": item.product_name,
                "tamil_name": item.tamil_name,
                "quantity_kg": float(item.quantity_kg),
                "unit_price": float(item.unit_price),
                "line_total": float(item.line_total),
            }
            for item in order.items.all()
        ],
        "events": [
            {
                "status": event.status,
                "message": event.message,
                "created_at": event.created_at.isoformat(),
            }
            for event in order.events.all()
        ],
    }
    if include_sensitive:
        payload.update(
            {
                "customer_phone": order.customer_phone,
                "customer_address": order.customer_address,
                "customer_notes": order.customer_notes,
                "tracking_pin": order.tracking_pin,
            }
        )
    return payload


def parse_body(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return {}


def require_admin(request):
    if request.headers.get("X-Admin-Pin") == settings.ADMIN_PIN:
        return True
    user = get_token_user(request)
    return bool(user and user.is_staff)


def sanitize_text(value, max_length=500):
    return str(value or "").strip()[:max_length]


def validate_order_items(items):
    if not items:
        return [], Decimal("0"), None

    validated = []
    total = Decimal("0")
    for item in items:
        product_id = item.get("product_id")
        product = Product.objects.filter(id=product_id, is_available=True).first()
        if not product:
            return None, None, f"Product {product_id} is not available."

        try:
            quantity = Decimal(str(item.get("quantity_kg", "1")))
        except (InvalidOperation, TypeError):
            return None, None, "Invalid quantity."

        if quantity < MIN_QUANTITY_KG or quantity > MAX_QUANTITY_KG:
            return None, None, f"Quantity must be between {MIN_QUANTITY_KG} and {MAX_QUANTITY_KG} kg."

        unit_price = product.price_per_kg
        if unit_price <= 0:
            return None, None, f"{product.name} requires price confirmation. Add it to notes instead."

        line_total = quantity * unit_price
        total += line_total
        validated.append(
            {
                "product": product,
                "product_name": product.name,
                "tamil_name": product.tamil_name,
                "quantity_kg": quantity,
                "unit_price": unit_price,
            }
        )
    return validated, total, None


def razorpay_client():
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        return None
    try:
        import razorpay

        return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    except ImportError:
        return None


def create_razorpay_order(order):
    client = razorpay_client()
    if not client:
        return None, "Online payment is not configured."

    amount_paise = int(order.order_total * 100)
    if amount_paise < 100:
        return None, "Order total is too low for online payment."

    razorpay_order = client.order.create(
        {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": order.order_number,
            "notes": {"order_number": order.order_number},
        }
    )
    payment = Payment.objects.create(
        order=order,
        method=CustomerOrder.PAYMENT_ONLINE,
        status=CustomerOrder.PAYMENT_PENDING,
        amount=order.order_total,
        razorpay_order_id=razorpay_order["id"],
    )
    return {
        "razorpay_order_id": razorpay_order["id"],
        "razorpay_key_id": settings.RAZORPAY_KEY_ID,
        "amount": amount_paise,
        "currency": "INR",
        "payment_id": payment.id,
    }, None


def menu(request):
    if request.method == "OPTIONS":
        return options_response()
    categories = Category.objects.prefetch_related("products").all()
    return json_response({"categories": [category_payload(category) for category in categories]})


def payment_config(_request):
    if _request.method == "OPTIONS":
        return options_response()
    client = razorpay_client()
    return json_response(
        {
            "online_enabled": bool(client),
            "razorpay_key_id": settings.RAZORPAY_KEY_ID if client else "",
            "currency": "INR",
        }
    )


@csrf_exempt
def register(request):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "POST":
        return json_response({"error": "POST required"}, status=405)

    user, error = register_user(parse_body(request))
    if error:
        return json_response({"error": error}, status=400)

    token = create_token(user)
    return json_response({"user": user_payload(user), "token": token.key}, status=201)


@csrf_exempt
def login(request):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "POST":
        return json_response({"error": "POST required"}, status=405)

    user, error = login_user(parse_body(request))
    if error:
        return json_response({"error": error}, status=401)

    token = create_token(user)
    return json_response({"user": user_payload(user), "token": token.key})


@csrf_exempt
def logout(request):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "POST":
        return json_response({"error": "POST required"}, status=405)

    user = get_token_user(request)
    if user:
        user.auth_tokens.all().delete()
    return json_response({"ok": True})


def me(request):
    if request.method == "OPTIONS":
        return options_response()
    user, error_response = require_user(request)
    if error_response:
        return error_response
    return json_response({"user": user_payload(user)})


@csrf_exempt
def create_order(request):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "POST":
        return json_response({"error": "POST required"}, status=405)

    data = parse_body(request)
    customer = data.get("customer", {})
    items = data.get("items", [])
    payment_method = data.get("payment_method", CustomerOrder.PAYMENT_COD)
    if payment_method not in {CustomerOrder.PAYMENT_COD, CustomerOrder.PAYMENT_ONLINE}:
        return json_response({"error": "Invalid payment method."}, status=400)

    required_fields = ["name", "phone", "address"]
    if any(not sanitize_text(customer.get(field)) for field in required_fields):
        return json_response({"error": "Customer name, phone, and address are required."}, status=400)
    if not items and not sanitize_text(customer.get("notes")):
        return json_response({"error": "Add an item or request note."}, status=400)

    validated_items, order_total, item_error = validate_order_items(items)
    if item_error:
        return json_response({"error": item_error}, status=400)

    if payment_method == CustomerOrder.PAYMENT_ONLINE and not razorpay_client():
        return json_response({"error": "Online payment is not available. Choose Cash on Delivery."}, status=400)

    auth_user = get_token_user(request)

    with transaction.atomic():
        order = CustomerOrder.objects.create(
            user=auth_user,
            customer_name=sanitize_text(customer["name"], 120),
            customer_phone=sanitize_text(customer["phone"], 30),
            customer_address=sanitize_text(customer["address"], 1000),
            customer_notes=sanitize_text(customer.get("notes"), 2000),
            language=data.get("language", "en"),
            order_total=order_total,
            payment_method=payment_method,
            payment_status=CustomerOrder.PAYMENT_PENDING,
        )
        for item in validated_items or []:
            OrderItem.objects.create(
                order=order,
                product=item["product"],
                product_name=item["product_name"],
                tamil_name=item["tamil_name"],
                quantity_kg=item["quantity_kg"],
                unit_price=item["unit_price"],
            )
        if payment_method == CustomerOrder.PAYMENT_COD:
            Payment.objects.create(
                order=order,
                method=CustomerOrder.PAYMENT_COD,
                status=CustomerOrder.PAYMENT_PENDING,
                amount=order_total,
            )
        OrderStatusEvent.objects.create(
            order=order,
            status=CustomerOrder.STATUS_RECEIVED,
            message="Your order has been received. We will confirm it shortly.",
        )

    response_data = {"order": order_payload(order, include_sensitive=True)}
    if payment_method == CustomerOrder.PAYMENT_ONLINE:
        razorpay_data, payment_error = create_razorpay_order(order)
        if payment_error:
            order.delete()
            return json_response({"error": payment_error}, status=400)
        response_data["payment"] = razorpay_data

    return json_response(response_data, status=201)


def order_detail(request, order_number):
    if request.method == "OPTIONS":
        return options_response()

    phone = sanitize_text(request.GET.get("phone"))
    pin = sanitize_text(request.GET.get("pin"))
    order = get_object_or_404(
        CustomerOrder.objects.prefetch_related("items", "events"), order_number=order_number
    )

    auth_user = get_token_user(request)
    is_owner = auth_user and order.user_id == auth_user.id
    is_admin = require_admin(request)
    phone_match = phone and phone.replace(" ", "") == order.customer_phone.replace(" ", "")
    pin_match = pin and pin == order.tracking_pin

    if not (is_owner or is_admin or phone_match or pin_match):
        return json_response(
            {"error": "Provide the phone number or tracking PIN used when placing the order."},
            status=403,
        )

    return json_response({"order": order_payload(order, include_sensitive=is_owner or is_admin or pin_match)})


@csrf_exempt
def verify_payment(request):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "POST":
        return json_response({"error": "POST required"}, status=405)

    data = parse_body(request)
    order_number = sanitize_text(data.get("order_number"))
    razorpay_order_id = sanitize_text(data.get("razorpay_order_id"))
    razorpay_payment_id = sanitize_text(data.get("razorpay_payment_id"))
    razorpay_signature = sanitize_text(data.get("razorpay_signature"), 128)

    if not all([order_number, razorpay_order_id, razorpay_payment_id, razorpay_signature]):
        return json_response({"error": "Missing payment verification fields."}, status=400)

    order = get_object_or_404(CustomerOrder, order_number=order_number)
    payment = Payment.objects.filter(order=order, razorpay_order_id=razorpay_order_id).first()
    if not payment:
        return json_response({"error": "Payment record not found."}, status=404)

    if not settings.RAZORPAY_KEY_SECRET:
        return json_response({"error": "Payment verification is not configured."}, status=400)

    message = f"{razorpay_order_id}|{razorpay_payment_id}".encode()
    generated = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        message,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(generated, razorpay_signature):
        payment.status = CustomerOrder.PAYMENT_FAILED
        payment.save(update_fields=["status"])
        order.payment_status = CustomerOrder.PAYMENT_FAILED
        order.save(update_fields=["payment_status", "updated_at"])
        return json_response({"error": "Payment verification failed."}, status=400)

    payment.status = CustomerOrder.PAYMENT_PAID
    payment.razorpay_payment_id = razorpay_payment_id
    payment.razorpay_signature = razorpay_signature
    payment.save(update_fields=["status", "razorpay_payment_id", "razorpay_signature"])
    order.payment_status = CustomerOrder.PAYMENT_PAID
    order.save(update_fields=["payment_status", "updated_at"])
    OrderStatusEvent.objects.create(
        order=order,
        status=order.status,
        message="Payment received successfully. Thank you!",
    )
    order = CustomerOrder.objects.prefetch_related("items", "events").get(pk=order.pk)
    return json_response({"order": order_payload(order, include_sensitive=True)})


def admin_orders(request):
    if request.method == "OPTIONS":
        return options_response()
    if not require_admin(request):
        return json_response({"error": "Invalid admin credentials."}, status=403)
    orders = CustomerOrder.objects.prefetch_related("items", "events").all()[:100]
    return json_response({"orders": [order_payload(order, include_sensitive=True) for order in orders]})


def admin_users(request):
    if request.method == "OPTIONS":
        return options_response()
    if not require_admin(request):
        return json_response({"error": "Invalid admin credentials."}, status=403)

    users = (
        User.objects.annotate(order_count=Count("orders"))
        .select_related("profile")
        .order_by("-date_joined")[:200]
    )
    return json_response(
        {
            "users": [
                {
                    **user_payload(user),
                    "order_count": user.order_count,
                }
                for user in users
            ]
        }
    )


@csrf_exempt
def update_order_status(request, order_number):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "PATCH":
        return json_response({"error": "PATCH required"}, status=405)
    if not require_admin(request):
        return json_response({"error": "Invalid admin credentials."}, status=403)

    data = parse_body(request)
    status = data.get("status")
    valid_statuses = {choice[0] for choice in CustomerOrder.STATUS_CHOICES}
    if status not in valid_statuses:
        return json_response({"error": "Invalid status."}, status=400)

    order = get_object_or_404(CustomerOrder, order_number=order_number)
    order.status = status
    order.save(update_fields=["status", "updated_at"])
    OrderStatusEvent.objects.create(
        order=order,
        status=status,
        message=sanitize_text(data.get("message"), 500)
        or f"Your order status is now {order.get_status_display()}.",
    )
    order = get_object_or_404(
        CustomerOrder.objects.prefetch_related("items", "events"), order_number=order_number
    )
    return json_response({"order": order_payload(order, include_sensitive=True)})
