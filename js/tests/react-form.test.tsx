import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ReactForm } from '@/components/react-form';
import { FieldDef, FormDef, WidgetDef } from '@/adapters';

function widget(name = 'TextInput', extra: Partial<WidgetDef> = {}): WidgetDef {
    return Object.assign(new WidgetDef(name, null, {}, '', '', ''), extra);
}

function field(overrides: Record<string, any> = {}): FieldDef {
    return new FieldDef({
        name: 'title',
        value: '',
        widget: widget(),
        field_type: 'CharField',
        label: 'Title',
        required: false,
        ...overrides,
    });
}

function formDef(fields: FieldDef[], extra: Record<string, any> = {}): FormDef {
    return new FormDef(
        fields,
        extra.fetchUrl ?? '/save/',
        extra.prefix ?? '',
        extra.fieldGroups ?? [],
        false,
    );
}

function renderForm(fields: FieldDef[], props: Record<string, any> = {}, def: Record<string, any> = {}) {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const result = render(
        <ReactForm
            form={formDef(fields, def)}
            hideSubmit={false}
            onSuccess={props.onSuccess ?? onSuccess}
            onError={props.onError ?? onError}
            submitRef={React.createRef<HTMLButtonElement>()}
            {...props}
        />,
    );
    return { ...result, onSuccess, onError };
}

function jsonResponse(status: number, body: any) {
    return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        statusText: String(status),
        json: () => Promise.resolve(body),
    } as Response);
}

const submit = () => userEvent.click(screen.getByRole('button', { name: 'Submit' }));

describe('ReactForm', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        document.cookie = 'csrftoken=test-token';
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    });

    describe('submitting', () => {
        it('posts JSON with the CSRF token and the current values', async () => {
            fetchMock.mockReturnValue(jsonResponse(200, {}));
            const { onSuccess } = renderForm([field({ value: 'Hello' })]);

            await submit();

            await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe('/save/');
            expect(init.method).toBe('POST');
            expect(init.headers['X-CSRFToken']).toBe('test-token');
            expect(init.headers['Content-Type']).toBe('application/json');
            expect(init.headers.Accept).toBe('application/json');
            expect(JSON.parse(init.body)).toEqual({ title: 'Hello' });
            await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ title: 'Hello' }, {}));
        });

        it('uses overrideFetchUrl over the form url', async () => {
            fetchMock.mockReturnValue(jsonResponse(200, {}));
            renderForm([field()], { overrideFetchUrl: '/other/' });
            await submit();
            await waitFor(() => expect(fetchMock).toHaveBeenCalled());
            expect(fetchMock.mock.calls[0][0]).toBe('/other/');
        });

        it('does not call the server when preventSubmission is set', async () => {
            const { onSuccess } = renderForm([field({ value: 'x' })], { preventSubmission: true });
            await submit();
            await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ title: 'x' }));
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('blocks submission and shows a message when a required field is empty', async () => {
            const { onError } = renderForm([field({ required: true })]);
            await submit();
            expect(await screen.findByText('Title is required.')).toBeInTheDocument();
            expect(fetchMock).not.toHaveBeenCalled();
            expect(onError).toHaveBeenCalled();
        });

        it('shows server field errors from a 400 response', async () => {
            fetchMock.mockReturnValue(jsonResponse(400, { errors: { title: ['Too short.', 'Bad.'] } }));
            const { onError } = renderForm([field({ value: 'x' })]);
            await submit();
            expect(await screen.findByText('Too short., Bad.')).toBeInTheDocument();
            expect(onError).toHaveBeenCalled();
        });

        it('shows __all__ errors as the form-level error', async () => {
            fetchMock.mockReturnValue(jsonResponse(400, { errors: { __all__: ['Whole form is wrong.'] } }));
            renderForm([field({ value: 'x' })]);
            await submit();
            expect(await screen.findByText('Whole form is wrong.')).toBeInTheDocument();
        });

        it('shows a top-level error message from a 400 response', async () => {
            fetchMock.mockReturnValue(jsonResponse(400, { error: 'Nope.' }));
            renderForm([field({ value: 'x' })]);
            await submit();
            expect(await screen.findByText('Nope.')).toBeInTheDocument();
        });

        it('calls onError (and not onSuccess) on a server error', async () => {
            fetchMock.mockReturnValue(jsonResponse(500, {}));
            const { onError, onSuccess } = renderForm([field({ value: 'x' })]);
            await submit();
            await waitFor(() => expect(onError).toHaveBeenCalled());
            expect(onSuccess).not.toHaveBeenCalled();
        });

        it('calls onError when the request itself fails', async () => {
            fetchMock.mockRejectedValue(new Error('offline'));
            const { onError } = renderForm([field({ value: 'x' })]);
            await submit();
            await waitFor(() => expect(onError).toHaveBeenCalled());
        });

        it('calls onError for a 4xx other than 400 (e.g. a CSRF failure)', async () => {
            fetchMock.mockReturnValue(jsonResponse(403, {}));
            const { onError, onSuccess } = renderForm([field({ value: 'x' })]);
            await submit();
            await waitFor(() => expect(onError).toHaveBeenCalled());
            expect(onSuccess).not.toHaveBeenCalled();
        });

        it('applies values returned in response.data to the form', async () => {
            fetchMock.mockReturnValue(jsonResponse(200, { data: { title: 'Server value' } }));
            renderForm([field({ value: 'x' })]);
            await submit();
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('Server value'));
        });
    });

    describe('default values', () => {
        it('coerces integer, boolean and multiple choice values', async () => {
            fetchMock.mockReturnValue(jsonResponse(200, {}));
            renderForm([
                field({ name: 'count', field_type: 'IntegerField', widget: widget('NumberInput'), value: 3 }),
                field({
                    name: 'agree',
                    field_type: 'BooleanField',
                    widget: widget('CheckboxInput'),
                    value: true,
                }),
                field({
                    name: 'many',
                    field_type: 'MultipleChoiceField',
                    widget: widget('CheckboxSelectMultiple'),
                    value: '["a","b"]',
                    choices: [
                        ['a', 'A'],
                        ['b', 'B'],
                    ],
                }),
            ]);
            await submit();
            await waitFor(() => expect(fetchMock).toHaveBeenCalled());
            expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
                count: 3,
                agree: true,
                many: ['a', 'b'],
            });
        });

        // ModelMultipleChoiceField reaches the client as a real array of pks (e.g. [1, 2]).
        it.each([
            ['several values', [1, 2], [1, 2]],
            ['a single value', [7], [7]],
        ])('handles a ModelMultipleChoiceField value with %s', async (_label, value, expected) => {
            fetchMock.mockReturnValue(jsonResponse(200, {}));
            renderForm([
                field({
                    name: 'groups',
                    field_type: 'ModelMultipleChoiceField',
                    widget: widget('CheckboxSelectMultiple'),
                    value,
                    choices: value.map((v) => [String(v), `Group ${v}`]),
                }),
            ]);
            await submit();
            await waitFor(() => expect(fetchMock).toHaveBeenCalled());
            const sent = JSON.parse(fetchMock.mock.calls[0][1].body).groups.map(Number);
            expect(sent).toEqual(expected);
        });
    });

    describe('file uploads (multipart)', () => {
        const fileField = () =>
            field({ name: 'upload', widget: widget('ClearableFileInput'), field_type: 'FileField' });

        it('sends FormData without a JSON content type', async () => {
            fetchMock.mockReturnValue(jsonResponse(200, {}));
            renderForm([field({ value: 'x' }), fileField()]);
            await submit();
            await waitFor(() => expect(fetchMock).toHaveBeenCalled());
            const init = fetchMock.mock.calls[0][1];
            expect(init.body).toBeInstanceOf(FormData);
            expect(init.headers['Content-Type']).toBeUndefined();
            expect(init.body.get('title')).toBe('x');
        });

        it('json-encodes tag lists in multipart bodies', async () => {
            fetchMock.mockReturnValue(jsonResponse(200, {}));
            renderForm([
                fileField(),
                field({
                    name: 'tags',
                    widget: widget('TagInput', { component: 'TagInput' }),
                    value: '["a","b"]',
                }),
            ]);
            await submit();
            await waitFor(() => expect(fetchMock).toHaveBeenCalled());
            // The unresolvable component is skipped in the UI, but the value still submits
            expect(fetchMock.mock.calls[0][1].body.get('tags')).toBe('["a","b"]');
        });

        it('does not send an existing file (its {name, url}) as text', async () => {
            fetchMock.mockReturnValue(jsonResponse(200, {}));
            renderForm([
                field({
                    name: 'upload',
                    widget: widget('ClearableFileInput'),
                    field_type: 'FileField',
                    value: { name: 'logo.png', url: '/media/logo.png' },
                }),
            ]);
            await submit();
            await waitFor(() => expect(fetchMock).toHaveBeenCalled());
            expect(fetchMock.mock.calls[0][1].body.has('upload')).toBe(false);
        });

        it('sends nothing for an untouched file field', async () => {
            fetchMock.mockReturnValue(jsonResponse(200, {}));
            renderForm([field({ value: 'x' }), fileField()]);
            await submit();
            await waitFor(() => expect(fetchMock).toHaveBeenCalled());
            const body = fetchMock.mock.calls[0][1].body as FormData;
            expect(body.has('upload')).toBe(false);
            expect(body.get('title')).toBe('x');
        });

        it('sends a chosen file', async () => {
            fetchMock.mockReturnValue(jsonResponse(200, {}));
            const { container } = renderForm([fileField()]);
            const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
            await userEvent.upload(container.querySelector('input[type=file]') as HTMLInputElement, file);
            await submit();
            await waitFor(() => expect(fetchMock).toHaveBeenCalled());
            expect((fetchMock.mock.calls[0][1].body as FormData).get('upload')).toBe(file);
        });

        it('links to the current file', () => {
            renderForm([
                field({
                    name: 'upload',
                    widget: widget('ClearableFileInput'),
                    field_type: 'FileField',
                    value: { name: 'logo.png', url: '/media/logo.png' },
                }),
            ]);
            expect(screen.getByRole('link', { name: /logo\.png/ })).toHaveAttribute(
                'href',
                '/media/logo.png',
            );
        });

        it('sends each selection of a multi-select as its own entry', async () => {
            fetchMock.mockReturnValue(jsonResponse(200, {}));
            renderForm([
                fileField(),
                field({
                    name: 'many',
                    field_type: 'MultipleChoiceField',
                    widget: widget('CheckboxSelectMultiple'),
                    value: '["a","b"]',
                    choices: [
                        ['a', 'A'],
                        ['b', 'B'],
                    ],
                }),
            ]);
            await submit();
            await waitFor(() => expect(fetchMock).toHaveBeenCalled());
            expect(fetchMock.mock.calls[0][1].body.getAll('many')).toEqual(['a', 'b']);
        });
    });

    describe('conditional fields', () => {
        const fields = () => [
            field({ name: 'kind', field_type: 'ChoiceField', value: 'free' }),
            field({ name: 'fee', label: 'Fee', condition: { kind__eq: 'paid' } }),
        ];

        it('hides a field until its condition is met', async () => {
            renderForm(fields());
            expect(screen.queryByText('Fee')).not.toBeInTheDocument();
            await userEvent.clear(screen.getAllByRole('textbox')[0]);
            await userEvent.type(screen.getAllByRole('textbox')[0], 'paid');
            expect(await screen.findByText('Fee')).toBeInTheDocument();
        });

        it('looks up watched values with the form prefix', async () => {
            const prefixed = [
                field({ name: 'p-kind', field_type: 'ChoiceField', value: 'paid' }),
                field({ name: 'p-fee', label: 'Fee', condition: { kind__eq: 'paid' } }),
            ];
            renderForm(prefixed, {}, { prefix: 'p' });
            expect(await screen.findByText('Fee')).toBeInTheDocument();
        });

        it('supports the "in" operator', async () => {
            renderForm([
                field({ name: 'kind', value: 'b' }),
                field({ name: 'fee', label: 'Fee', condition: { kind__in: ['a', 'b'] } }),
            ]);
            expect(await screen.findByText('Fee')).toBeInTheDocument();
        });

        it('fails open for unknown operators and malformed keys', async () => {
            renderForm([
                field({ name: 'a', label: 'A', condition: { kind__gt: '1' } }),
                field({ name: 'b', label: 'B', condition: { nodunder: '1' } }),
            ]);
            expect(await screen.findByText('A')).toBeInTheDocument();
            expect(screen.getByText('B')).toBeInTheDocument();
        });
    });

    describe('fields hidden by a condition', () => {
        const kindAndFee = (feeRequired = false) => [
            field({ name: 'kind', label: 'Kind', value: 'free' }),
            field({
                name: 'fee',
                label: 'Fee',
                value: '5',
                required: feeRequired,
                condition: { kind__eq: 'paid' },
            }),
        ];

        it('are left out of a JSON body', async () => {
            fetchMock.mockReturnValue(jsonResponse(200, {}));
            renderForm(kindAndFee());
            await submit();
            await waitFor(() => expect(fetchMock).toHaveBeenCalled());
            expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ kind: 'free' });
        });

        it('are left out of a multipart body', async () => {
            fetchMock.mockReturnValue(jsonResponse(200, {}));
            renderForm([
                ...kindAndFee(),
                field({ name: 'upload', widget: widget('ClearableFileInput'), field_type: 'FileField' }),
            ]);
            await submit();
            await waitFor(() => expect(fetchMock).toHaveBeenCalled());
            const body = fetchMock.mock.calls[0][1].body as FormData;
            expect(body.get('kind')).toBe('free');
            expect(body.has('fee')).toBe(false);
        });

        it('are left out of the values handed to onSuccess when submission is prevented', async () => {
            const { onSuccess } = renderForm(kindAndFee(), { preventSubmission: true });
            await submit();
            await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ kind: 'free' }));
        });

        it('do not block submission when required', async () => {
            fetchMock.mockReturnValue(jsonResponse(200, {}));
            const { onError } = renderForm(
                kindAndFee(true).map((f) => (f.name === 'fee' ? Object.assign(f, { value: '' }) : f)),
            );
            await submit();
            await waitFor(() => expect(fetchMock).toHaveBeenCalled());
            expect(onError).not.toHaveBeenCalled();
        });

        it('are included again once the condition is met', async () => {
            fetchMock.mockReturnValue(jsonResponse(200, {}));
            renderForm(kindAndFee());
            const kind = screen.getAllByRole('textbox')[0];
            await userEvent.clear(kind);
            await userEvent.type(kind, 'paid');
            await submit();
            await waitFor(() => expect(fetchMock).toHaveBeenCalled());
            expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ kind: 'paid', fee: '5' });
        });

        it('use the form prefix when deciding', async () => {
            fetchMock.mockReturnValue(jsonResponse(200, {}));
            renderForm(
                [
                    field({ name: 'p-kind', value: 'free' }),
                    field({ name: 'p-fee', value: '5', condition: { kind__eq: 'paid' } }),
                ],
                {},
                { prefix: 'p' },
            );
            await submit();
            await waitFor(() => expect(fetchMock).toHaveBeenCalled());
            expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ 'p-kind': 'free' });
        });
    });

    describe('widgets', () => {
        it('renders help text as plain text, never as HTML', () => {
            const { container } = renderForm([
                field({ help_text: 'See <b>this</b> <img src=x onerror="window.__xss = true">' }),
            ]);
            expect(screen.getByText(/See <b>this<\/b>/)).toBeInTheDocument();
            expect(container.querySelector('b')).toBeNull();
            expect(container.querySelector('img')).toBeNull();
        });

        it('renders checkbox help text as plain text too', () => {
            const { container } = renderForm([
                field({
                    name: 'agree',
                    field_type: 'BooleanField',
                    widget: widget('CheckboxInput'),
                    help_text: '<i>x</i>',
                }),
            ]);
            expect(screen.getByText('<i>x</i>')).toBeInTheDocument();
            expect(container.querySelector('i')).toBeNull();
        });

        it('marks non-required fields as optional', () => {
            renderForm([field({ required: false })]);
            expect(screen.getByText('(optional)')).toBeInTheDocument();
        });

        it('says so, and logs it, when a widget has no registered component', () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            renderForm([field({ widget: widget('TagInput', { component: 'Nope.Missing' }) })]);
            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining('no component for the "Nope.Missing" widget'),
            );
            expect(screen.getByRole('alert')).toHaveTextContent("This field can't be displayed");
        });

        // Python registers adapters for these widgets, so they can reach the client.
        it.each(['RadioSelect', 'SelectMultiple'])(
            'does not crash the form on an unsupported %s widget',
            (name) => {
                vi.spyOn(console, 'error').mockImplementation(() => {});
                expect(() =>
                    renderForm([
                        field({ name: 'x', label: 'Pick', widget: widget(name), choices: [['a', 'A']] }),
                        field({ name: 'title', label: 'Title' }),
                    ]),
                ).not.toThrow();
                expect(screen.getByText('Title')).toBeInTheDocument();
            },
        );
    });

    it('renders fieldsets when the form defines groups', () => {
        renderForm(
            [field({ name: 'a', label: 'A' }), field({ name: 'b', label: 'B' })],
            {},
            { fieldGroups: [{ name: 'Group one', fields: ['a'] }] },
        );
        expect(screen.getByText('Group one')).toBeInTheDocument();
        expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('draws fields no group lists, after the groups, and outside any fieldset', () => {
        const { container } = renderForm(
            [field({ name: 'a', label: 'A' }), field({ name: 'b', label: 'B' })],
            {},
            { fieldGroups: [{ name: 'Group one', fields: ['a'] }] },
        );
        const b = screen.getByLabelText(/^B/);
        expect(container.querySelector('fieldset')?.contains(b)).toBe(false);
        expect(
            container.querySelector('fieldset')!.compareDocumentPosition(b) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('shows the error of a required field that no group lists', async () => {
        renderForm(
            [field({ name: 'a', label: 'A' }), field({ name: 'b', label: 'B', required: true })],
            {},
            { fieldGroups: [{ name: 'Group one', fields: ['a'] }] },
        );
        await submit();
        expect(await screen.findByText('B is required.')).toBeInTheDocument();
    });

    it('ignores a group entry naming a field the form does not have', () => {
        renderForm(
            [field({ name: 'a', label: 'A' })],
            {},
            { fieldGroups: [{ name: 'G', fields: ['a', 'ghost'] }] },
        );
        expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('hides the submit button when hideSubmit is set', () => {
        const { container } = renderForm([field()], { hideSubmit: true });
        expect(container.querySelector('button[type=submit]')).toHaveStyle({ display: 'none' });
    });
});
