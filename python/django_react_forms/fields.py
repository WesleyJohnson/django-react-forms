import json

from django import forms
from django.core.exceptions import ValidationError
from django.forms.fields import InvalidJSONInput
from django.utils.translation import gettext_lazy as _
from django.utils.translation import ngettext_lazy

from django_react_forms.widgets import TagInput

__all__ = ['TagField']


class TagField(forms.JSONField):
    """
    A list of free-text tags, drawn by the React form as a pill input.

    Cleans to a list of stripped, non-empty strings with case-insensitive duplicates removed
    (first spelling wins). Store it in a ``models.JSONField``. Accepts a list (JSON request
    bodies) or a JSON-encoded list (multipart bodies).
    """

    widget = TagInput
    default_error_messages = {
        'invalid': _('Enter a list of tags.'),
        'max_tags': ngettext_lazy(
            'Enter no more than %(limit)d tag.', 'Enter no more than %(limit)d tags.', 'limit'
        ),
        'max_tag_length': ngettext_lazy(
            'Tags must be %(limit)d character or fewer.',
            'Tags must be %(limit)d characters or fewer.',
            'limit',
        ),
    }

    def __init__(self, *, max_tags=None, max_tag_length=None, **kwargs):
        self.max_tags = max_tags
        self.max_tag_length = max_tag_length
        super().__init__(**kwargs)
        if isinstance(self.widget, TagInput):
            self.widget.props = {
                **self.widget.props,
                'maxTags': max_tags,
                'maxTagLength': max_tag_length,
            }

    def to_python(self, value):
        if self.disabled:
            return value
        if value in self.empty_values:
            return []
        if isinstance(value, str):
            try:
                value = json.loads(value, cls=self.decoder)
            except json.JSONDecodeError:
                raise ValidationError(self.error_messages['invalid'], code='invalid') from None
        if not isinstance(value, (list, tuple)):
            raise ValidationError(self.error_messages['invalid'], code='invalid')

        tags, seen = [], set()
        for tag in value:
            if isinstance(tag, bool) or not isinstance(tag, (str, int, float)):
                raise ValidationError(self.error_messages['invalid'], code='invalid')
            tag = str(tag).strip()
            if tag and tag.casefold() not in seen:
                seen.add(tag.casefold())
                tags.append(tag)
        return tags

    def validate(self, value):
        super().validate(value)
        if self.max_tags is not None and len(value) > self.max_tags:
            raise ValidationError(
                self.error_messages['max_tags'], code='max_tags', params={'limit': self.max_tags}
            )
        if self.max_tag_length is not None and any(len(tag) > self.max_tag_length for tag in value):
            raise ValidationError(
                self.error_messages['max_tag_length'],
                code='max_tag_length',
                params={'limit': self.max_tag_length},
            )

    def bound_data(self, data, initial):
        # JSON request bodies hand us the list itself; JSONField.bound_data would json.loads() it
        if not self.disabled and isinstance(data, (list, tuple)):
            return list(data)
        return super().bound_data(data, initial)

    def prepare_value(self, value):
        if isinstance(value, InvalidJSONInput):
            return value
        return super().prepare_value([] if value is None else value)

    def has_changed(self, initial, data):
        if self.disabled:
            return False
        try:
            return self.to_python(initial) != self.to_python(data)
        except ValidationError:
            return True
