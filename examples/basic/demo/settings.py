import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'demo-only-not-a-secret'
DEBUG = True
ALLOWED_HOSTS = ['*']
ROOT_URLCONF = 'demo.urls'

INSTALLED_APPS = [
    'django.contrib.staticfiles',
    'django_react_forms',
    'django_react_forms.quill',  # optional rich text
    'django_quill',
    'demo',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
]

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'demo.context.ui',
            ]
        },
    }
]

# Which front end the pages load: 'basic' (plain HTML widgets) or 'shadcn' (see ../shadcn)
DEMO_UI = os.environ.get('DEMO_UI', 'basic')

DATABASES = {}  # the demo stores nothing
STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
USE_TZ = True
