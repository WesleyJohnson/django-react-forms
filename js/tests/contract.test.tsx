import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { mountAll, unmountAll } from '@/index';
// Produced by a real Django form (python/tests/test_contract.py); this is what the client is sent
import packed from './fixtures/packed-form.json';

function addToPage(payload: unknown = packed) {
    const id = 'dreact-contract';
    document.body.innerHTML = `<div id="${id}" data-dreact-mount></div>`;
    const script = document.createElement('script');
    script.type = 'application/json';
    script.dataset.dreactFor = id;
    script.textContent = JSON.stringify(payload);
    document.body.appendChild(script);
}

async function mount() {
    await act(async () => {
        mountAll();
    });
}

describe('a form from Django, mounted', () => {
    beforeEach(() => addToPage());
    afterEach(() => {
        unmountAll();
        document.body.innerHTML = '';
    });

    it('draws every visible field with its label, initial value and help text', async () => {
        await mount();
        expect(screen.getByLabelText(/Title/)).toHaveValue('Marine Biology');
        expect(screen.getByText('A short name')).toBeInTheDocument();
        expect(screen.getByLabelText(/Kind/)).toHaveValue('paid');
        expect(screen.getByLabelText(/Starts/)).toHaveValue('2026-01-02T09:30');
        expect(screen.getByLabelText(/Agree/)).not.toBeChecked();
    });

    it('groups fields into fieldsets by their prefixed names', async () => {
        await mount();
        const legends = screen
            .getAllByRole('group')
            .map((group) => group.querySelector('legend')?.textContent);
        expect(legends).toContain('About');
        expect(legends).toContain('Details');
    });

    it('pre-checks the initial multiple choice and shows the initial tags', async () => {
        await mount();
        const days = screen.getByRole('group', { name: /Days/ });
        expect(within(days).getByLabelText('Monday')).toBeChecked();
        expect(within(days).getByLabelText('Tuesday')).not.toBeChecked();
        expect(screen.getByText('sea')).toBeInTheDocument();
        expect(screen.getByText('science')).toBeInTheDocument();
    });

    it('shows the conditional field only while its condition holds (prefixed names)', async () => {
        await mount();
        expect(screen.getByLabelText(/Fee/)).toHaveValue(5);
        await userEvent.selectOptions(screen.getByLabelText(/Kind/), 'free');
        expect(screen.queryByLabelText(/Fee/)).not.toBeInTheDocument();
    });

    it('posts the values under the prefixed names, leaving out a hidden field', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
        vi.stubGlobal('fetch', fetchMock);
        await mount();
        await userEvent.selectOptions(screen.getByLabelText(/Kind/), 'free');
        await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('/save/');
        // The form has a file field, so it goes as multipart
        const body = init.body as FormData;
        expect(body.get('p-title')).toBe('Marine Biology');
        expect(body.get('p-kind')).toBe('free');
        expect(body.getAll('p-days')).toEqual(['mon']);
        expect(body.get('p-tags')).toBe('["sea","science"]');
        expect(body.has('p-fee')).toBe(false);
        vi.unstubAllGlobals();
    });

    it('still draws a field that no field group lists, after the groups', async () => {
        const grouped = JSON.parse(JSON.stringify(packed));
        const groups = grouped._args[1].form._args[3];
        groups[1].fields = groups[1].fields.filter((name: string) => name !== 'p-days');
        addToPage(grouped);
        await mount();
        const days = screen.getByRole('group', { name: /Days/ });
        expect(days).toBeInTheDocument();
        // It comes after the last fieldset in the document
        const fieldsets = screen.getAllByRole('group').filter((g) => g.tagName === 'FIELDSET');
        const lastFieldset = fieldsets[fieldsets.length - 1];
        expect(lastFieldset.compareDocumentPosition(days) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('does not mount the same payload twice', async () => {
        await mount();
        await mount();
        expect(screen.getAllByLabelText(/Title/)).toHaveLength(1);
    });
});

describe('mounting problems', () => {
    afterEach(() => {
        unmountAll();
        document.body.innerHTML = '';
    });

    it('says so when the server names a component nobody registered', async () => {
        addToPage({ _type: 'dreact.Bridge', _args: ['NoSuchComponent', {}] });
        await mount();
        expect(screen.getByRole('alert')).toHaveTextContent('Unknown component "NoSuchComponent"');
    });

    it('logs and skips data that is not JSON', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        document.body.innerHTML =
            '<div id="x"></div><script type="application/json" data-dreact-for="x">{oops</script>';
        await mount();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('logs and skips a payload with no matching element', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        document.body.innerHTML = '<script type="application/json" data-dreact-for="missing">{}</script>';
        await mount();
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('no element with id "missing"'));
        spy.mockRestore();
    });

    it('keeps a component that throws from blanking the page', async () => {
        const { registerComponent } = await import('@/index');
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        registerComponent('Boom', () => {
            throw new Error('boom');
        });
        addToPage({ _type: 'dreact.Bridge', _args: ['Boom', {}] });
        await mount();
        expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
        spy.mockRestore();
    });
});
