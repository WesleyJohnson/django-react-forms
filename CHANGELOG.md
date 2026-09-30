# Changelog

## 0.1.1 - 2026-09-30

- Fixed: a `ReactComponentWidget` (including `TagInput`, so any `TagListField`) failed to render
  when Django drew it instead of React, such as in the Django admin. It is now a plain text input
  there (a tag list shows as JSON, `["art", "music"]`).

## 0.1.0 - 2026-09-30

First release: Django forms drawn with React Hook Form; conditional fields; field groups; tag
input; file uploads; a widget/slot registry; optional Quill rich text with sanitizing; a
`{% react_component %}` template tag to mount any registered component.
