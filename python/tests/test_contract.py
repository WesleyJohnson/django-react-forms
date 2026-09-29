"""
The payloads real forms produce, checked in under ``js/tests/fixtures/`` and mounted by the JS suite
(``js/tests/contract.test.tsx``). If the Python side changes what it sends, these tests fail until
the fixtures are regenerated - and the JS tests then show whether the client still understands
them.

Regenerate with ``DREACT_UPDATE_FIXTURES=1 python -m django test tests.test_contract``.
"""

import json
import os
from pathlib import Path

from django import forms
from django.contrib.auth.models import Group
from django.test import TestCase
from django_quill.forms import QuillFormField

from django_react_forms.fields import TagField
from django_react_forms.forms import ReactForm
from tests.test_forms import unwrap

FIXTURES = Path(__file__).resolve().parents[2] / 'js' / 'tests' / 'fixtures'


class ContractForm(ReactForm):
    field_groups = [
        {'name': 'About', 'fields': ['title', 'kind', 'notes']},
        {
            'name': 'Details',
            'fields': ['fee', 'starts', 'agree', 'days', 'tags', 'groups', 'upload'],
        },
    ]
    field_conditions = {'fee': {'kind__eq': 'paid'}}

    title = forms.CharField(label='Title', max_length=40, help_text='A short name')
    kind = forms.ChoiceField(label='Kind', choices=[('free', 'Free'), ('paid', 'Paid')])
    notes = forms.CharField(label='Notes', required=False, widget=forms.Textarea)
    fee = forms.IntegerField(label='Fee', required=False, initial=5)
    starts = forms.DateTimeField(label='Starts', required=False)
    agree = forms.BooleanField(label='Agree', required=False)
    days = forms.MultipleChoiceField(
        label='Days',
        required=False,
        choices=[('mon', 'Monday'), ('tue', 'Tuesday')],
        widget=forms.CheckboxSelectMultiple,
    )
    tags = TagField(label='Tags', required=False, max_tags=3)
    groups = forms.ModelMultipleChoiceField(
        label='Groups',
        required=False,
        queryset=Group.objects.none(),
        widget=forms.CheckboxSelectMultiple,
    )
    upload = forms.FileField(label='Upload', required=False)


class QuillContractForm(ReactForm):
    bio = QuillFormField(label='Bio', required=False)


def payload_of(form):
    return json.loads(form.get_mount_context()['telepath_context'])


def check_fixture(test, name, payload):
    path = FIXTURES / name
    if os.environ.get('DREACT_UPDATE_FIXTURES'):
        path.write_text(json.dumps(payload, indent=2, sort_keys=True) + '\n')
    # Telepath de-duplicates repeated values differently across Django versions; resolve those
    # markers (as the client does) so the comparison is about content
    test.assertEqual(
        unwrap(payload, {}),
        unwrap(json.loads(path.read_text()), {}),
        f'The packed form changed. Regenerate {name} (see this module) and run the JS tests.',
    )


class ContractFixtureTests(TestCase):
    def test_a_form_matches_the_fixture_the_js_suite_mounts(self):
        import datetime

        form = ContractForm(
            fetch_url='/save/',
            prefix='p',
            initial={
                'title': 'Marine Biology',
                'kind': 'paid',
                'starts': datetime.datetime(2026, 1, 2, 9, 30),
                'days': ['mon'],
                'tags': ['sea', 'science'],
            },
        )
        check_fixture(self, 'packed-form.json', payload_of(form))

    def test_a_quill_form_matches_its_fixture(self):
        form = QuillContractForm(
            fetch_url='/save/',
            initial={
                'bio': json.dumps({'delta': {'ops': [{'insert': 'Hi\n'}]}, 'html': '<p>Hi</p>'})
            },
        )
        check_fixture(self, 'packed-quill-form.json', payload_of(form))
