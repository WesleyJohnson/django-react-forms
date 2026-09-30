import json

from django.http import JsonResponse

__all__ = ['ReactFormViewMixin']


class ReactFormViewMixin:
    """
    Makes a class-based form view speak the protocol the React form uses. Put it before
    ``FormView`` / ``CreateView`` / ``UpdateView`` in the bases.

    Requests: a JSON body is parsed into the form's data; a multipart body (file uploads) is used
    as is. Responses, for clients that send ``Accept: application/json``:

    * invalid: HTTP 400 ``{"errors": {"<field>": ["message", ...]}}``, keys carrying the form
      prefix; non-field errors are under ``__all__``
    * valid: HTTP 200 with ``get_success_data()`` plus, when set, ``message`` and ``redirect``

    Browsers asking for HTML get Django's normal behavior, so a view keeps working without JS.

    Hooks: ``save_form``, ``get_success_data``, ``get_success_message``,
    ``get_success_redirect``, ``invalid_json_response``.
    ``pass_request_to_form = True`` adds ``request`` to the form's kwargs.
    """

    pass_request_to_form = False

    def get_form_kwargs(self):
        # A view that isn't a FormMixin view (say a TemplateView that builds its own form) has
        # no base kwargs; it can still call this for the request-body handling below
        base = getattr(super(), 'get_form_kwargs', None)
        kwargs = base() if base else {}
        if self.pass_request_to_form:
            kwargs['request'] = self.request

        if self.request.method in ('POST', 'PUT', 'PATCH'):
            content_type = self.request.content_type or ''
            if content_type.startswith('multipart/form-data'):
                kwargs['data'] = self.request.POST
                kwargs['files'] = self.request.FILES
            elif content_type.startswith('application/json'):
                try:
                    data = json.loads(self.request.body)
                except json.JSONDecodeError:
                    data = {}
                kwargs['data'] = data if isinstance(data, dict) else {}
        return kwargs

    def wants_json(self):
        return not self.request.accepts('text/html')

    def form_invalid(self, form):
        if not self.wants_json():
            return super().form_invalid(form)
        return self.invalid_json_response(form)

    def invalid_json_response(self, form):
        """HTTP 400 with the form's errors, keyed the way the client looks them up."""
        errors = form.errors
        if form.prefix:
            errors = {
                (key if key == '__all__' else f'{form.prefix}-{key}'): messages
                for key, messages in errors.items()
            }
        return JsonResponse({'errors': errors}, status=400)

    def form_valid(self, form):
        if not self.wants_json():
            return super().form_valid(form)

        obj = self.save_form(form)
        if obj is not None:
            self.object = obj  # as ModelFormMixin does, for get_success_redirect() and friends
        data = dict(self.get_success_data(form, obj))
        message = self.get_success_message(form, obj)
        if message:
            data['message'] = str(message)
        redirect = self.get_success_redirect(form, obj)
        if redirect:
            data['redirect'] = str(redirect)
        return JsonResponse(data)

    def save_form(self, form):
        """Save a valid form and return the saved object (None for a plain, non-model form)."""
        return form.save() if hasattr(form, 'save') else None

    def get_success_data(self, form, obj):
        """The JSON body for a valid submission. The client applies ``data`` back onto the form."""
        if obj is not None and getattr(obj, 'pk', None) is not None:
            return {'pk': obj.pk}
        return {'success': True}

    def get_success_message(self, form, obj):
        return None

    def get_success_redirect(self, form, obj):
        return None
