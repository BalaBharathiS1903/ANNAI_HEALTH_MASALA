from django.conf import settings
from django.http import HttpResponse


class SimpleCorsMiddleware:
    CORS_HEADERS = {
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Pin, Authorization",
        "Access-Control-Expose-Headers": "Content-Disposition",
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Short-circuit OPTIONS preflight without hitting the view
        if request.method == "OPTIONS":
            response = HttpResponse(status=200)
            response["Access-Control-Allow-Origin"] = settings.CORS_ALLOWED_ORIGIN
            for key, value in self.CORS_HEADERS.items():
                response[key] = value
            response["Access-Control-Max-Age"] = "86400"
            return response

        response = self.get_response(request)
        response["Access-Control-Allow-Origin"] = settings.CORS_ALLOWED_ORIGIN
        for key, value in self.CORS_HEADERS.items():
            response[key] = value
        return response
