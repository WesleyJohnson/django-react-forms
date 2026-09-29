"""
Telepath adapters: how the Python objects that make up a form are serialized for the JS side.

Each adapter names a JS constructor (``dreact.*``) that ``js/src/adapters`` registers on its
Telepath instance. Adapters for optional integrations live with them (see
``django_react_forms.quill``).
"""

from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID

from django import forms
from django.db.models.fields.files import FieldFile
from django.forms.models import ModelChoiceIterator, ModelChoiceIteratorValue
from django.utils import timezone
from telepath import Adapter, register

__all__ = ['WidgetAdapter']


class WidgetAdapter(Adapter):
    """Any widget: its class name picks the React component, ``component``/``props`` override it."""

    js_constructor = 'dreact.Widget'

    def js_args(self, widget):
        return [
            widget.__class__.__name__,
            getattr(widget, 'component', None),
            getattr(widget, 'props', {}),
            widget.attrs.get('class', ''),
            widget.attrs.get('style', ''),
            widget.attrs.get('placeholder', ''),
        ]


class ModelChoiceIteratorAdapter(Adapter):
    js_constructor = 'dreact.ChoiceList'

    def js_args(self, iterator):
        # Iterating yields (ModelChoiceIteratorValue, label) pairs; the value carries both
        if getattr(iterator, 'queryset', None) is None:
            return []
        return [
            choice[0] if isinstance(choice[0], ModelChoiceIteratorValue) else choice
            for choice in iterator
        ]


class ModelChoiceIteratorValueAdapter(Adapter):
    js_constructor = 'dreact.Choice'

    def js_args(self, value):
        # value, label - both strings so they match the string value ModelChoiceField sends
        return [f'{value.value}', f'{value.instance}']


class FieldFileAdapter(Adapter):
    """An existing file: only its URL is sent, never the file itself."""

    js_constructor = 'dreact.String'

    def js_args(self, file):
        return [file.url if file and hasattr(file, 'url') else None]


class DateTimeAdapter(Adapter):
    js_constructor = 'dreact.String'

    def js_args(self, timestamp):
        if timezone.is_aware(timestamp):
            timestamp = timezone.localtime(timestamp)
        return [timestamp.strftime('%Y-%m-%d %H:%M:%S')]


class DateAdapter(Adapter):
    js_constructor = 'dreact.String'

    def js_args(self, value):
        return [value.strftime('%Y-%m-%d')]


class TimeAdapter(Adapter):
    js_constructor = 'dreact.String'

    def js_args(self, value):
        return [value.strftime('%H:%M')]


class StringifyAdapter(Adapter):
    """Values the client only ever handles as text (decimals, UUIDs)."""

    js_constructor = 'dreact.String'

    def js_args(self, value):
        return [str(value)]


register(DateTimeAdapter(), datetime)
register(DateAdapter(), date)
register(TimeAdapter(), time)
register(StringifyAdapter(), Decimal)
register(StringifyAdapter(), UUID)
register(ModelChoiceIteratorAdapter(), ModelChoiceIterator)
register(ModelChoiceIteratorValueAdapter(), ModelChoiceIteratorValue)
register(FieldFileAdapter(), FieldFile)

for _widget_class in (
    forms.TextInput,
    forms.NumberInput,
    forms.EmailInput,
    forms.URLInput,
    forms.PasswordInput,
    forms.HiddenInput,
    forms.DateInput,
    forms.DateTimeInput,
    forms.TimeInput,
    forms.Textarea,
    forms.CheckboxInput,
    forms.Select,
    forms.SelectMultiple,
    forms.RadioSelect,
    forms.CheckboxSelectMultiple,
    forms.FileInput,
    forms.ClearableFileInput,
):
    register(WidgetAdapter(), _widget_class)
