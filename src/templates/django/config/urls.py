from django.contrib import admin
from django.urls import path
from django.http import JsonResponse

def health(request):
    return JsonResponse({"status": "ok"})

def index(request):
    return JsonResponse({"message": "Hello from {{PROJECT_NAME}}"})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', index),
    path('health/', health),
]
