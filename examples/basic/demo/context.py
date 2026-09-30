from django.conf import settings


def ui(request):
    """Which built front end (static/demo/<ui>.js and .css) the base template loads."""
    return {'ui': settings.DEMO_UI}
