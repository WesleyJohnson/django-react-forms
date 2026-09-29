import json

from django_react_forms.quill.sanitize import sanitize_rich_text


def normalize_quill_value(value):
    """
    Return a submitted Quill value as a JSON string whose delta is an object, whether it arrived
    as a dict (JSON body) or a JSON string (multipart body, delta double-encoded). Anything that
    isn't a recognizable Quill payload is returned unchanged so QuillFormField can reject it.
    """
    submitted = value
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return submitted
    if not isinstance(value, dict):
        return submitted
    delta = value.get('delta')
    if isinstance(delta, str) and delta:
        try:
            value = {**value, 'delta': json.loads(delta)}
        except ValueError:
            pass
    # The html comes from the browser and is rendered as markup later: keep only what Quill makes
    if isinstance(value.get('html'), str):
        value = {**value, 'html': sanitize_rich_text(value['html'])}
    return json.dumps(value)
