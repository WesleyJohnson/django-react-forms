import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldDef, FormDef, WidgetDef } from '@/adapters';
import { ReactForm } from '@/components/react-form';
import { registerCore } from '@/setup';
import {
    configure,
    registerSlot,
    registerWidget,
    setDefaultMessages,
    type SlotProps,
    type WidgetProps,
} from '@/index';

function field(name: string, widget = 'TextInput', extra: Record<string, any> = {}) {
    return new FieldDef({
        name,
        label: name,
        value: '',
        widget: new WidgetDef(widget, null, {}, '', '', ''),
        field_type: 'CharField',
        required: false,
        ...extra,
    });
}

const draw = (fields: FieldDef[], props: Record<string, any> = {}) =>
    render(<ReactForm form={new FormDef(fields, '/save/', '', [], false)} {...props} />);

afterEach(() => {
    registerCore(); // put the defaults back
    setDefaultMessages({});
    configure({ notify: undefined, onSuccess: undefined, onError: undefined, redirectDelay: undefined });
});

describe('registering your own pieces', () => {
    it('a registered widget replaces the default for that widget name', () => {
        registerWidget('TextInput', ({ value }: WidgetProps) => (
            <output data-testid="mine">{String(value)}</output>
        ));
        draw([field('a', 'TextInput', { value: 'hello' })]);
        expect(screen.getByTestId('mine')).toHaveTextContent('hello');
    });

    it('a widget is chosen by the component key when the server names one', () => {
        registerWidget('EmergencyContacts', ({ field }: WidgetProps) => <p>custom for {field.name}</p>);
        const custom = new FieldDef({
            name: 'contacts',
            label: 'Contacts',
            value: '',
            widget: new WidgetDef('ReactComponentWidget', 'EmergencyContacts', {}, '', '', ''),
            field_type: 'CharField',
            required: false,
        });
        draw([custom]);
        expect(screen.getByText('custom for contacts')).toBeInTheDocument();
    });

    it('widget props from Python are passed to the component', () => {
        registerWidget('Tally', ({ label }: WidgetProps) => <p>{label}</p>);
        const f = new FieldDef({
            name: 't',
            label: 'T',
            value: '',
            widget: new WidgetDef('ReactComponentWidget', 'Tally', { label: 'from python' }, '', '', ''),
            field_type: 'CharField',
            required: false,
        });
        draw([f]);
        expect(screen.getByText('from python')).toBeInTheDocument();
    });

    it("a widget's default value comes from its registered behavior", async () => {
        registerWidget('Shout', ({ value }: WidgetProps) => <p>{String(value)}</p>, {
            defaultValue: (f) => String(f.value).toUpperCase(),
        });
        draw([field('s', 'Shout', { value: 'quiet' })]);
        expect(screen.getByText('QUIET')).toBeInTheDocument();
    });

    it('a replaced Field slot wraps every control', () => {
        registerSlot('Field', ({ field, error, children }: SlotProps['Field']) => (
            <section data-testid="wrap">
                <h3>{field.label}!</h3>
                {children}
                {error}
            </section>
        ));
        draw([field('a'), field('b')]);
        expect(screen.getAllByTestId('wrap')).toHaveLength(2);
        expect(screen.getByText('a!')).toBeInTheDocument();
    });

    it('replaced Fieldset, FormError and SubmitButton slots are used', async () => {
        registerSlot('Fieldset', ({ name, children }: SlotProps['Fieldset']) => (
            <div data-testid="set" data-name={name}>
                {children}
            </div>
        ));
        registerSlot('FormError', ({ message }: SlotProps['FormError']) => (
            <b data-testid="err">{message}</b>
        ));
        registerSlot('SubmitButton', ({ label }: SlotProps['SubmitButton']) => (
            <button type="submit">{`>> ${label}`}</button>
        ));
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ errors: { __all__: ['No.'] } }),
        });
        vi.stubGlobal('fetch', fetchMock);
        render(
            <ReactForm
                form={new FormDef([field('a')], '/save/', '', [{ name: 'One', fields: ['a'] }], false)}
            />,
        );
        expect(screen.getByTestId('set')).toHaveAttribute('data-name', 'One');
        await userEvent.click(screen.getByRole('button', { name: '>> Submit' }));
        await waitFor(() => expect(screen.getByTestId('err')).toHaveTextContent('No.'));
        vi.unstubAllGlobals();
    });
});

describe('messages and notifications', () => {
    it('messages can be reworded per form', () => {
        draw([field('a')], { messages: { submit: 'Enviar', optional: '(opcional)' } });
        expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
        expect(screen.getByText('(opcional)')).toBeInTheDocument();
    });

    it('messages can be set once for every form', () => {
        setDefaultMessages({ submit: 'Save it' });
        draw([field('a')]);
        expect(screen.getByRole('button', { name: 'Save it' })).toBeInTheDocument();
    });

    it('validation messages can be reworded', async () => {
        draw([field('a', 'TextInput', { required: true })], {
            messages: { validation: { required: (label: string) => `${label} fehlt.` } },
        });
        await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
        expect(await screen.findByText('a fehlt.')).toBeInTheDocument();
    });

    it('notify receives success and failure notices; the library draws none itself', async () => {
        const notify = vi.fn();
        const ok = vi
            .fn()
            .mockResolvedValue({ ok: true, status: 200, json: async () => ({ message: 'Saved it.' }) });
        vi.stubGlobal('fetch', ok);
        draw([field('a')], { notify });
        await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
        await waitFor(() =>
            expect(notify).toHaveBeenCalledWith({
                title: 'Success!',
                description: 'Saved it.',
                variant: 'success',
            }),
        );

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
        await waitFor(() =>
            expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ variant: 'error' })),
        );
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('configure() sets notify and onSuccess for every form, and a prop on the form wins', async () => {
        const configuredNotify = vi.fn();
        const configuredSuccess = vi.fn();
        configure({ notify: configuredNotify, onSuccess: configuredSuccess });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }));

        draw([field('a')]);
        await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
        await waitFor(() => expect(configuredSuccess).toHaveBeenCalled());
        expect(configuredNotify).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));

        const ownSuccess = vi.fn();
        document.body.innerHTML = '';
        draw([field('a')], { onSuccess: ownSuccess });
        await userEvent.click(screen.getAllByRole('button', { name: 'Submit' })[0]);
        await waitFor(() => expect(ownSuccess).toHaveBeenCalled());
        vi.unstubAllGlobals();
    });

    it('follows a redirect from the server when no onSuccess is given', async () => {
        const assign = vi.fn();
        vi.stubGlobal('location', { ...window.location, assign });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ redirect: '/done/' }) }),
        );
        draw([field('a')]);
        await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
        await waitFor(() => expect(assign).toHaveBeenCalledWith('/done/'));
        vi.unstubAllGlobals();
    });
});
