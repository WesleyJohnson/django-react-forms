from django.apps import AppConfig


class DjangoReactFormsConfig(AppConfig):
    name = 'django_react_forms'
    verbose_name = 'Django React Forms'
    default_auto_field = 'django.db.models.BigAutoField'

    def ready(self):
        from django_react_forms import adapters  # noqa: F401  (registers the Telepath adapters)
