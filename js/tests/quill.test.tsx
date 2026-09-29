import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldDef, FormDef, WidgetDef } from '@/adapters';
import { ReactForm } from '@/components/react-form';
import { mountAll, unmountAll } from '@/index';
import { QuillValue, RichTextWidget, initialRichTextValue } from '@/quill';
import packedQuill from './fixtures/packed-quill-form.json';

describe('QuillValue', () => {
    const delta = { ops: [{ insert: 'hi\n' }] };

    it('parses a JSON-string delta into an object', () => {
        const q = new QuillValue({ delta: JSON.stringify(delta), html: '<p>hi</p>' });
        expect(q.delta).toEqual(delta);
        expect(q.html).toBe('<p>hi</p>');
    });

    it('keeps an already-parsed delta', () => {
        expect(new QuillValue({ delta, html: '' }).delta).toBe(delta);
    });

    it('treats an empty delta string as empty', () => {
        expect(new QuillValue({ delta: '', html: '' }).delta).toBe('');
    });

    it('falls back to an empty delta when the JSON is invalid', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(new QuillValue({ delta: '{not json', html: '<p>x</p>' }).delta).toBe('');
        spy.mockRestore();
    });

    it('serializes with the delta as an object in JSON, and double-encoded by toString', () => {
        const q = new QuillValue({ delta, html: '<p>hi</p>' });
        expect(JSON.parse(JSON.stringify({ q })).q).toEqual({ delta, html: '<p>hi</p>' });
        const outer = JSON.parse(q.toString());
        expect(typeof outer.delta).toBe('string');
        expect(JSON.parse(outer.delta)).toEqual(delta);
    });
});

describe('initialRichTextValue', () => {
    it('defaults to an empty value', () => {
        for (const value of [null, undefined, '', 'not json', '[1]', 5]) {
            expect(initialRichTextValue(value)).toEqual({ delta: '', html: '' });
        }
    });

    it('parses a JSON string and passes an object through', () => {
        const value = { delta: { ops: [] }, html: '<p>x</p>' };
        expect(initialRichTextValue(JSON.stringify(value))).toEqual(value);
        expect(initialRichTextValue(value)).toBe(value);
    });
});

function quillField(value: unknown, extra: Record<string, any> = {}) {
    return new FieldDef({
        name: 'bio',
        label: 'Bio',
        value,
        widget: new WidgetDef('QuillWidget', null, {}, '', '', ''),
        field_type: 'QuillFormField',
        required: false,
        ...extra,
    });
}

function renderForm(field: FieldDef) {
    return render(<ReactForm form={new FormDef([field], '/save/', '', [], false)} />);
}

describe('the Quill widget in a form', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
        vi.stubGlobal('fetch', fetchMock);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('starts an empty field as empty strings', async () => {
        renderForm(quillField(null));
        await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ bio: { delta: '', html: '' } });
    });

    it('sends an untouched value in the same shape a JSON body uses', async () => {
        const stored = { delta: JSON.stringify({ ops: [{ insert: 'hi\n' }] }), html: '<p>hi</p>' };
        renderForm(quillField(JSON.stringify(stored)));
        await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const sent = JSON.parse(fetchMock.mock.calls[0][1].body).bio;
        expect(sent.html).toBe('<p>hi</p>');
    });

    it('sends an untouched value as JSON, not "[object Object]", in a multipart body', async () => {
        const file = new FieldDef({
            name: 'upload',
            label: 'Upload',
            value: '',
            widget: new WidgetDef('FileInput', null, {}, '', '', ''),
            field_type: 'FileField',
            required: false,
        });
        const stored = { delta: { ops: [{ insert: 'hi\n' }] }, html: '<p>hi</p>' };
        render(<ReactForm form={new FormDef([file, quillField(stored)], '/save/', '', [], false)} />);
        await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const sent = (fetchMock.mock.calls[0][1].body as FormData).get('bio') as string;
        expect(sent).not.toBe('[object Object]');
        expect(JSON.parse(sent).html).toBe('<p>hi</p>');
    });

    it('creates a real Quill editor with the stored content', async () => {
        const { container } = renderForm(
            quillField({ delta: { ops: [{ insert: 'Stored text\n' }] }, html: '' }),
        );
        await waitFor(() => expect(container.querySelector('.ql-editor')).not.toBeNull());
        expect(container.querySelector('.ql-editor')?.textContent).toBe('Stored text');
        expect(container.querySelector('.ql-toolbar')).not.toBeNull();
    });

    it('reports edits as a QuillValue', async () => {
        const onChange = vi.fn();
        const field = quillField(null);
        const { container } = render(
            <RichTextWidget
                id="bio"
                name="bio"
                value={null}
                onChange={onChange}
                choices={[]}
                field={field}
            />,
        );
        const editor = await waitFor(() => {
            const el = container.querySelector('.ql-editor') as HTMLElement;
            expect(el).not.toBeNull();
            return el;
        });
        await act(async () => {
            editor.innerHTML = '<p>typed</p>';
            await new Promise((resolve) => setTimeout(resolve, 20));
        });
        await waitFor(() => expect(onChange).toHaveBeenCalled());
        const value = onChange.mock.calls[onChange.mock.calls.length - 1][0];
        expect(value).toBeInstanceOf(QuillValue);
        expect(value.html).toContain('typed');
    });
});

describe('a Quill form from Django, mounted', () => {
    afterEach(() => {
        unmountAll();
        document.body.innerHTML = '';
    });

    it('unpacks and draws the saved rich text', async () => {
        document.body.innerHTML = '<div id="q"></div>';
        const script = document.createElement('script');
        script.type = 'application/json';
        script.dataset.dreactFor = 'q';
        script.textContent = JSON.stringify(packedQuill);
        document.body.appendChild(script);
        await act(async () => {
            mountAll();
        });
        await waitFor(() => expect(document.querySelector('.ql-editor')?.textContent).toBe('Hi'));
    });
});
