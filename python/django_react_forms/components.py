import json
import uuid

from django.core.serializers.json import DjangoJSONEncoder
from django.forms.renderers import DjangoTemplates
from django.utils.safestring import mark_safe

from django_react_forms.utils import json_for_script

__all__ = ['PropsEncoder', 'render_component']

_renderer = DjangoTemplates()


class PropsEncoder(DjangoJSONEncoder):
    """
    Writes props as JSON: Django's usual types (dates, decimals, UUIDs, lazy strings) plus
    anything with a ``to_react_representation()`` method, which returns its JSON-able form.
    """

    def default(self, o):
        if hasattr(o, 'to_react_representation'):
            return o.to_react_representation()
        return super().default(o)


def render_component(name, props=None, *, encoder=PropsEncoder):
    """
    The HTML that mounts the component registered under ``name`` with ``props`` (plain JSON):
    a placeholder plus the data, which ``mountAll()`` in the JS package finds on the page.

    Use it from a view or your own template tag; ``{% react_component %}`` in
    ``django_react_forms`` is this function as a template tag.
    """
    # Checked here so a value the encoder can't write fails on the server, not in the browser
    props = json.loads(json.dumps(props or {}, cls=encoder))
    mount_id = f'dreact-{uuid.uuid4().hex}'
    context = {
        'mount_id': mount_id,
        'telepath_context': json_for_script({'_type': 'dreact.Bridge', '_args': [name, props]}),
    }
    return mark_safe(_renderer.render('django_react_forms/mount.html', context))
