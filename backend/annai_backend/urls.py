from django.contrib import admin
from django.urls import include, path
from django.http import JsonResponse


def health_check(_request):
    return JsonResponse({"status": "ok", "service": "ANNAI HEALTH MASALA"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check),
    path("api/", include("orders.urls")),
]
