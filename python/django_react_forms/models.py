from django.db import models

__all__ = ['TagListField']


class TagListField(models.JSONField):
    """
    A JSON array of free-text tags. ModelForms draw it with ``TagField`` (the pill input), so no
    form-level override is needed.
    """

    def __init__(self, *args, **kwargs):
        kwargs.setdefault('default', list)
        super().__init__(*args, **kwargs)

    def formfield(self, **kwargs):
        from django_react_forms.fields import TagField

        return super().formfield(**{'form_class': TagField, **kwargs})
