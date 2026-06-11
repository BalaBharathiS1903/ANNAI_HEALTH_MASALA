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
    path("orders/my/", views.my_orders),
    path("orders/<str:order_number>/", views.order_detail),
    path("payments/verify/", views.verify_payment),
    path("payments/create-order/", views.razorpay_order_view),
    path("payments/webhook/", views.webhook),
    path("admin/dashboard/", views.admin_dashboard),
    path("admin/orders/", views.admin_orders),
    path("admin/orders/<str:order_number>/notify/", views.admin_notify),
    path("admin/orders/<str:order_number>/status/", views.update_order_status),
    path("admin/payments/", views.admin_payments),
    path("admin/users/", views.admin_users),
    path("admin/users/<int:user_id>/", views.admin_user_detail),
    path("admin/export/excel/", views.admin_export_excel),
    path("admin/export/receipt/<str:order_number>/", views.admin_export_receipt_pdf),
]
