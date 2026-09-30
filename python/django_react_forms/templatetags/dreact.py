from django import template

from django_react_forms.components import render_component

register = template.Library()


@register.simple_tag
def react_component(name, **props):
    """
    Mount a component registered in the JS package (``registerComponent``) from a template::

        {% load dreact %}
        {% react_component "Badge" label="Active" count=member.badge_count %}

    Props are plain JSON; a value with a ``to_react_representation()`` method is written as
    whatever that returns.
    """
    return render_component(name, props)
