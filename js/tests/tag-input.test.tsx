import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { FieldDef, WidgetDef } from '@/adapters';
import { getWidget, parseTags, type WidgetProps } from '@/index';

const field = new FieldDef({
    name: 'tags',
    label: 'Tags',
    value: '',
    widget: new WidgetDef('TagInput', 'TagInput', {}, '', '', ''),
    field_type: 'TagField',
    required: false,
});

/** Holds the value the way a form would, so typing accumulates. */
function Harness({
    initial = [],
    onChange,
    ...extra
}: { initial?: string[]; onChange?: (v: string[]) => void } & Partial<WidgetProps>) {
    const [value, setValue] = useState<string[]>(initial);
    const Widget = getWidget('TagInput')!;
    return (
        <Widget
            id="tags"
            name="tags"
            value={value}
            onChange={(next) => {
                setValue(next);
                onChange?.(next);
            }}
            choices={[]}
            field={field}
            {...extra}
        />
    );
}

describe('parseTags', () => {
    it('reads a list or a JSON-encoded list, and nothing else', () => {
        expect(parseTags(['a', 2])).toEqual(['a', '2']);
        expect(parseTags('["x","y"]')).toEqual(['x', 'y']);
        for (const value of ['', 'not json', '{"a":1}', null, undefined, 5]) {
            expect(parseTags(value)).toEqual([]);
        }
    });
});

describe('TagInput', () => {
    it('shows the existing tags', () => {
        render(<Harness initial={['sea', 'science']} />);
        expect(screen.getByText('sea')).toBeInTheDocument();
        expect(screen.getByText('science')).toBeInTheDocument();
    });

    it('adds a tag on Enter and never submits the form', async () => {
        const onSubmit = vi.fn((e) => e.preventDefault());
        const onChange = vi.fn();
        render(
            <form onSubmit={onSubmit}>
                <Harness onChange={onChange} />
            </form>,
        );
        await userEvent.type(screen.getByRole('textbox'), 'art{Enter}');
        expect(onChange).toHaveBeenLastCalledWith(['art']);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('adds a tag on a comma', async () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        await userEvent.type(screen.getByRole('textbox'), 'art,');
        expect(onChange).toHaveBeenLastCalledWith(['art']);
    });

    it('ignores duplicates regardless of case, and blanks', async () => {
        const onChange = vi.fn();
        render(<Harness initial={['Art']} onChange={onChange} />);
        await userEvent.type(screen.getByRole('textbox'), 'art{Enter}');
        await userEvent.type(screen.getByRole('textbox'), '   {Enter}');
        expect(onChange).not.toHaveBeenCalled();
    });

    it('removes a tag with its button and with Backspace on an empty draft', async () => {
        const onChange = vi.fn();
        render(<Harness initial={['a', 'b', 'c']} onChange={onChange} />);
        await userEvent.click(screen.getByLabelText('Remove b'));
        expect(onChange).toHaveBeenLastCalledWith(['a', 'c']);
        await userEvent.type(screen.getByRole('textbox'), '{Backspace}');
        expect(onChange).toHaveBeenLastCalledWith(['a']);
    });

    it('splits pasted text into tags', () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        fireEvent.paste(screen.getByRole('textbox'), { clipboardData: { getData: () => 'one, two\nthree' } });
        expect(onChange).toHaveBeenLastCalledWith(['one', 'two', 'three']);
    });

    it('stops at maxTags and truncates to maxTagLength', async () => {
        const onChange = vi.fn();
        render(<Harness maxTags={2} maxTagLength={3} onChange={onChange} />);
        await userEvent.type(screen.getByRole('textbox'), 'abcdef{Enter}');
        expect(onChange).toHaveBeenLastCalledWith(['abc']);
        await userEvent.type(screen.getByRole('textbox'), 'x{Enter}y{Enter}');
        expect(onChange).toHaveBeenLastCalledWith(['abc', 'x']);
        expect(screen.getByLabelText('Tag limit of 2 reached')).toBeInTheDocument();
    });

    it('commits a half-typed tag when the form submits', async () => {
        const onChange = vi.fn();
        const onSubmit = vi.fn((e) => e.preventDefault());
        render(
            <form onSubmit={onSubmit}>
                <Harness onChange={onChange} />
                <button type="submit">Go</button>
            </form>,
        );
        await userEvent.type(screen.getByRole('textbox'), 'pending');
        await userEvent.click(screen.getByRole('button', { name: 'Go' }));
        expect(onChange).toHaveBeenLastCalledWith(['pending']);
    });

    it('cannot be edited when disabled', () => {
        render(<Harness initial={['a']} disabled />);
        expect(screen.getByRole('textbox')).toBeDisabled();
        expect(screen.queryByLabelText('Remove a')).toBeNull();
    });
});
