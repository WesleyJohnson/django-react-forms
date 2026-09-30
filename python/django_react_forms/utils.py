import json

from django.utils.safestring import mark_safe

# The packed form is written into an HTML <script> element, so anything that could end the element
# or the script block must be escaped. \uXXXX escapes are valid JSON and JS, and parse back
# unchanged.
_JSON_SCRIPT_ESCAPES = {
    ord('<'): '\\u003C',
    ord('>'): '\\u003E',
    ord('&'): '\\u0026',
    0x2028: '\\u2028',
    0x2029: '\\u2029',
}


def json_for_script(value, cls=None):
    """
    JSON for embedding in an HTML <script> element without letting the data break out of it.
    ``cls`` is an optional ``json.JSONEncoder`` for values the standard one can't write.
    """
    return mark_safe(json.dumps(value, cls=cls).translate(_JSON_SCRIPT_ESCAPES))
