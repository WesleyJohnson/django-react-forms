from django import template

from django_react_forms.components import render_component

register = template.Library()


class ReactComponentNode(template.Node):
    def __init__(self, name, prop_dicts, props, target_var=None):
        self.name = name
        self.prop_dicts = prop_dicts
        self.props = props
        self.target_var = target_var

    def render(self, context):
        props = {}
        for expression in self.prop_dicts:
            value = expression.resolve(context, ignore_failures=True)
            if value is None:
                continue
            if not isinstance(value, dict):
                raise template.TemplateSyntaxError(
                    f'react_component: {expression.token!r} is a {type(value).__name__}, '
                    'not a dict of props'
                )
            props.update(value)
        for key, expression in self.props.items():
            props[key] = expression.resolve(context, ignore_failures=True)
        html = render_component(self.name.resolve(context), props)
        if self.target_var:
            context[self.target_var] = html
            return ''
        return html


@register.tag
def react_component(parser, token):
    """
    Mount a component registered in the JS package (``registerComponent``) from a template::

        {% load dreact %}
        {% react_component "Badge" label="Active" count=member.badge_count %}
        {% react_component block.component_name block.props %}
        {% react_component "Card" defaults overrides title="Hi" %}

    After the name, any dicts of props (merged in order), then ``name=value`` props, which win.
    A variable that doesn't exist is ``null``. End with ``as html`` to store the HTML instead.
    Props are plain JSON; a value with a ``to_react_representation()`` method is written as
    whatever that returns.
    """
    tag, *arguments = token.split_contents()
    if not arguments:
        raise template.TemplateSyntaxError(f'{tag} needs the name of a component')
    name, *rest = arguments
    target_var = None
    if len(rest) >= 2 and rest[-2] == 'as':
        target_var = rest[-1]
        rest = rest[:-2]
    prop_dicts, props = [], {}
    for argument in rest:
        key, separator, value = argument.partition('=')
        if separator and key.isidentifier():
            props[key] = parser.compile_filter(value)
        elif props:
            raise template.TemplateSyntaxError(
                f'{tag}: {argument!r} comes after name=value props; put dicts of props first'
            )
        else:
            prop_dicts.append(parser.compile_filter(argument))
    return ReactComponentNode(parser.compile_filter(name), prop_dicts, props, target_var)
