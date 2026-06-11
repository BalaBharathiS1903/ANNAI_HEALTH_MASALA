import hashlib
import hmac
import json
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
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


def payment_payload(payment):
    return {
        "id": payment.id,
        "method": payment.method,
        "status": payment.status,
        "amount": float(payment.amount),
        "razorpay_order_id": payment.razorpay_order_id,
        "razorpay_payment_id": payment.razorpay_payment_id,
        "created_at": payment.created_at.isoformat(),
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
        "user_id": order.user_id,
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
        "payments": [payment_payload(payment) for payment in order.payments.all()],
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
    user = get_token_user(request)
    return bool(user and user.is_staff)


def sanitize_text(value, max_length=500):
    return str(value or "").strip()[:max_length]


def send_order_receipt(order):
    """Send order receipt email to customer and notification to admin."""
    if not order.customer_email:
        return

    items_text = "\n".join(
        f"  - {item.product_name} x {item.quantity_kg} kg = Rs.{item.line_total:.2f}"
        for item in order.items.all()
    )

    customer_subject = f"Order Received – {order.order_number} | ANNAI HEALTH MASALA"
    customer_body = f"""Dear {order.customer_name},

Thank you for your order! Here is your receipt.

Order Number : {order.order_number}
Tracking PIN : {order.tracking_pin}
Date         : {order.created_at.strftime('%d %b %Y, %I:%M %p')}

Items Ordered:
{items_text}

Order Total  : Rs.{order.order_total:.2f}
Payment      : {order.get_payment_method_display()}
Status       : {order.get_payment_status_display()}

Delivery Address:
{order.customer_address}

You can track your order using Order Number + Phone or Tracking PIN.

For any queries, call us:
70104 82463 | 83448 80228

Annai Health Foods,
Madakkudi, Pallividai, Samayapuram, Trichy-621 112
FSSAI Lic. No.: 22420308000104

Thank you for choosing ANNAI HEALTH MASALA!"""

    try:
        send_mail(customer_subject, customer_body, settings.DEFAULT_FROM_EMAIL, [order.customer_email], fail_silently=True)
    except Exception:
        pass

    # Notify admin
    if settings.ADMIN_EMAIL:
        admin_subject = f"New Order {order.order_number} – Rs.{order.order_total:.2f}"
        admin_body = f"""New order received.

Order  : {order.order_number}
Name   : {order.customer_name}
Phone  : {order.customer_phone}
Email  : {order.customer_email}
Total  : Rs.{order.order_total:.2f}
Method : {order.get_payment_method_display()}

Items:
{items_text}

Address: {order.customer_address}"""
        try:
            send_mail(admin_subject, admin_body, settings.DEFAULT_FROM_EMAIL, [settings.ADMIN_EMAIL], fail_silently=True)
        except Exception:
            pass


def send_payment_confirmation(order):
    """Send payment confirmed receipt to customer."""
    if not order.customer_email:
        return

    items_text = "\n".join(
        f"  - {item.product_name} x {item.quantity_kg} kg = Rs.{item.line_total:.2f}"
        for item in order.items.all()
    )

    subject = f"Payment Confirmed \u2013 {order.order_number} | ANNAI HEALTH MASALA"
    body = f"""Dear {order.customer_name},

Your payment has been received and confirmed. Here is your receipt.

Order Number  : {order.order_number}
Tracking PIN  : {order.tracking_pin}
Date          : {order.created_at.strftime('%d %b %Y, %I:%M %p')}

Items Ordered:
{items_text}

Order Total   : Rs.{order.order_total:.2f}
Payment Mode  : {order.get_payment_method_display()}
Payment Status: PAID

Delivery Address:
{order.customer_address}

Your order is now being processed. We will notify you at every step.

For queries:
  Phone : 70104 82463 | 83448 80228
  Visit : Annai Health Foods, Madakkudi,
          Pallividai, Samayapuram, Trichy-621 112

FSSAI Lic. No.: 22420308000104

Thank you for choosing ANNAI HEALTH MASALA!"""
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL,
                  [order.customer_email], fail_silently=True)
    except Exception:
        pass

def send_status_update_email(order, message):
    """Send order status update email to customer."""
    if not order.customer_email:
        return
    subject = f"Order Update \u2013 {order.order_number} | ANNAI HEALTH MASALA"
    body = f"""Dear {order.customer_name},

Here is an update on your order.

Order Number : {order.order_number}
Current Status: {order.get_status_display()}
Payment Status: {order.get_payment_status_display()}

Message from us:
{message}

Track your order anytime using Order Number + Phone or Tracking PIN: {order.tracking_pin}

For queries: 70104 82463 | 83448 80228
Annai Health Foods, Madakkudi, Pallividai, Samayapuram, Trichy-621 112
FSSAI Lic. No.: 22420308000104"""
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL,
                  [order.customer_email], fail_silently=True)
    except Exception:
        pass


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


@csrf_exempt
def razorpay_order_view(request):
    """POST /api/payments/create-order/ — create Razorpay order from server-side amount."""
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "POST":
        return json_response({"error": "POST required"}, status=405)

    data = parse_body(request)
    annai_order_number = sanitize_text(data.get("annai_order_number"))
    if not annai_order_number:
        return json_response({"error": "annai_order_number required"}, status=400)

    order = CustomerOrder.objects.filter(order_number=annai_order_number).first()
    if not order:
        return json_response({"error": "Order not found"}, status=404)

    # Amount always comes from DB — never from client
    amount_paise = int(order.order_total * 100)
    if amount_paise <= 0 or amount_paise > 100000000:
        return json_response({"error": "Invalid order amount"}, status=400)

    client = razorpay_client()
    if not client:
        return json_response({"error": "Online payment not configured"}, status=503)

    try:
        import razorpay as _rzp
        rz_order = client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": annai_order_number,
            "notes": {"shop": "Annai Health Masala"},
            "payment_capture": 1,
        })
    except Exception as e:
        return json_response({"error": f"Gateway error: {e}"}, status=502)

    # Save razorpay_order_id on CustomerOrder
    order.razorpay_order_id = rz_order["id"]
    order.save(update_fields=["razorpay_order_id", "updated_at"])

    # Also update or create corresponding Payment record
    Payment.objects.filter(order=order).update(
        razorpay_order_id=rz_order["id"]
    )

    return json_response({"razorpay_order_id": rz_order["id"], "amount": amount_paise})


@csrf_exempt
def webhook(request):
    """POST /api/payments/webhook/ — Razorpay event webhook."""
    if request.method != "POST":
        return json_response({"error": "POST required"}, status=405)

    sig = request.headers.get("X-Razorpay-Signature", "")
    secret = settings.RAZORPAY_KEY_SECRET
    if not secret:
        return json_response({"status": "ok"})

    import hmac as _hmac, hashlib as _hashlib
    expected = _hmac.new(secret.encode(), request.body, _hashlib.sha256).hexdigest()
    if not _hmac.compare_digest(expected, sig):
        return json_response({"error": "Invalid signature"}, status=400)

    try:
        event = json.loads(request.body)
    except Exception:
        return json_response({"status": "ok"})

    if event.get("event") == "payment.captured":
        rz_order_id = (
            event.get("payload", {})
            .get("payment", {})
            .get("entity", {})
            .get("order_id", "")
        )
        rz_payment_id = (
            event.get("payload", {})
            .get("payment", {})
            .get("entity", {})
            .get("id", "")
        )
        if rz_order_id:
            CustomerOrder.objects.filter(razorpay_order_id=rz_order_id).update(
                payment_status=CustomerOrder.PAYMENT_PAID,
                razorpay_payment_id=rz_payment_id,
            )
            Payment.objects.filter(razorpay_order_id=rz_order_id).update(
                status=CustomerOrder.PAYMENT_PAID,
                razorpay_payment_id=rz_payment_id,
            )

    return json_response({"status": "ok"})


def create_razorpay_order(order, payment_method=CustomerOrder.PAYMENT_ONLINE):
    client = razorpay_client()
    if not client:
        return None, "Online payment is not configured."

    amount_paise = int(order.order_total * 100)
    if amount_paise < 100:
        return None, "Order total is too low for online payment."

    stored_method = payment_method if payment_method in CustomerOrder.ONLINE_PAYMENT_METHODS else CustomerOrder.PAYMENT_ONLINE

    try:
        razorpay_order = client.order.create(
            {
                "amount": amount_paise,
                "currency": "INR",
                "receipt": order.order_number,
                "notes": {"order_number": order.order_number, "payment_method": stored_method},
            }
        )
        payment = Payment.objects.create(
            order=order,
            method=stored_method,
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
            "payment_method": stored_method,
        }, None
    except Exception as e:
        return None, f"Payment gateway error: {str(e)}"


def menu(request):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "GET":
        return json_response({"error": "GET required"}, status=405)
    categories = Category.objects.prefetch_related("products").all()
    return json_response({"categories": [category_payload(category) for category in categories]})


def payment_config(_request):
    if _request.method == "OPTIONS":
        return options_response()
    if _request.method != "GET":
        return json_response({"error": "GET required"}, status=405)
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
    valid_methods = {choice[0] for choice in CustomerOrder.PAYMENT_METHOD_CHOICES}
    if payment_method not in valid_methods:
        return json_response({"error": "Invalid payment method."}, status=400)

    required_fields = ["name", "phone", "address"]
    if any(not sanitize_text(customer.get(field)) for field in required_fields):
        return json_response({"error": "Customer name, phone, and address are required."}, status=400)
    if not items and not sanitize_text(customer.get("notes")):
        return json_response({"error": "Add an item or request note."}, status=400)

    validated_items, order_total, item_error = validate_order_items(items)
    if item_error:
        return json_response({"error": item_error}, status=400)

    is_online = payment_method in CustomerOrder.ONLINE_PAYMENT_METHODS
    if is_online and not razorpay_client():
        return json_response({"error": "Online payment is not available. Choose Cash on Delivery."}, status=400)

    auth_user = get_token_user(request)

    with transaction.atomic():
        order = CustomerOrder.objects.create(
            user=auth_user,
            customer_name=sanitize_text(customer["name"], 120),
            customer_phone=sanitize_text(customer["phone"], 30),
            customer_email=sanitize_text(customer.get("email", ""), 254),
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
        if not is_online:
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
    if is_online:
        razorpay_data, payment_error = create_razorpay_order(order, payment_method)
        if payment_error:
            order.delete()
            return json_response({"error": payment_error}, status=400)
        response_data["payment"] = razorpay_data

    # Send receipt email to customer and notification to admin
    send_order_receipt(order)
    return json_response(response_data, status=201)


def order_detail(request, order_number):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "GET":
        return json_response({"error": "GET required"}, status=405)

    phone = sanitize_text(request.GET.get("phone"))
    pin = sanitize_text(request.GET.get("pin"))
    order = get_object_or_404(
        CustomerOrder.objects.prefetch_related("items", "events", "payments"),
        order_number=order_number,
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

    if payment.status == CustomerOrder.PAYMENT_PAID:
        order = CustomerOrder.objects.prefetch_related("items", "events").get(pk=order.pk)
        return json_response({"order": order_payload(order, include_sensitive=True)})

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
    order.razorpay_payment_id = razorpay_payment_id
    order.save(update_fields=["payment_status", "razorpay_payment_id", "updated_at"])
    OrderStatusEvent.objects.create(
        order=order,
        status=order.status,
        message="Payment received successfully. Thank you!",
    )
    order = CustomerOrder.objects.prefetch_related("items", "events").get(pk=order.pk)
    return json_response({"order": order_payload(order, include_sensitive=True)})


def my_orders(request):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "GET":
        return json_response({"error": "GET required"}, status=405)
    user, error_response = require_user(request)
    if error_response:
        return error_response
    orders = (
        CustomerOrder.objects.filter(user=user)
        .prefetch_related("items", "events", "payments")
        .order_by("-created_at")[:50]
    )
    return json_response(
        {"orders": [order_payload(order, include_sensitive=True) for order in orders]}
    )


def admin_dashboard(request):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "GET":
        return json_response({"error": "GET required"}, status=405)
    if not require_admin(request):
        return json_response({"error": "Invalid admin credentials."}, status=403)

    total_orders = CustomerOrder.objects.count()
    active_orders = CustomerOrder.objects.exclude(
        status__in=[CustomerOrder.STATUS_DELIVERED, CustomerOrder.STATUS_CANCELLED]
    ).count()
    total_users = User.objects.filter(is_staff=False).count()
    total_revenue = (
        Payment.objects.filter(status=CustomerOrder.PAYMENT_PAID).aggregate(total=Sum("amount"))["total"]
        or 0
    )
    pending_payments = CustomerOrder.objects.filter(payment_status=CustomerOrder.PAYMENT_PENDING).count()

    orders_by_status = {
        status: CustomerOrder.objects.filter(status=status).count()
        for status, _ in CustomerOrder.STATUS_CHOICES
    }

    line_total = ExpressionWrapper(
        F("quantity_kg") * F("unit_price"),
        output_field=DecimalField(max_digits=12, decimal_places=2),
    )
    product_sales = (
        OrderItem.objects.values("product_name")
        .annotate(
            total_kg=Sum("quantity_kg"),
            revenue=Sum(line_total),
            order_count=Count("order_id", distinct=True),
        )
        .order_by("-revenue")[:15]
    )

    recent_orders = (
        CustomerOrder.objects.prefetch_related("items")
        .order_by("-created_at")[:12]
    )

    return json_response(
        {
            "stats": {
                "total_orders": total_orders,
                "active_orders": active_orders,
                "total_users": total_users,
                "total_revenue": float(total_revenue),
                "pending_payments": pending_payments,
            },
            "orders_by_status": orders_by_status,
            "product_sales": [
                {
                    "product_name": row["product_name"],
                    "total_kg": float(row["total_kg"] or 0),
                    "revenue": float(row["revenue"] or 0),
                    "order_count": row["order_count"],
                }
                for row in product_sales
            ],
            "recent_orders": [
                order_payload(order, include_sensitive=True) for order in recent_orders
            ],
        }
    )


def admin_orders(request):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "GET":
        return json_response({"error": "GET required"}, status=405)
    if not require_admin(request):
        return json_response({"error": "Invalid admin credentials."}, status=403)
    orders = (
        CustomerOrder.objects.prefetch_related("items", "events", "payments")
        .all()[:100]
    )
    return json_response({"orders": [order_payload(order, include_sensitive=True) for order in orders]})


def admin_payments(request):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "GET":
        return json_response({"error": "GET required"}, status=405)
    if not require_admin(request):
        return json_response({"error": "Invalid admin credentials."}, status=403)

    payments = (
        Payment.objects.select_related("order")
        .order_by("-created_at")[:100]
    )
    return json_response(
        {
            "payments": [
                {
                    **payment_payload(payment),
                    "order_number": payment.order.order_number,
                    "customer_name": payment.order.customer_name,
                    "customer_phone": payment.order.customer_phone,
                }
                for payment in payments
            ]
        }
    )


def admin_users(request):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "GET":
        return json_response({"error": "GET required"}, status=405)
    if not require_admin(request):
        return json_response({"error": "Invalid admin credentials."}, status=403)

    users = (
        User.objects.filter(is_staff=False)
        .annotate(order_count=Count("orders"))
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


def admin_user_detail(request, user_id):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "GET":
        return json_response({"error": "GET required"}, status=405)
    if not require_admin(request):
        return json_response({"error": "Invalid admin credentials."}, status=403)

    user = get_object_or_404(User.objects.select_related("profile"), pk=user_id)
    orders = (
        CustomerOrder.objects.filter(user=user)
        .prefetch_related("items", "events", "payments")
        .order_by("-created_at")
    )
    payments = Payment.objects.filter(order__user=user).select_related("order").order_by("-created_at")
    return json_response(
        {
            "user": {**user_payload(user), "order_count": orders.count()},
            "orders": [order_payload(order, include_sensitive=True) for order in orders],
            "payments": [
                {
                    **payment_payload(payment),
                    "order_number": payment.order.order_number,
                }
                for payment in payments
            ],
        }
    )


@csrf_exempt
def admin_notify(request, order_number):
    if request.method == "OPTIONS":
        return options_response()
    if request.method != "POST":
        return json_response({"error": "POST required"}, status=405)
    if not require_admin(request):
        return json_response({"error": "Invalid admin credentials."}, status=403)

    data = parse_body(request)
    message = sanitize_text(data.get("message"), 500)
    payment_status = data.get("payment_status")
    valid_payment_statuses = {choice[0] for choice in CustomerOrder.PAYMENT_STATUS_CHOICES}

    # message is optional when only updating payment status
    if not message and not payment_status:
        return json_response({"error": "Message or payment_status is required."}, status=400)

    order = get_object_or_404(CustomerOrder, order_number=order_number)

    if payment_status:
        if payment_status not in valid_payment_statuses:
            return json_response({"error": "Invalid payment status."}, status=400)
        order.payment_status = payment_status
        order.save(update_fields=["payment_status", "updated_at"])
        latest_payment = order.payments.order_by("-created_at").first()
        if latest_payment:
            latest_payment.status = payment_status
            latest_payment.save(update_fields=["status"])
        if not message:
            message = "Your payment has been received. Thank you!"
        if payment_status == CustomerOrder.PAYMENT_PAID:
            # Reload order with items for receipt
            order.refresh_from_db()
            send_payment_confirmation(order)

    OrderStatusEvent.objects.create(
        order=order,
        status=order.status,
        message=message,
    )
    # Always send email notification to customer
    send_status_update_email(order, message)
    order = get_object_or_404(
        CustomerOrder.objects.prefetch_related("items", "events", "payments"),
        order_number=order_number,
    )
    return json_response({"order": order_payload(order, include_sensitive=True)})


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
    notify_message = (
        sanitize_text(data.get("message"), 500)
        or f"Your order status is now {order.get_status_display()}."
    )
    OrderStatusEvent.objects.create(
        order=order,
        status=status,
        message=notify_message,
    )
    # Send email notification to customer
    send_status_update_email(order, notify_message)
    order = get_object_or_404(
        CustomerOrder.objects.prefetch_related("items", "events"), order_number=order_number
    )
    return json_response({"order": order_payload(order, include_sensitive=True)})
