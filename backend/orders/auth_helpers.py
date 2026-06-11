import re

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.http import JsonResponse

from .models import AuthToken, UserProfile

PHONE_PATTERN = re.compile(r"^\+?[\d\s\-]{8,15}$")


def user_payload(user):
    profile = getattr(user, "profile", None)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "name": user.get_full_name() or user.first_name or user.username,
        "phone": profile.phone if profile else "",
        "address": profile.address if profile else "",
        "is_staff": user.is_staff,
        "date_joined": user.date_joined.isoformat(),
    }


def get_token_user(request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token_key = auth_header[7:].strip()
    if not token_key:
        return None
    token = AuthToken.objects.select_related("user").filter(key=token_key).first()
    return token.user if token else None


def require_user(request):
    user = get_token_user(request)
    if not user:
        return None, JsonResponse({"error": "Authentication required."}, status=401)
    return user, None


def create_token(user):
    AuthToken.objects.filter(user=user).delete()
    return AuthToken.objects.create(user=user)


def register_user(data):
    username = str(data.get("username", "")).strip().lower()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    name = str(data.get("name", "")).strip()
    phone = str(data.get("phone", "")).strip()

    if not username or not password:
        return None, "Username and password are required."
    if len(password) < 8:
        return None, "Password must be at least 8 characters."
    if User.objects.filter(username=username).exists():
        return None, "Username already taken."
    if email and User.objects.filter(email=email).exists():
        return None, "Email already registered."
    if phone and not PHONE_PATTERN.match(phone):
        return None, "Invalid phone number format."

    try:
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=name[:120],
        )
        UserProfile.objects.create(user=user, phone=phone, address=str(data.get("address", "")).strip())
        return user, None
    except Exception as e:
        return None, f"Failed to create user: {str(e)}"


def login_user(data):
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))
    if not username or not password:
        return None, "Username and password are required."

    user = authenticate(username=username, password=password)
    if not user:
        user = User.objects.filter(email=username).first()
        if user:
            user = authenticate(username=user.username, password=password)
    if not user:
        return None, "Invalid username or password."
    if not user.is_active:
        return None, "Account is disabled."
    return user, None
