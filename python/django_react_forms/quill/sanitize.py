"""
Sanitizing for rich text (Quill) HTML.

Quill's ``html`` is generated in the browser and posted to the server, so it is untrusted: anyone
who can submit the form can send any markup. It is cleaned when the value is saved (by the data
normalizer) and should be cleaned again when rendered (the ``rich_text`` template filter), which
also covers anything stored before you installed this. Only what the editor produces is kept.
"""

import re

import nh3
from django.utils.safestring import mark_safe

# Attributes each tag may carry; everything else is dropped (nh3 adds rel to links).
ALLOWED_ATTRIBUTES = {
    '*': {'class', 'style'},
    'a': {'href', 'title'},
    'img': {'src', 'alt', 'width', 'height'},
    'li': {'data-list'},  # Quill 2 marks bullet/ordered/checklist items with it
}
_LIST_KINDS = {'bullet', 'ordered', 'checked', 'unchecked'}
_QUILL_CLASS = re.compile(r'^ql-[a-z0-9-]+$')
_STYLE_PROPERTIES = {'color', 'background-color'}
_COLOR = re.compile(
    r'^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[0-9.]+\s*)?\)|[a-z]+)$',
    re.IGNORECASE,
)


def _filter_attribute(tag, attribute, value):
    if attribute == 'class':
        kept = [name for name in value.split() if _QUILL_CLASS.match(name)]
        return ' '.join(kept) or None
    if attribute == 'style':
        kept = []
        for declaration in value.split(';'):
            prop, separator, css_value = declaration.partition(':')
            prop, css_value = prop.strip().lower(), css_value.strip()
            if separator and prop in _STYLE_PROPERTIES and _COLOR.match(css_value):
                kept.append(f'{prop}: {css_value}')
        return ('; '.join(kept) + ';') if kept else None
    if attribute == 'data-list':
        return value if value in _LIST_KINDS else None
    return value


def sanitize_rich_text(html):
    """The HTML with anything the editor can't produce (scripts, handlers, ...) removed."""
    return nh3.clean(html or '', attributes=ALLOWED_ATTRIBUTES, attribute_filter=_filter_attribute)


def render_rich_text(value):
    """Sanitized HTML of a Quill value (or an HTML string), marked safe for templates."""
    return mark_safe(sanitize_rich_text(getattr(value, 'html', value)))
