# django-react-forms

[![CI](https://github.com/WesleyJohnson/django-react-forms/actions/workflows/ci.yml/badge.svg)](https://github.com/WesleyJohnson/django-react-forms/actions/workflows/ci.yml)

Draw Django forms with React. **Django declares the form; React draws it.**

You write an ordinary Django `Form` or `ModelForm`. `django-react-forms` serializes it (with
[Telepath](https://github.com/wagtail/telepath)) and mounts it as a [React Hook Form](https://react-hook-form.com/)
form in the page. Validation stays in Django, and the client posts JSON (or multipart, for files)
back to your view.

> **Status: alpha (0.x).** The API may change before 1.0. Best-effort support; issues and pull
> requests are welcome.

- **One source of truth.** Fields, labels, help text, choices, initial values, and validation rules
  come from your Django form.
- **Conditional fields.** `field_conditions = {'fee': {'kind__eq': 'paid'}}` shows a field only when
  its condition holds. The server ignores a hidden field too, so the two sides can't disagree.
- **Bring your own UI.** The default widgets are plain HTML. Swap any widget or layout piece for
  your design system (shadcn, Mantine, ...) with `registerWidget` / `registerSlot`.
- **The usual Django things work.** Prefixes, `ModelChoiceField`, file uploads, `field_groups`,
  Django's error messages, CSRF.
- **Optional rich text** (Quill), with server-side sanitizing.

If you'd rather have web components than React, look at [django-formset](https://github.com/jrief/django-formset).

## Install

```bash
pip install django-react-forms          # add [quill] for rich text
npm install django-react-forms react react-dom react-hook-form
```

Each [GitHub release](https://github.com/WesleyJohnson/django-react-forms/releases) also has the
npm package as a tarball, which `npm install` accepts by URL.

Requires Python 3.10+, Django 4.2 to 6.1 (Django 6 needs Python 3.12+), React 18.

## Quick start

**1. Django.** Add the app, declare a form, and put the view mixin first:

```python
# settings.py
INSTALLED_APPS = [..., 'django_react_forms']
```

```python
# forms.py
from django import forms
from django_react_forms.forms import ReactForm

class ContactForm(ReactForm):
    name = forms.CharField(max_length=80)
    email = forms.EmailField()
    topic = forms.ChoiceField(choices=[('help', 'Help'), ('sales', 'Sales')])
    message = forms.CharField(widget=forms.Textarea)

# views.py
from django.views.generic import FormView
from django_react_forms.views import ReactFormViewMixin

class ContactView(ReactFormViewMixin, FormView):
    form_class = ContactForm
    template_name = 'contact.html'
    success_url = '/thanks/'

    def get_form_kwargs(self):
        return {**super().get_form_kwargs(), 'fetch_url': self.request.path}
```

```django
{# contact.html #}
{{ form }}
```

**2. JavaScript.** Mount whatever the server put on the page:

```ts
import { mountOnReady } from 'django-react-forms';
import 'django-react-forms/styles.css'; // optional starter styles

mountOnReady();
```

That's the whole integration. `{{ form }}` (or `{{ form.as_react }}`) emits a placeholder and the
form's data as a `<script type="application/json">`; `mountOnReady()` finds those and draws the
forms. If you insert HTML later (say from `fetch`), call `mountAll()` again.

## Examples

- [`examples/basic`](examples/basic) - a small Django project with the default widgets. Run it to
  see groups, a conditional field, tags, files and rich text.
- [`examples/shadcn`](examples/shadcn) - the same forms drawn with shadcn/ui and Tailwind, to show
  how `registerWidget` and `registerSlot` fit a design system.

## Rich text (Quill)

```bash
pip install "django-react-forms[quill]"
npm install quill
```

```python
INSTALLED_APPS = [..., 'django_react_forms', 'django_react_forms.quill', 'django_quill']
```

```ts
import 'django-react-forms/quill';        // teaches the client about Quill fields
import 'quill/dist/quill.snow.css';       // Quill's own stylesheet
```

Quill's `html` is produced in the browser, so it is **untrusted**. `django_react_forms.quill`
sanitizes it when it is saved. Sanitize again when you render it:

```django
{% load dreact_quill %}
{{ profile.bio|rich_text }}    {# never {{ profile.bio.html|safe }} #}
```

To let users insert images, pass an upload function (there is no image button otherwise):

```ts
import { configureQuill } from 'django-react-forms/quill';
configureQuill({ onImageUpload: async (file) => (await upload(file)).url });
```

## Customizing

### Replace a widget

Widgets are registered by Django widget class name (`'Select'`, `'TextInput'`, ...). Registering
an existing name replaces the default.

```tsx
import { registerWidget, type WidgetProps } from 'django-react-forms';

registerWidget('Select', ({ id, value, onChange, choices, disabled }: WidgetProps) => (
    <MySelect id={id} value={value} onChange={onChange} options={choices} disabled={disabled} />
));
```

A widget receives `id`, `name`, `value`, `onChange`, `onBlur`, `disabled`, `placeholder`,
`className`, `style`, `choices`, `field`, `invalid`, `describedBy`, and any `props` set on the
Python widget.

### A widget of your own

```python
from django_react_forms.widgets import ReactComponentWidget

class Rating(forms.IntegerField):
    widget = ReactComponentWidget(component='Rating', props={'max': 5})
```

```tsx
registerWidget('Rating', ({ value, onChange, max }) => <Stars value={value} onChange={onChange} max={max} />);
```

### Replace the layout

`registerSlot` swaps the pieces around the controls: `Field` (label, help text, error),
`Fieldset`, `FormError`, and `SubmitButton`.

### Text, translation, notifications

```tsx
<ReactForm messages={{ submit: 'Enviar' }} notify={(n) => toast(n.title, n)} />
setDefaultMessages({ submit: 'Enviar' }); // or once, for every form
```

The library never draws toasts; pass `notify` to show success and failure notices your way. Pass
`onSuccess(values, response)` to decide what happens after a save; without it, a `redirect` in the
server's reply is followed.

### Your own component

```python
from django_react_forms.forms import ReactRenderableMixin

class Dashboard(ReactRenderableMixin):
    component = 'Dashboard'
    def get_component_props(self): return {'title': 'Hello'}
```

```tsx
registerComponent('Dashboard', ({ title }) => <h1>{title}</h1>);
```

Or skip the Python class and mount a registered component straight from a template. Props are plain
JSON (a value with a `to_react_representation()` method is written as whatever that returns):

```django
{% load dreact %}
{% react_component "Badge" label="Active" count=member.badge_count %}
```

From a view or your own tag, use `django_react_forms.components.render_component(name, props)`.

## Behavior worth knowing

- **Fields in no group are still drawn**, after the groups. Nothing is silently dropped. To hide a
  field on purpose, give it a `HiddenInput` or leave it out of the form. Override
  `on_ungrouped_fields(names)` on the form if you'd like to log or warn about it.
- **Conditions.** Keys are `<field>__eq` / `<field>__in`, several are ANDed, unknown operators fail
  open (the field stays visible), and comparison is strict (`3` never equals `"3"`). The same
  rules run on the client and in `ReactFormMixin.full_clean`, and both suites are tested against
  one shared list of cases.
- **A hidden field keeps its stored value.** It isn't validated and the submitted value is ignored.
  If you want it cleared, do that in `clean()`.
- **`help_text` is plain text**, never HTML.

## The wire protocol

`ReactFormViewMixin` speaks this; you can implement it in any view.

**Request:** `POST` to `fetch_url` with `Accept: application/json` and `X-CSRFToken`. The body is
JSON, or `multipart/form-data` when the form has a file field (lists become repeated entries;
tag lists and rich text are JSON-encoded strings). Fields hidden by a condition are omitted.

**Response:** `200` with `{"pk": ...}` / `{"success": true}` plus optional `message`, `redirect`
and `data` (values to apply back onto the form). `400` with
`{"errors": {"<prefixed field>": ["message"], "__all__": ["form-level message"]}}`. Anything else
is treated as a failure.

Hooks on the view mixin: `save_form`, `get_success_data`, `get_success_message`,
`get_success_redirect`; set `pass_request_to_form = True` to give your form the `request`.

## Security notes

- The form's data is embedded in an inline `<script>` with `<`, `>` and `&` escaped, so a value like
  `</script>` can't break out of it.
- `help_text` and every label render as text.
- Rich text HTML is sanitized on save and should be on render (see above). Links open with
  `rel="noopener noreferrer"`; `javascript:` and `data:` URLs are removed.
- CSRF is read from Django's cookie at submit time. Keep `CSRF_COOKIE_HTTPONLY = False` (the default).
- File links are only drawn for `http(s)` and relative URLs.

## Development

```bash
cd python && python -m django test tests --settings=tests.settings     # Django tests
cd js && npm install && npm test && npm run typecheck && npm run build   # JS tests and build
```

`python/tests/test_contract.py` writes the payloads the JS suite mounts. After changing what the
Python side sends, regenerate them with `DREACT_UPDATE_FIXTURES=1` and run the JS tests.

## License

MIT © Wesley Johnson
