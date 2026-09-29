"""TagField / TagInput — the pill-style tag input used by ReactForm."""

import json

from django.http import QueryDict
from django.test import SimpleTestCase
from telepath import JSContext

from django_react_forms.fields import TagField
from django_react_forms.forms import PackedForm, ReactForm
from django_react_forms.models import TagListField
from django_react_forms.widgets import TagInput


class TagForm(ReactForm):
    tags = TagField(required=False, max_tags=3, max_tag_length=10)


def _form(data=None, **kwargs):
    return TagForm(data=data, fetch_url='/submit/', **kwargs)


class TagFieldCleanTests(SimpleTestCase):
    def test_json_body_list_is_cleaned(self):
        form = _form({'tags': ['  Science ', 'Art', 'science', '']})
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data['tags'], ['Science', 'Art'])

    def test_multipart_json_string_is_cleaned(self):
        form = _form(QueryDict('tags=%5B%22Art%22%2C%22Music%22%5D'))
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data['tags'], ['Art', 'Music'])

    def test_empty_values_clean_to_empty_list(self):
        for value in (None, '', [], '[]'):
            with self.subTest(value=value):
                form = _form({'tags': value})
                self.assertTrue(form.is_valid(), form.errors)
                self.assertEqual(form.cleaned_data['tags'], [])

    def test_required_rejects_empty_list(self):
        field = TagField()
        with self.assertRaisesMessage(Exception, 'This field is required.'):
            field.clean([])

    def test_invalid_shapes_are_rejected(self):
        for value in ('not json', '{"a": 1}', [{'a': 1}], [True], 5):
            with self.subTest(value=value):
                form = _form({'tags': value})
                self.assertFalse(form.is_valid())
                self.assertEqual(form.errors['tags'], ['Enter a list of tags.'])

    def test_max_tags(self):
        form = _form({'tags': ['a', 'b', 'c', 'd']})
        self.assertFalse(form.is_valid())
        self.assertEqual(form.errors['tags'], ['Enter no more than 3 tags.'])

    def test_max_tag_length(self):
        form = _form({'tags': ['x' * 11]})
        self.assertFalse(form.is_valid())
        self.assertEqual(form.errors['tags'], ['Tags must be 10 characters or fewer.'])

    def test_bound_form_redisplays_list(self):
        form = _form({'tags': ['Art']})
        self.assertEqual(form['tags'].value(), '["Art"]')

    def test_has_changed(self):
        field = TagField()
        self.assertFalse(field.has_changed(['Art'], ['Art ']))
        self.assertFalse(field.has_changed(None, []))
        self.assertTrue(field.has_changed(['Art'], ['Art', 'Music']))


class TagFieldWidgetTests(SimpleTestCase):
    def test_limits_are_passed_to_widget_props(self):
        widget = _form().fields['tags'].widget
        self.assertIsInstance(widget, TagInput)
        self.assertEqual(widget.props, {'maxTags': 3, 'maxTagLength': 10})

    def test_widget_props_are_not_shared_between_form_instances(self):
        first, second = _form(), _form()
        first.fields['tags'].widget.props['maxTags'] = 99
        self.assertEqual(second.fields['tags'].widget.props['maxTags'], 3)
        self.assertEqual(TagForm.base_fields['tags'].widget.props['maxTags'], 3)

    def test_telepath_payload(self):
        form = _form(initial={'tags': ['Art', 'Music']})
        packed = JSContext().pack(PackedForm(form))
        field = next(f['_args'][0] for f in packed['_args'][0] if f['_args'][0]['name'] == 'tags')
        self.assertEqual(field['field_type'], 'TagField')
        self.assertEqual(json.loads(field['value']), ['Art', 'Music'])
        self.assertEqual(
            field['widget']['_args'][:3],
            [
                'TagInput',
                'TagInput',
                {'maxTags': 3, 'maxTagLength': 10},
            ],
        )

    def test_unbound_form_without_initial_sends_empty_list(self):
        self.assertEqual(_form()['tags'].value(), '[]')


class TagListFieldTests(SimpleTestCase):
    def test_defaults_to_list_and_uses_tag_field(self):
        model_field = TagListField(blank=True)
        self.assertEqual(model_field.get_default(), [])
        form_field = model_field.formfield()
        self.assertIsInstance(form_field, TagField)
        self.assertIsInstance(form_field.widget, TagInput)
        self.assertFalse(form_field.required)

    def test_form_class_can_still_be_overridden(self):
        from django import forms

        self.assertIsInstance(TagListField().formfield(form_class=forms.JSONField), forms.JSONField)
