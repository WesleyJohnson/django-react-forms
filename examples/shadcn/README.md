# shadcn/ui + Tailwind example

The same demo forms as [`../basic`](../basic), drawn with [shadcn/ui](https://ui.shadcn.com/)
components and Tailwind instead of the library's plain HTML widgets. It has no Django project of
its own: it builds a second bundle for the basic example's server.

```bash
# 1. Build the JS package, then this example's bundle
(cd ../../js && npm install && npm run build)
cd frontend && npm install && npm run build && cd ..

# 2. Run the basic example's Django project, asking for this front end
cd ../basic
DEMO_UI=shadcn PYTHONPATH=../../python python manage.py runserver
```

Open http://127.0.0.1:8000/course/.

## What to read

- `frontend/src/dreact/widgets.tsx` maps each Django widget class name to a component
  (`registerWidget('Select', ...)` swaps the default). A widget receives `value`, `onChange`,
  `choices`, `invalid`, `describedBy` and the props set on the Python widget (for the tag input,
  `maxTags`).
- `frontend/src/dreact/slots.tsx` draws the pieces around the controls: the label, help text and
  error of each field, fieldsets for `field_groups`, the form-level error and the submit button
  (`registerSlot('Field', ...)`).
- `frontend/src/main.tsx` registers both and sends the library's notices to the page.
- `frontend/src/components/ui/` are shadcn/ui's own components (button, input, label, textarea,
  select, switch, checkbox, badge), written out the way the shadcn CLI generates them, so you can
  swap in your project's.

Rich text (Quill) keeps the library's editor and Quill's stylesheet; only the widgets and layout
around it change.
