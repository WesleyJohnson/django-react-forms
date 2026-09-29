import json
import logging
import uuid

from django import forms
from django.forms.renderers import DjangoTemplates
from django.utils.safestring import mark_safe
from telepath import JSContext, register

from django_react_forms.conditions import is_condition_met
from django_react_forms.utils import json_for_script

logger = logging.getLogger(__name__)

__all__ = [
    'PackedForm',
    'PackedFormField',
    'ReactForm',
    'ReactFormMixin',
    'ReactModelForm',
    'ReactRenderableMixin',
    'register_data_normalizer',
]

# field class -> callable(submitted value) -> value Django's field can clean
_data_normalizers = {}


def register_data_normalizer(field_class, normalizer):
    """
    Adapt the submitted value for fields of ``field_class`` before the form reads it.

    JSON request bodies carry richer values than form-encoded ones (a dict for a rich-text
    field, say), and some Django fields expect a string. Optional integrations register one of
    these instead of the core knowing about them.
    """
    _data_normalizers[field_class] = normalizer


@register
class ReactRenderableMixin:
    """
    Something drawn by a React component. ``component`` is the key it's registered under in the JS
    package (``registerComponent``); ``get_component_props`` supplies its props.
    """

    template_name = 'django_react_forms/mount.html'
    component = None
    renderer = DjangoTemplates()

    def __init__(self, *args, **kwargs):
        self.js_context = JSContext()
        super().__init__(*args, **kwargs)

    def get_component_props(self):
        return {}

    def get_mount_context(self):
        return {
            'mount_id': f'dreact-{uuid.uuid4().hex}',
            'telepath_context': json_for_script(self.js_context.pack(self)),
        }

    def as_react(self):
        """The HTML that mounts this component: a placeholder plus its packed data."""
        if self.component is None:
            raise ValueError('component is not set')
        return mark_safe(self.renderer.render(self.template_name, self.get_mount_context()))

    def telepath_pack(self, context=None):
        return ['dreact.Bridge', [self.component, self.get_component_props()]]


class ReactFormMixin(ReactRenderableMixin):
    """
    Mix into a Django ``Form`` or ``ModelForm`` to draw it with React. Extra class attributes:

    * ``field_groups`` - ``[{'name': 'Group', 'fields': ['a', 'b']}]`` renders fieldsets
    * ``field_conditions`` - ``{'fee': {'kind__eq': 'paid'}}`` shows a field only when its
      condition holds. The server ignores a hidden field too (it isn't validated and keeps its
      stored value), so the two sides can't disagree about what was submitted.
    * ``disabled`` - disables the submit button
    """

    component = 'ReactForm'

    def __init__(self, *args, fetch_url, **kwargs):
        self.fetch_url = fetch_url
        super().__init__(*args, **kwargs)
        self._normalize_submitted_data()

    def _normalize_submitted_data(self):
        if not self.is_bound or not _data_normalizers:
            return
        copied = False
        for field_name, field in self.fields.items():
            normalizer = next(
                (fn for cls, fn in _data_normalizers.items() if isinstance(field, cls)), None
            )
            key = self.add_prefix(field_name)
            if normalizer is None or key not in self.data:
                continue
            if not copied:
                # request.POST is an immutable QueryDict; don't mutate the caller's data either
                self.data = self.data.copy()
                copied = True
            self.data[key] = normalizer(self.data[key])

    def get_hidden_field_names(self):
        """Fields the client hides because their ``field_conditions`` entry isn't met."""
        conditions = getattr(self, 'field_conditions', None) or {}
        return [
            name
            for name, condition in conditions.items()
            if name in self.fields and not is_condition_met(condition, self.data, self.prefix)
        ]

    def full_clean(self):
        """
        A field hidden by a condition is never validated and never changes: for this clean it is
        treated as disabled (Django then uses the stored/initial value, not the submitted one)
        and not required (Django still validates a disabled field's initial value). The field
        settings are restored afterwards, so a re-rendered form is unaffected.
        """
        hidden = self.get_hidden_field_names() if self.is_bound else []
        saved = {}
        for name in hidden:
            field = self.fields[name]
            saved[name] = (field.disabled, field.required)
            field.disabled = True
            field.required = False
        try:
            super().full_clean()
        finally:
            for name, (disabled, required) in saved.items():
                self.fields[name].disabled = disabled
                self.fields[name].required = required

    def get_ungrouped_field_names(self):
        """Fields no ``field_groups`` entry lists (the client draws them after the groups)."""
        groups = getattr(self, 'field_groups', None)
        if not groups:
            return []
        grouped = {name for group in groups for name in group['fields']}
        return [name for name in self.fields if name not in grouped]

    def on_ungrouped_fields(self, names):
        """
        Called when the form is packed and some fields are in no group. Does nothing by default;
        override it to log or warn if you consider a missing group a mistake.
        """

    def get_context(self):
        # {{ form }} draws the React mount, not Django's fields
        return self.get_mount_context()

    def get_component_props(self):
        props = super().get_component_props()
        props['form'] = PackedForm(self)
        return props


class ReactForm(ReactFormMixin, forms.Form):
    """A plain Django form drawn with React."""


class ReactModelForm(ReactFormMixin, forms.ModelForm):
    """A Django ModelForm drawn with React."""


@register
class PackedForm:
    def __init__(self, form):
        self.form = form

    def telepath_pack(self, context):
        form = self.form
        field_groups = getattr(form, 'field_groups', None)

        # PackedFormField prefixes the field names ('name' -> 'prefix-name') when the form has a
        # prefix; mirror that so the client can match group fields to field names
        if form.prefix and field_groups:
            field_groups = [
                {**group, 'fields': [f'{form.prefix}-{name}' for name in group['fields']]}
                for group in field_groups
            ]

        if field_groups and hasattr(form, 'get_ungrouped_field_names'):
            ungrouped = form.get_ungrouped_field_names()
            if ungrouped:
                form.on_ungrouped_fields(ungrouped)

        return [
            'dreact.Form',
            [
                [PackedFormField(name, form[name]) for name in form.fields],
                form.fetch_url,
                form.prefix,
                field_groups,
                getattr(form, 'disabled', False),
            ],
        ]


@register
class PackedFormField:
    def __init__(self, name, bound_field):
        self.name = name
        self.bound_field = bound_field

    def telepath_pack(self, context):
        name = self.name
        bound_field = self.bound_field
        form_field = bound_field.field
        form = bound_field.form

        if form.prefix:
            name = f'{form.prefix}-{name}'

        value = bound_field.value()
        widget = form_field.widget
        field_type = form_field.__class__.__name__

        if field_type == 'ModelChoiceField' and value:
            # A string, so it matches the string value the ModelChoiceIteratorValue adapter sends
            value = str(value)

        # A list of ints (TypedMultipleChoiceField) would reach the client as "1,3" if the client
        # stringified it; ModelMultipleChoiceField lists reach it as real arrays
        if (
            isinstance(form_field, forms.MultipleChoiceField)
            and not isinstance(form_field, forms.ModelMultipleChoiceField)
            and value
            and isinstance(value, list)
        ):
            value = json.dumps(value)

        if field_type in ('ImageField', 'FileField'):
            initial = bound_field.initial
            if initial and hasattr(initial, 'name'):
                value = {
                    'name': initial.name,
                    'url': initial.url if hasattr(initial, 'url') else None,
                }
            else:
                value = None

        packed = {
            attr: getattr(form_field, attr, None)
            for attr in (
                'required',
                'disabled',
                'readonly',
                'help_text',
                'max_length',
                'min_length',
                'empty_value',
                'choices',
            )
        }
        # Django only sets Field.label when it's declared; the BoundField falls back to a label
        # generated from the field name, which is what a rendered form would show
        packed['label'] = bound_field.label

        # Optional per-choice grouping/description, set by the form as extra attributes on the
        # field since Django's own `choices` must stay flat 2-tuples for ChoiceField.validate()
        choice_groups = getattr(form_field, 'choice_groups', None)
        choice_descriptions = getattr(form_field, 'choice_descriptions', None)
        if (choice_groups or choice_descriptions) and packed['choices']:
            packed['choices'] = [
                {
                    'value': choice_value,
                    'label': label,
                    'group': (choice_groups or {}).get(choice_value, ''),
                    'description': (choice_descriptions or {}).get(choice_value, ''),
                }
                for choice_value, label in packed['choices']
            ]

        conditions = getattr(form, 'field_conditions', None) or {}
        packed.update(
            {
                'name': name,
                'value': value,
                'widget': widget,
                'field_type': field_type,
                'condition': conditions.get(self.name),
            }
        )
        return ['dreact.FormField', [packed]]
