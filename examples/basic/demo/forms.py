from django import forms
from django_quill.forms import QuillFormField
from django_react_forms.fields import TagField
from django_react_forms.forms import ReactForm


class ContactForm(ReactForm):
    """The quick start: an ordinary Django form."""

    name = forms.CharField(max_length=80)
    email = forms.EmailField()
    topic = forms.ChoiceField(choices=[('help', 'Help'), ('sales', 'Sales')])
    message = forms.CharField(widget=forms.Textarea, min_length=10)


class CourseForm(ReactForm):
    """Groups, a conditional field, tags, multiple choice, a date/time, a file and rich text."""

    field_groups = [
        {'name': 'The class', 'fields': ['title', 'kind', 'fee', 'starts', 'days']},
        {'name': 'More', 'fields': ['tags', 'agree', 'syllabus', 'about']},
    ]
    # Fee only matters for a paid class; the server ignores it otherwise, too
    field_conditions = {'fee': {'kind__eq': 'paid'}}

    title = forms.CharField(max_length=60, help_text='What the class is called.')
    kind = forms.ChoiceField(choices=[('free', 'Free'), ('paid', 'Paid')], initial='free')
    fee = forms.IntegerField(min_value=1, help_text='In whole dollars.')
    starts = forms.DateTimeField(required=False)
    days = forms.MultipleChoiceField(
        required=False,
        choices=[('mon', 'Monday'), ('wed', 'Wednesday'), ('fri', 'Friday')],
        widget=forms.CheckboxSelectMultiple,
    )
    tags = TagField(required=False, max_tags=5, help_text='Press Enter after each tag.')
    agree = forms.BooleanField(label='I agree to the code of conduct')
    syllabus = forms.FileField(required=False)
    about = QuillFormField(required=False, label='About this class')
