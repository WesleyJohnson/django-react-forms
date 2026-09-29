import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChoiceDef, FieldDef, WidgetDef } from '@/adapters';
import { getWidget, type WidgetProps } from '@/index';

function props(overrides: Partial<WidgetProps> = {}): WidgetProps {
    return {
        id: 'f',
        name: 'f',
        value: '',
        onChange: vi.fn(),
        choices: [],
        field: new FieldDef({
            name: 'f',
            label: 'F',
            value: '',
            widget: new WidgetDef('TextInput', null, {}, '', '', ''),
            field_type: 'CharField',
            required: false,
        }),
        ...overrides,
    };
}

function draw(name: string, overrides: Partial<WidgetProps> = {}) {
    const Widget = getWidget(name)!;
    const p = props(overrides);
    return { ...render(<Widget {...p} />), onChange: p.onChange as ReturnType<typeof vi.fn> };
}

const choices = [
    new ChoiceDef('a', 'Alpha'),
    new ChoiceDef('b', 'Beta'),
    new ChoiceDef('c', 'Gamma', 'Group two'),
];

describe('default widgets', () => {
    it.each([
        ['TextInput', 'text'],
        ['EmailInput', 'email'],
        ['URLInput', 'url'],
        ['PasswordInput', 'password'],
        ['NumberInput', 'number'],
        ['DateInput', 'date'],
        ['TimeInput', 'time'],
        ['HiddenInput', 'hidden'],
        ['DateTimeInput', 'datetime-local'],
    ])('%s draws an input of type %s', (name, type) => {
        const { container } = draw(name);
        expect(container.querySelector('input')).toHaveAttribute('type', type);
    });

    it('a text input reports typing', async () => {
        const { onChange } = draw('TextInput');
        await userEvent.type(screen.getByRole('textbox'), 'a');
        expect(onChange).toHaveBeenLastCalledWith('a');
    });

    it('a datetime input shows the server format in the browser format', () => {
        const { container } = draw('DateTimeInput', { value: '2026-01-02 09:30:00' });
        expect(container.querySelector('input')).toHaveValue('2026-01-02T09:30');
    });

    it('a textarea draws and reports', async () => {
        const { onChange } = draw('Textarea', { value: 'x' });
        const box = screen.getByRole('textbox');
        expect(box.tagName).toBe('TEXTAREA');
        await userEvent.type(box, 'y');
        expect(onChange).toHaveBeenLastCalledWith('xy');
    });

    it('a checkbox reports a boolean', async () => {
        const { onChange } = draw('CheckboxInput', { value: false });
        await userEvent.click(screen.getByRole('checkbox'));
        expect(onChange).toHaveBeenLastCalledWith(true);
    });

    it('a select lists choices, groups them, and reports the value', async () => {
        const { container, onChange } = draw('Select', { choices, value: 'a' });
        expect(screen.getByRole('combobox')).toHaveValue('a');
        expect(container.querySelector('optgroup')).toHaveAttribute('label', 'Group two');
        await userEvent.selectOptions(screen.getByRole('combobox'), 'b');
        expect(onChange).toHaveBeenLastCalledWith('b');
    });

    it('a select with no matching option shows a placeholder instead of pretending the first is chosen', () => {
        draw('Select', { choices, value: '' });
        const select = screen.getByRole('combobox');
        expect(select).toHaveValue('');
        expect(screen.getByRole('option', { name: 'Please select' })).toBeDisabled();
    });

    it('a select that has a blank choice shows no extra placeholder', () => {
        draw('Select', { choices: [new ChoiceDef('', '---------'), ...choices], value: '' });
        expect(screen.queryByRole('option', { name: 'Please select' })).toBeNull();
    });

    it('a multiple select reports a list', async () => {
        const { onChange } = draw('SelectMultiple', { choices, value: ['a'] });
        await userEvent.selectOptions(screen.getByRole('listbox'), 'b');
        expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
    });

    it('a checkbox group checks its values, whether a list or a JSON string, and reports a list', async () => {
        const { onChange } = draw('CheckboxSelectMultiple', { choices, value: '["a"]' });
        expect(screen.getByLabelText('Alpha')).toBeChecked();
        await userEvent.click(screen.getByLabelText('Beta'));
        expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
        await userEvent.click(screen.getByLabelText('Alpha'));
        expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it('a checkbox group matches numeric values to string choices', () => {
        draw('CheckboxSelectMultiple', {
            choices: [new ChoiceDef(1, 'One'), new ChoiceDef(2, 'Two')],
            value: [2],
        });
        expect(screen.getByLabelText('Two')).toBeChecked();
        expect(screen.getByLabelText('One')).not.toBeChecked();
    });

    it('radio buttons select one value', async () => {
        const { onChange } = draw('RadioSelect', { choices, value: 'a' });
        expect(screen.getByLabelText('Alpha')).toBeChecked();
        await userEvent.click(screen.getByLabelText('Beta'));
        expect(onChange).toHaveBeenLastCalledWith('b');
    });

    it('a file input reports the chosen file', async () => {
        const { container, onChange } = draw('FileInput');
        const file = new File(['x'], 'a.txt', { type: 'text/plain' });
        await userEvent.upload(container.querySelector('input[type=file]') as HTMLInputElement, file);
        expect(onChange).toHaveBeenLastCalledWith(file);
    });

    it('links to an existing file', () => {
        draw('ClearableFileInput', { value: { name: 'logo.png', url: '/media/logo.png' } });
        expect(screen.getByRole('link', { name: /logo\.png/ })).toHaveAttribute('href', '/media/logo.png');
    });

    it.each(['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', ''])(
        'does not link an existing file whose url is %j',
        (url) => {
            draw('FileInput', { value: { name: 'x.png', url } });
            expect(screen.queryByRole('link')).toBeNull();
        },
    );

    it('passes id, disabled and aria attributes to the control', () => {
        const { container } = draw('TextInput', {
            id: 'title',
            disabled: true,
            invalid: true,
            describedBy: 'title-help',
        });
        const input = container.querySelector('input')!;
        expect(input).toHaveAttribute('id', 'title');
        expect(input).toBeDisabled();
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAttribute('aria-describedby', 'title-help');
    });
});
