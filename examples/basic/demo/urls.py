from django.urls import path

from demo import views

urlpatterns = [
    path('', views.Index.as_view()),
    path('contact/', views.ContactView.as_view()),
    path('course/', views.CourseView.as_view()),
]
