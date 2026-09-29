from django.views.generic import FormView, TemplateView
from django_react_forms.views import ReactFormViewMixin

from demo.forms import ContactForm, CourseForm


class DemoFormView(ReactFormViewMixin, FormView):
    template_name = 'demo/form.html'
    title = ''

    def get_form_kwargs(self):
        # fetch_url is where the client posts back to
        return {**super().get_form_kwargs(), 'fetch_url': self.request.path}

    def get_context_data(self, **kwargs):
        return super().get_context_data(title=self.title, **kwargs)

    def get_success_message(self, form, obj):
        return f'Received: {sorted(form.cleaned_data)}'


class ContactView(DemoFormView):
    form_class = ContactForm
    title = 'Contact us'


class CourseView(DemoFormView):
    form_class = CourseForm
    title = 'New class'

    def get_success_message(self, form, obj):
        data = form.cleaned_data
        fee = data['fee'] if data['kind'] == 'paid' else 'n/a (free)'
        return f'Saved "{data["title"]}" - fee: {fee}, tags: {data["tags"]}'


class Index(TemplateView):
    template_name = 'demo/index.html'
