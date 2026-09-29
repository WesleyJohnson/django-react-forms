from django.apps import AppConfig


class QuillConfig(AppConfig):
    name = 'django_react_forms.quill'
    label = 'django_react_forms_quill'
    verbose_name = 'Django React Forms: Quill'

    def ready(self):
        from django_quill.forms import QuillFormField

        from django_react_forms.forms import register_data_normalizer
        from django_react_forms.quill import adapters  # noqa: F401  (registers the adapters)
        from django_react_forms.quill.normalize import normalize_quill_value

        register_data_normalizer(QuillFormField, normalize_quill_value)
