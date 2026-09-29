"""
Server-side evaluation of the conditional-field rules the React form applies in the browser
(``js/src/conditions.ts``). Both sides are tested against
``tests/fixtures/condition-cases.json``, so a field the client hides is the field the server
ignores.
"""


def is_condition_met(condition, data, prefix=None):
    """
    Whether a field with this condition is visible, given submitted form data.

    Keys are ``<field>__<operator>`` (``eq``, ``in``); several keys are ANDed. Unknown operators
    and malformed keys fail open (visible). Comparison is strict, so a number or boolean never
    equals a string.

    ``data`` is keyed by the (prefixed) field name, as request data is.
    """
    for key, expected in condition.items():
        field_name, separator, operator = key.rpartition('__')
        if not separator:
            continue  # malformed key: fail open
        lookup_key = f'{prefix}-{field_name}' if prefix else field_name
        actual = data.get(lookup_key)
        if operator == 'eq':
            if not (type(actual) is type(expected) and actual == expected):
                return False
        elif operator == 'in':
            if not isinstance(expected, (list, tuple)) or not any(
                type(actual) is type(item) and actual == item for item in expected
            ):
                return False
        # unknown operator: fail open
    return True
