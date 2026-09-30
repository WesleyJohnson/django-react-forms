import copy

from django.forms import widgets
from telepath import register

from django_react_forms.adapters import WidgetAdapter


@register(adapter=WidgetAdapter())
class ReactComponentWidget(widgets.Input):
    """
    A widget drawn by a React component registered under ``component`` (see ``registerWidget`` in
    the JS package). ``props`` are passed to that component along with the field's value/onChange.

    Where React isn't drawing the form (the Django admin, ``{{ form.as_p }}``) Django renders it
    as a plain text input holding the field's value, so the form still works there.
    """

    input_type = 'text'
    template_name = 'django/forms/widgets/text.html'

    def __init__(self, attrs=None, *, component, props=None):
        self.component = component
        self.props = props or {}
        super().__init__(attrs)

    def __deepcopy__(self, memo):
        # Widget.__deepcopy__ only copies attrs; copy props too so per-form tweaks don't leak
        # into the field class's shared widget.
        obj = super().__deepcopy__(memo)
        obj.props = copy.deepcopy(self.props, memo)
        return obj


class TagInput(ReactComponentWidget):
    """
    Pill/badge input for a list of free-text tags. Pair it with ``TagField``. Drawn by Django
    instead (the admin), it is a text input holding the tags as a JSON list: ``["art", "music"]``.
    """

    component_name = 'TagInput'

    def __init__(self, attrs=None, props=None):
        super().__init__(attrs, component=self.component_name, props=props)
