from django_quill.fields import FieldQuill
from django_quill.widgets import QuillWidget
from telepath import Adapter, register

from django_react_forms.adapters import WidgetAdapter


class QuillValueAdapter(Adapter):
    """A stored Quill value, sent as its delta and rendered html."""

    js_constructor = 'dreact.QuillValue'

    def js_args(self, value):
        return [{'delta': value.delta if value else None, 'html': value.html if value else None}]


register(QuillValueAdapter(), FieldQuill)
register(WidgetAdapter(), QuillWidget)
