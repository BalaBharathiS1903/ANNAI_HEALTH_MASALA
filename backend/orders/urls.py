from django.urls import path

from . import views

urlpatterns = [
    path("menu/", views.menu),
    path("payment/config/", views.payment_config),
    path("auth/register/", views.register),
    path("auth/login/", views.login),
    path("auth/logout/", views.logout),
    path("auth/me/", views.me),
    path("orders/", views.create_order),
    path("orders/<str:order_number>/", views.order_detail),
    path("payments/verify/", views.verify_payment),
    path("admin/orders/", views.admin_orders),
    path("admin/users/", views.admin_users),
    path("admin/orders/<str:order_number>/status/", views.update_order_status),
]
