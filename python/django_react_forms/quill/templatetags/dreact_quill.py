from django import template

from django_react_forms.quill.sanitize import render_rich_text

register = template.Library()


@register.filter(name='rich_text')
def rich_text(value):
    """Render a Quill value's HTML, sanitized (it comes from the browser, so it isn't trusted)."""
    return render_rich_text(value)
