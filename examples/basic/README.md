# Basic example

A small Django project using `django-react-forms` with the default (plain HTML) widgets.

```bash
# 1. Build the JS package, then this example's bundle
(cd ../../js && npm install && npm run build)
cd frontend && npm install && npm run build && cd ..

# 2. Run Django (Django, telepath and django-quill-editor installed; the library on PYTHONPATH)
PYTHONPATH=../../python python manage.py runserver
```

Open http://127.0.0.1:8000/. To see the same forms drawn with shadcn/ui and Tailwind instead, build
`../shadcn/frontend` and start the server with `DEMO_UI=shadcn`. The pieces to read: `demo/forms.py` (plain Django forms),
`demo/views.py` (the view mixin), `demo/templates/demo/form.html` (`{{ form }}`), and
`frontend/src/main.tsx` (mounting).
