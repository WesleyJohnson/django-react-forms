"""
The Django side: how a form is packed for Telepath, the mount HTML, the view mixin's JSON protocol,
optional Quill support and conditional fields. ``pack_fields`` decodes the wire shape the JS
package reads.
"""

import json

from django import forms
from django.contrib.auth.models import Group
from django.http import QueryDict
from django.template import TemplateDoesNotExist
from django.test import RequestFactory, SimpleTestCase, TestCase
from django.utils.translation import gettext_lazy as _
from django.views.generic import FormView
from django_quill.forms import QuillFormField
from telepath import JSContext

from django_react_forms.fields import TagField
from django_react_forms.forms import PackedForm, ReactForm
from django_react_forms.views import ReactFormViewMixin


def unwrap(node, ids):
    """
    Resolve Telepath's de-duplication markers the way its JS unpacker does: a value seen more
    than once is sent as ``{_val|_list|_dict, _id}`` the first time and ``{_ref}`` after.
    """
    if isinstance(node, list):
        return [unwrap(item, ids) for item in node]
    if not isinstance(node, dict):
        return node
    if '_ref' in node:
        return ids[node['_ref']]
    if '_type' in node:
        return {'_type': node['_type'], '_args': unwrap(node['_args'], ids)}
    if '_val' in node:
        value = node['_val']
    elif '_list' in node:
        value = unwrap(node['_list'], ids)
    elif '_dict' in node:
        value = {key: unwrap(item, ids) for key, item in node['_dict'].items()}
    else:
        return {key: unwrap(item, ids) for key, item in node.items()}
    ids[node['_id']] = value
    return value


def pack_fields(form):
    """Pack a form the way ReactFormMixin does and return {name: packed field args}."""
    packed = unwrap(JSContext().pack(PackedForm(form)), {})
    assert packed['_type'] == 'dreact.Form'
    fields = {}
    for node in packed['_args'][0]:
        args = node['_args'][0]
        args['widget_name'] = args['widget']['_args'][0]
        fields[args['name']] = args
    return fields


class SampleForm(ReactForm):
    title = forms.CharField(label=_('Title'), max_length=20, help_text=_('Short title'))
    count = forms.IntegerField(required=False, initial=3)
    agree = forms.BooleanField(required=False, initial=True)
    kind = forms.ChoiceField(choices=[('a', 'A'), ('b', 'B')], initial='b')
    many = forms.MultipleChoiceField(
        choices=[('a', 'A'), ('b', 'B')],
        initial=['a', 'b'],
        widget=forms.CheckboxSelectMultiple,
    )
    numbers = forms.TypedMultipleChoiceField(
        choices=[(1, 'One'), (2, 'Two')],
        coerce=int,
        initial=[1, 2],
        widget=forms.CheckboxSelectMultiple,
    )
    tags = TagField(initial=['x', 'y'], max_tags=3, max_tag_length=10)


class PackedFormTests(SimpleTestCase):
    def pack(self, **kwargs):
        return pack_fields(SampleForm(fetch_url='/save/', **kwargs))

    def test_field_types_and_widgets(self):
        fields = self.pack()
        self.assertEqual(fields['title']['field_type'], 'CharField')
        self.assertEqual(fields['title']['widget_name'], 'TextInput')
        self.assertEqual(fields['count']['widget_name'], 'NumberInput')
        self.assertEqual(fields['agree']['widget_name'], 'CheckboxInput')
        self.assertEqual(fields['kind']['widget_name'], 'Select')
        self.assertEqual(fields['many']['widget_name'], 'CheckboxSelectMultiple')
        self.assertEqual(fields['tags']['widget_name'], 'TagInput')

    def test_required_and_disabled_are_real_booleans(self):
        fields = self.pack()
        self.assertIs(fields['title']['required'], True)
        self.assertIs(fields['count']['required'], False)
        self.assertIs(fields['title']['disabled'], False)

    def test_lazy_strings_are_serialized_as_plain_strings(self):
        fields = self.pack()
        self.assertEqual(fields['title']['label'], 'Title')
        self.assertEqual(fields['title']['help_text'], 'Short title')
        json.dumps(fields['title'])

    def test_fields_without_an_explicit_label_get_djangos_generated_label(self):
        # Django generates "Count" from the field name on the BoundField; the client builds
        # messages like "<label> is required." so a null label renders as "null is required."
        fields = self.pack()
        self.assertEqual(fields['count']['label'], 'Count')
        self.assertEqual(fields['agree']['label'], 'Agree')

    def test_initial_values(self):
        fields = self.pack()
        self.assertEqual(fields['count']['value'], 3)
        self.assertIs(fields['agree']['value'], True)
        self.assertEqual(fields['kind']['value'], 'b')
        self.assertIsNone(fields['title']['value'])

    def test_multiple_choice_values_are_json_encoded_lists(self):
        fields = self.pack()
        self.assertEqual(json.loads(fields['many']['value']), ['a', 'b'])
        # Typed values must keep their type (not "1,2")
        self.assertEqual(json.loads(fields['numbers']['value']), [1, 2])

    def test_choices_are_pairs(self):
        fields = self.pack()
        self.assertEqual(fields['kind']['choices'], [['a', 'A'], ['b', 'B']])

    def test_choice_groups_and_descriptions_become_choice_objects(self):
        form = SampleForm(fetch_url='/save/')
        form.fields['kind'].choice_groups = {'a': 'First'}
        form.fields['kind'].choice_descriptions = {'b': 'Second one'}
        choices = pack_fields(form)['kind']['choices']
        self.assertEqual(
            choices,
            [
                {'value': 'a', 'label': 'A', 'group': 'First', 'description': ''},
                {'value': 'b', 'label': 'B', 'group': '', 'description': 'Second one'},
            ],
        )

    def test_tag_field_widget_carries_its_component_and_props(self):
        tags = self.pack()['tags']
        packed_widget = tags['widget']['_args']
        self.assertEqual(packed_widget[1], 'TagInput')
        self.assertEqual(packed_widget[2], {'maxTags': 3, 'maxTagLength': 10})
        self.assertEqual(json.loads(tags['value']), ['x', 'y'])

    def test_prefix_is_applied_to_field_names(self):
        fields = self.pack(prefix='p')
        self.assertIn('p-title', fields)
        self.assertNotIn('title', fields)

    def test_field_groups_are_prefixed_to_match_field_names(self):
        form = SampleForm(fetch_url='/save/', prefix='p')
        form.field_groups = [{'name': 'Main', 'fields': ['title', 'count']}]
        packed = unwrap(JSContext().pack(PackedForm(form)), {})
        _fields, fetch_url, prefix, groups, disabled = packed['_args']
        self.assertEqual(fetch_url, '/save/')
        self.assertEqual(prefix, 'p')
        self.assertEqual(groups, [{'name': 'Main', 'fields': ['p-title', 'p-count']}])
        self.assertFalse(disabled)

    def test_conditions_are_keyed_by_unprefixed_field_name(self):
        form = SampleForm(fetch_url='/save/', prefix='p')
        form.field_conditions = {'count': {'kind__eq': 'a'}}
        fields = pack_fields(form)
        self.assertEqual(fields['p-count']['condition'], {'kind__eq': 'a'})
        self.assertIsNone(fields['p-title']['condition'])

    def test_fetch_url_is_required(self):
        with self.assertRaises(TypeError):
            SampleForm()


class ModelChoicePackingTests(TestCase):
    def test_model_multiple_choice_value_is_a_list_of_pks(self):
        # Pins the current wire shape; the client must cope with a real array here.
        a = Group.objects.create(name='a')
        b = Group.objects.create(name='b')

        class GroupForm(ReactForm):
            groups = forms.ModelMultipleChoiceField(
                queryset=Group.objects.all(), widget=forms.CheckboxSelectMultiple
            )

        field = pack_fields(GroupForm(fetch_url='/x', initial={'groups': [a, b]}))['groups']
        self.assertEqual(field['value'], [a.pk, b.pk])
        self.assertEqual(field['choices']['_type'], 'dreact.ChoiceList')

    def test_model_choice_value_is_stringified(self):
        a = Group.objects.create(name='a')

        class GroupForm(ReactForm):
            group = forms.ModelChoiceField(queryset=Group.objects.all())

        field = pack_fields(GroupForm(fetch_url='/x', initial={'group': a.pk}))['group']
        self.assertEqual(field['value'], str(a.pk))


class QuillForm(ReactForm):
    rich = QuillFormField(required=False)


class QuillDataTests(SimpleTestCase):
    """
    The client sends Quill values as a dict in JSON bodies; QuillFormField wants a JSON string.
    ReactRenderableFormMixin.__init__ bridges that by re-encoding dict data.
    """

    DELTA = {'ops': [{'insert': 'hi\n'}]}

    def test_dict_data_from_a_json_body_is_accepted(self):
        form = QuillForm(data={'rich': {'delta': self.DELTA, 'html': '<p>hi</p>'}}, fetch_url='/x')
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(json.loads(form.cleaned_data['rich'])['html'], '<p>hi</p>')

    def test_prefixed_dict_data_is_accepted(self):
        form = QuillForm(
            data={'p-rich': {'delta': self.DELTA, 'html': '<p>hi</p>'}},
            prefix='p',
            fetch_url='/x',
        )
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(json.loads(form.cleaned_data['rich'])['html'], '<p>hi</p>')

    def test_json_string_data_from_a_multipart_body_is_accepted(self):
        payload = json.dumps({'delta': self.DELTA, 'html': '<p>hi</p>'})
        form = QuillForm(data={'rich': payload}, fetch_url='/x')
        self.assertTrue(form.is_valid(), form.errors)

    def test_json_and_multipart_bodies_store_the_same_delta_shape(self):
        # JSON body: the delta is an object. Multipart body: the client double-encodes it as a
        # string. The same edit must not be stored in two different shapes.
        json_form = QuillForm(
            data={'rich': {'delta': self.DELTA, 'html': '<p>hi</p>'}}, fetch_url='/x'
        )
        multipart_form = QuillForm(
            data={'rich': json.dumps({'delta': json.dumps(self.DELTA), 'html': '<p>hi</p>'})},
            fetch_url='/x',
        )
        self.assertTrue(json_form.is_valid() and multipart_form.is_valid())
        stored_json = json.loads(json_form.cleaned_data['rich'])
        stored_multipart = json.loads(multipart_form.cleaned_data['rich'])
        self.assertEqual(stored_json['delta'], stored_multipart['delta'])


class NameForm(ReactForm):
    name = forms.CharField(max_length=5)


class NameView(ReactFormViewMixin, FormView):
    form_class = NameForm
    template_name = 'unused.html'
    saved = None

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['fetch_url'] = '/x'
        return kwargs


class PrefixedNameView(NameView):
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['prefix'] = 'p'
        return kwargs


class ViewMixinTests(SimpleTestCase):
    def setUp(self):
        self.rf = RequestFactory()

    def post_json(self, view, payload, **extra):
        request = self.rf.post(
            '/x',
            data=payload if isinstance(payload, str) else json.dumps(payload),
            content_type='application/json',
            HTTP_ACCEPT='application/json',
            **extra,
        )
        return view.as_view()(request)

    def body(self, response):
        return json.loads(response.content)

    def test_json_body_is_parsed_into_form_data(self):
        response = self.post_json(NameView, {'name': 'ok'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.body(response), {'success': True})

    def test_invalid_json_body_is_treated_as_empty_data(self):
        response = self.post_json(NameView, '{not json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.body(response)['errors']['name'], ['This field is required.'])

    def test_a_json_body_that_is_not_an_object_is_treated_as_empty_data(self):
        response = self.post_json(NameView, '[1, 2]')
        self.assertEqual(response.status_code, 400)

    def test_field_errors_are_returned_as_json_with_400(self):
        response = self.post_json(NameView, {'name': 'too long'})
        self.assertEqual(response.status_code, 400)
        errors = self.body(response)['errors']
        self.assertEqual(list(errors), ['name'])
        self.assertIn('at most 5', errors['name'][0])

    def test_error_keys_carry_the_form_prefix(self):
        response = self.post_json(PrefixedNameView, {'p-name': 'too long'})
        self.assertEqual(list(self.body(response)['errors']), ['p-name'])

    def test_non_field_errors_stay_under_all_without_a_prefix(self):
        class Strict(NameForm):
            def clean(self):
                raise forms.ValidationError('Nope.')

        class StrictView(PrefixedNameView):
            form_class = Strict

        response = self.post_json(StrictView, {'p-name': 'ok'})
        self.assertEqual(self.body(response)['errors'], {'__all__': ['Nope.']})

    def test_multipart_body_uses_post_and_files(self):
        request = self.rf.post('/x', data={'name': 'ok'}, HTTP_ACCEPT='application/json')
        self.assertEqual(NameView.as_view()(request).status_code, 200)

    def test_the_form_does_not_get_the_request_by_default(self):
        captured = {}

        class Capture(NameForm):
            def __init__(self, *args, **kwargs):
                captured['kwargs'] = set(kwargs)
                super().__init__(*args, **kwargs)

        class CaptureView(NameView):
            form_class = Capture

        self.post_json(CaptureView, {'name': 'ok'})
        self.assertNotIn('request', captured['kwargs'])

    def test_the_request_can_be_passed_to_the_form(self):
        captured = {}

        class Capture(NameForm):
            def __init__(self, *args, request=None, **kwargs):
                captured['request'] = request
                super().__init__(*args, **kwargs)

        class CaptureView(NameView):
            form_class = Capture
            pass_request_to_form = True

        self.post_json(CaptureView, {'name': 'ok'})
        self.assertIsNotNone(captured['request'])

    def test_success_hooks_shape_the_response(self):
        class Hooked(NameView):
            def get_success_data(self, form, obj):
                return {'name': form.cleaned_data['name']}

            def get_success_message(self, form, obj):
                return _('Saved.')

            def get_success_redirect(self, form, obj):
                return '/done/'

        body = self.body(self.post_json(Hooked, {'name': 'ok'}))
        self.assertEqual(body, {'name': 'ok', 'message': 'Saved.', 'redirect': '/done/'})

    def test_a_browser_asking_for_html_gets_normal_form_handling(self):
        request = self.rf.post('/x', data={'name': 'too long'}, HTTP_ACCEPT='text/html')
        # There's no template in this test, so reaching the normal HTML response is what raises
        with self.assertRaises(TemplateDoesNotExist):
            NameView.as_view()(request).render()


class ModelViewTests(TestCase):
    def test_a_valid_model_form_saves_and_returns_the_pk(self):
        from django.views.generic import CreateView

        from django_react_forms.forms import ReactModelForm

        class Form(ReactModelForm):
            class Meta:
                model = Group
                fields = ['name']

        class View(ReactFormViewMixin, CreateView):
            form_class = Form
            template_name = 'unused.html'

            def get_form_kwargs(self):
                return {**super().get_form_kwargs(), 'fetch_url': '/x'}

        request = RequestFactory().post(
            '/x',
            data=json.dumps({'name': 'Saved'}),
            content_type='application/json',
            HTTP_ACCEPT='application/json',
        )
        response = View.as_view()(request)
        group = Group.objects.get(name='Saved')
        self.assertEqual(json.loads(response.content), {'pk': group.pk})

    def test_save_form_hook_can_change_how_the_object_is_saved(self):
        from django.views.generic import CreateView

        from django_react_forms.forms import ReactModelForm

        class Form(ReactModelForm):
            class Meta:
                model = Group
                fields = ['name']

        class View(ReactFormViewMixin, CreateView):
            form_class = Form
            template_name = 'unused.html'

            def get_form_kwargs(self):
                return {**super().get_form_kwargs(), 'fetch_url': '/x'}

            def save_form(self, form):
                obj = form.save(commit=False)
                obj.name = obj.name.upper()
                obj.save()
                return obj

        request = RequestFactory().post(
            '/x',
            data=json.dumps({'name': 'quiet'}),
            content_type='application/json',
            HTTP_ACCEPT='application/json',
        )
        View.as_view()(request)
        self.assertTrue(Group.objects.filter(name='QUIET').exists())


class QueryDictSanityTests(SimpleTestCase):
    def test_prefixed_querydict_data_for_quill(self):
        data = QueryDict(mutable=True)
        data['p-rich'] = json.dumps({'delta': {'ops': []}, 'html': ''})
        form = QuillForm(data=data, prefix='p', fetch_url='/x')
        self.assertTrue(form.is_valid(), form.errors)


class TelepathContextEscapingTests(SimpleTestCase):
    """
    The packed form is written into an inline <script> by react_render.html. Untrusted text in a
    form's initial values must not be able to close that script element.
    """

    PAYLOAD = '</script><script>window.__xss = 1</script><!--'

    def context(self):
        form = SampleForm(fetch_url='/save/', initial={'title': self.PAYLOAD})
        return str(form.get_context()['telepath_context'])

    def test_html_significant_characters_are_escaped(self):
        rendered = self.context()
        self.assertNotIn('</script>', rendered)
        for char in '<>&':
            self.assertNotIn(char, rendered)

    def test_the_escaped_value_still_round_trips(self):
        # < etc. are valid JSON/JS escapes, so the client reads back the original text
        bridge = json.loads(self.context())
        packed_form = bridge['_args'][1]['form']
        fields = {a['_args'][0]['name']: a['_args'][0] for a in packed_form['_args'][0]}
        self.assertEqual(fields['title']['value'], self.PAYLOAD)


class MountHtmlTests(SimpleTestCase):
    def render(self, **kwargs):
        return str(SampleForm(fetch_url='/save/', **kwargs).as_react())

    def test_renders_a_placeholder_and_its_data(self):
        html = self.render()
        self.assertRegex(html, r'<div id="(dreact-[0-9a-f]{32})" data-dreact-mount></div>')
        mount_id = html.split('id="', 1)[1].split('"', 1)[0]
        self.assertIn(f'<script type="application/json" data-dreact-for="{mount_id}">', html)

    def test_the_data_is_a_json_document_naming_the_component(self):
        html = self.render()
        data = html.split('data-dreact-for=', 1)[1].split('>', 1)[1].split('</script>', 1)[0]
        bridge = json.loads(data)
        self.assertEqual(bridge['_type'], 'dreact.Bridge')
        self.assertEqual(bridge['_args'][0], 'ReactForm')

    def test_form_str_renders_the_mount_too(self):
        self.assertIn('data-dreact-mount', str(SampleForm(fetch_url='/save/')))

    def test_each_mount_gets_its_own_id(self):
        self.assertNotEqual(self.render(), self.render())

    def test_a_component_must_be_set(self):
        from django_react_forms.forms import ReactRenderableMixin

        class Bare(ReactRenderableMixin):
            pass

        with self.assertRaisesMessage(ValueError, 'component is not set'):
            Bare().as_react()


class QuillNormalizerTests(SimpleTestCase):
    def test_leaves_non_quill_values_alone(self):
        from django_react_forms.quill.normalize import normalize_quill_value

        for value in (None, 5, [1], 'not json', '[1, 2]'):
            with self.subTest(value=value):
                self.assertEqual(normalize_quill_value(value), value)

    def test_leaves_an_undecodable_delta_string_for_the_field_to_judge(self):
        from django_react_forms.quill.normalize import normalize_quill_value

        result = json.loads(normalize_quill_value({'delta': '{broken', 'html': ''}))
        self.assertEqual(result['delta'], '{broken')

    def test_does_not_mutate_the_callers_data(self):
        payload = {'rich': {'delta': {'ops': []}, 'html': ''}}
        QuillForm(data=payload, fetch_url='/x')
        self.assertIsInstance(payload['rich'], dict)


class CustomPiecesTests(SimpleTestCase):
    """The two "your own ..." examples in the README."""

    def test_a_field_can_use_its_own_react_widget_with_props(self):
        from django_react_forms.widgets import ReactComponentWidget

        class RatingField(forms.IntegerField):
            widget = ReactComponentWidget(component='Rating', props={'max': 5})

        class RatingForm(ReactForm):
            rating = RatingField()

        widget = pack_fields(RatingForm(fetch_url='/x'))['rating']['widget']['_args']
        self.assertEqual(widget[1], 'Rating')
        self.assertEqual(widget[2], {'max': 5})

    def test_a_component_of_your_own_can_be_mounted(self):
        from django_react_forms.forms import ReactRenderableMixin

        class Dashboard(ReactRenderableMixin):
            component = 'Dashboard'

            def get_component_props(self):
                return {'title': 'Hello'}

        html = str(Dashboard().as_react())
        data = html.split('data-dreact-for=', 1)[1].split('>', 1)[1].split('</script>', 1)[0]
        self.assertEqual(
            json.loads(data), {'_type': 'dreact.Bridge', '_args': ['Dashboard', {'title': 'Hello'}]}
        )


class UngroupedFieldsTests(SimpleTestCase):
    def form(self, groups, prefix=None):
        class Grouped(SampleForm):
            field_groups = groups
            calls = []

            def on_ungrouped_fields(self, names):
                self.calls.append(names)

        return Grouped(fetch_url='/x', prefix=prefix)

    def test_names_the_fields_no_group_lists(self):
        form = self.form([{'name': 'A', 'fields': ['title', 'count']}])
        self.assertEqual(
            form.get_ungrouped_field_names(), ['agree', 'kind', 'many', 'numbers', 'tags']
        )

    def test_the_hook_is_called_with_them_when_the_form_is_packed(self):
        form = self.form([{'name': 'A', 'fields': ['title']}])
        pack_fields(form)
        self.assertEqual(form.calls[0][:2], ['count', 'agree'])

    def test_nothing_is_reported_when_every_field_is_grouped(self):
        form = self.form([{'name': 'A', 'fields': list(SampleForm.base_fields)}])
        pack_fields(form)
        self.assertEqual(form.get_ungrouped_field_names(), [])
        self.assertEqual(form.calls, [])

    def test_a_form_without_groups_has_no_ungrouped_fields(self):
        form = SampleForm(fetch_url='/x')
        self.assertEqual(form.get_ungrouped_field_names(), [])

    def test_a_prefixed_form_reports_unprefixed_names(self):
        form = self.form([{'name': 'A', 'fields': ['title']}], prefix='p')
        pack_fields(form)
        self.assertIn('count', form.calls[0])
