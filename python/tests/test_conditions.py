import json
from pathlib import Path

from django import forms
from django.contrib.auth.models import Group
from django.test import SimpleTestCase, TestCase

from django_react_forms.conditions import is_condition_met
from django_react_forms.forms import ReactForm, ReactModelForm

FIXTURE = Path(__file__).resolve().parent / 'fixtures' / 'condition-cases.json'
CASES = json.loads(FIXTURE.read_text())['cases']


class SharedConditionCaseTests(SimpleTestCase):
    """The same cases src/js/conditions.test.ts runs, so client and server agree."""

    def test_shared_cases(self):
        for case in CASES:
            with self.subTest(case['name']):
                self.assertIs(
                    is_condition_met(case['condition'], case['values'], case.get('prefix')),
                    case['visible'],
                )

    def test_querydict_data(self):
        from django.http import QueryDict

        data = QueryDict('kind=paid')
        self.assertTrue(is_condition_met({'kind__eq': 'paid'}, data))
        self.assertFalse(is_condition_met({'kind__eq': 'free'}, data))


class FeeForm(ReactForm):
    field_conditions = {'fee': {'kind__eq': 'paid'}}

    kind = forms.ChoiceField(choices=[('free', 'Free'), ('paid', 'Paid')])
    fee = forms.IntegerField(min_value=1, initial=2)


class HiddenFieldCleaningTests(SimpleTestCase):
    def form(self, data, **kwargs):
        return FeeForm(data=data, fetch_url='/x', **kwargs)

    def test_a_visible_required_field_is_still_required(self):
        form = self.form({'kind': 'paid'})
        self.assertFalse(form.is_valid())
        self.assertIn('fee', form.errors)

    def test_a_hidden_required_field_does_not_block_the_form(self):
        form = self.form({'kind': 'free'})
        self.assertTrue(form.is_valid(), form.errors)

    def test_a_hidden_field_keeps_its_stored_value_and_ignores_the_submitted_one(self):
        form = self.form({'kind': 'free', 'fee': '99'})
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data['fee'], 2)

    def test_a_hidden_field_is_not_validated(self):
        form = self.form({'kind': 'free', 'fee': '-5'})
        self.assertTrue(form.is_valid(), form.errors)

    def test_a_visible_field_takes_the_submitted_value(self):
        form = self.form({'kind': 'paid', 'fee': '7'})
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data['fee'], 7)

    def test_json_body_data_is_supported(self):
        form = self.form({'kind': 'free', 'fee': None})
        self.assertTrue(form.is_valid(), form.errors)

    def test_prefixed_data(self):
        form = self.form({'p-kind': 'free'}, prefix='p')
        self.assertTrue(form.is_valid(), form.errors)
        form = self.form({'p-kind': 'paid'}, prefix='p')
        self.assertFalse(form.is_valid())
        self.assertIn('fee', form.errors)

    def test_field_settings_are_restored_after_cleaning(self):
        form = self.form({'kind': 'free'})
        form.is_valid()
        self.assertTrue(form.fields['fee'].required)
        self.assertFalse(form.fields['fee'].disabled)

    def test_unbound_forms_are_untouched(self):
        form = FeeForm(fetch_url='/x')
        self.assertEqual(form.get_hidden_field_names() if form.is_bound else [], [])
        self.assertTrue(form.fields['fee'].required)

    def test_a_condition_on_a_field_the_form_removed_is_ignored(self):
        class Trimmed(FeeForm):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                del self.fields['fee']

        form = Trimmed(data={'kind': 'free'}, fetch_url='/x')
        self.assertTrue(form.is_valid(), form.errors)


class GroupForm(ReactModelForm):
    field_conditions = {'name': {'hide_name__eq': 'no'}}

    hide_name = forms.CharField(required=False)

    class Meta:
        model = Group
        fields = ['name']


class HiddenModelFieldTests(TestCase):
    def test_a_hidden_model_field_keeps_the_stored_value(self):
        group = Group.objects.create(name='Original')
        form = GroupForm(
            data={'hide_name': 'yes', 'name': 'Changed'},
            instance=group,
            fetch_url='/x',
        )
        self.assertTrue(form.is_valid(), form.errors)
        form.save()
        group.refresh_from_db()
        self.assertEqual(group.name, 'Original')

    def test_a_hidden_required_model_field_does_not_block_a_new_object(self):
        form = GroupForm(data={'hide_name': 'yes'}, fetch_url='/x')
        self.assertTrue(form.is_valid(), form.errors)

    def test_a_visible_model_field_saves_normally(self):
        group = Group.objects.create(name='Original')
        form = GroupForm(
            data={'hide_name': 'no', 'name': 'Changed'}, instance=group, fetch_url='/x'
        )
        self.assertTrue(form.is_valid(), form.errors)
        form.save()
        group.refresh_from_db()
        self.assertEqual(group.name, 'Changed')
