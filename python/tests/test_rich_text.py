"""Rich text (Quill) HTML comes from the browser, so it is sanitized on save and on render."""

import json

from django.template import Context, Template
from django.test import SimpleTestCase

from django_react_forms.quill.normalize import normalize_quill_value
from django_react_forms.quill.sanitize import render_rich_text, sanitize_rich_text


class SanitizeRichTextTests(SimpleTestCase):
    def test_scripts_are_removed(self):
        self.assertNotIn('script', sanitize_rich_text('<p>a</p><script>alert(1)</script>'))
        self.assertNotIn('alert', sanitize_rich_text('<script>alert(1)</script>'))

    def test_event_handlers_are_removed(self):
        cleaned = sanitize_rich_text('<p onclick="x()">a</p><img src="/a.png" onerror="x()">')
        self.assertNotIn('onclick', cleaned)
        self.assertNotIn('onerror', cleaned)
        self.assertIn('<img src="/a.png">', cleaned)

    def test_javascript_links_lose_their_href(self):
        cleaned = sanitize_rich_text('<a href="javascript:alert(1)">x</a>')
        self.assertNotIn('javascript', cleaned)

    def test_data_and_vbscript_urls_are_removed(self):
        for url in ('data:text/html,<script>1</script>', 'vbscript:x'):
            with self.subTest(url=url):
                self.assertNotIn(
                    url.split(':')[0] + ':', sanitize_rich_text(f'<a href="{url}">x</a>')
                )

    def test_normal_and_relative_links_survive(self):
        cleaned = sanitize_rich_text(
            '<a href="https://example.com/a">x</a> <a href="/pages/y">y</a>'
        )
        self.assertIn('href="https://example.com/a"', cleaned)
        self.assertIn('href="/pages/y"', cleaned)
        self.assertIn('rel="noopener noreferrer"', cleaned)

    def test_iframes_forms_and_styles_tags_are_removed(self):
        for markup in (
            '<iframe src="https://evil.example"></iframe>',
            '<form action="/x"><input></form>',
            '<style>body{display:none}</style>',
            '<object data="x"></object>',
        ):
            with self.subTest(markup=markup):
                cleaned = sanitize_rich_text(f'<p>ok</p>{markup}')
                for tag in ('iframe', 'form', 'style', 'object', 'input'):
                    self.assertNotIn(f'<{tag}', cleaned)

    def test_what_quill_produces_is_kept(self):
        html = (
            '<h1>T</h1><p class="ql-indent-1 ql-align-center"><strong>b</strong><em>i</em>'
            '<u>u</u><s>s</s> <span style="color: rgb(230, 0, 0);">red</span>'
            '<span style="background-color: #ffff00;">y</span></p>'
            '<blockquote>q</blockquote><ol><li>1</li></ol><ul><li>a</li></ul>'
            '<p><img src="/media/a.png"></p>'
        )
        self.assertEqual(sanitize_rich_text(html), html)

    def test_the_list_marker_is_kept_but_only_with_known_values(self):
        kept = sanitize_rich_text('<ol><li data-list="bullet">a</li></ol>')
        self.assertIn('data-list="bullet"', kept)
        dropped = sanitize_rich_text('<ol><li data-list="x&quot; onclick=&quot;y">a</li></ol>')
        self.assertNotIn('data-list', dropped)
        self.assertNotIn('onclick', dropped)

    def test_only_quill_classes_are_kept(self):
        cleaned = sanitize_rich_text('<p class="ql-align-right fixed-overlay evil">x</p>')
        self.assertIn('class="ql-align-right"', cleaned)
        self.assertNotIn('evil', cleaned)

    def test_only_color_styles_are_kept(self):
        cleaned = sanitize_rich_text(
            '<span style="color: red; position: fixed; '
            'background-color: url(javascript:x)">x</span>'
        )
        self.assertIn('color: red', cleaned)
        self.assertNotIn('position', cleaned)
        self.assertNotIn('url(', cleaned)

    def test_none_and_empty_are_empty(self):
        self.assertEqual(sanitize_rich_text(None), '')
        self.assertEqual(sanitize_rich_text(''), '')


class RenderRichTextTests(SimpleTestCase):
    class Value:
        html = '<p>ok</p><script>alert(1)</script>'

    def test_accepts_a_quill_value_or_a_string(self):
        self.assertEqual(render_rich_text(self.Value()), '<p>ok</p>')
        self.assertEqual(
            render_rich_text('<p>ok</p><img src=x onerror=y>'), '<p>ok</p><img src="x">'
        )

    def test_the_template_filter_sanitizes(self):
        template = Template('{% load dreact_quill %}{{ value|rich_text }}')
        rendered = template.render(Context({'value': self.Value()}))
        self.assertEqual(rendered, '<p>ok</p>')


class NormalizeSanitizesTests(SimpleTestCase):
    def test_html_is_sanitized_when_the_value_is_saved(self):
        payload = {
            'delta': {'ops': []},
            'html': '<p>a</p><img src="/a.png" onerror="x()"><script>1</script>',
        }
        for submitted in (payload, json.dumps(payload)):
            with self.subTest(type=type(submitted).__name__):
                html = json.loads(normalize_quill_value(submitted))['html']
                self.assertEqual(html, '<p>a</p><img src="/a.png">')

    def test_a_string_that_is_json_but_not_quill_is_returned_unchanged(self):
        self.assertEqual(normalize_quill_value('[1, 2]'), '[1, 2]')
