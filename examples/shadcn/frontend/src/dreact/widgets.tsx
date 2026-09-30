import { useState } from 'react';
import { X } from 'lucide-react';
import { parseTags, type WidgetProps } from 'django-react-forms';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

/** Attributes every control gets: its id (for the label), name, focus ref and a11y wiring. */
function common(p: WidgetProps) {
    return {
        id: p.id,
        name: p.name,
        disabled: p.disabled,
        onBlur: p.onBlur,
        ref: p.inputRef,
        'aria-invalid': p.invalid || undefined,
        'aria-describedby': p.describedBy,
    };
}

function text(type: string) {
    return function TextWidget(p: WidgetProps) {
        return (
            <Input
                {...common(p)}
                type={type}
                readOnly={p.readOnly}
                placeholder={p.placeholder}
                value={p.value ?? ''}
                onChange={(e) => p.onChange(e.target.value)}
            />
        );
    };
}

function TextareaWidget(p: WidgetProps) {
    return (
        <Textarea
            {...common(p)}
            readOnly={p.readOnly}
            placeholder={p.placeholder}
            value={p.value ?? ''}
            onChange={(e) => p.onChange(e.target.value)}
        />
    );
}

/** Django sends "YYYY-MM-DD HH:MM:SS"; a datetime-local input wants "YYYY-MM-DDTHH:MM". */
function DateTimeWidget(p: WidgetProps) {
    const shown = typeof p.value === 'string' ? p.value.replace(' ', 'T').slice(0, 16) : '';
    return <Input {...common(p)} type="datetime-local" value={shown} onChange={(e) => p.onChange(e.target.value)} />;
}

function FileWidget(p: WidgetProps) {
    const existing = p.value && typeof p.value === 'object' && 'name' in p.value ? p.value : null;
    return (
        <>
            <Input {...common(p)} type="file" onChange={(e) => p.onChange(e.target.files?.[0])} />
            {existing ? <p className="text-xs text-muted-foreground">Current file: {String(existing.name)}</p> : null}
        </>
    );
}

// Radix's Select can't hold an empty string, so "no choice" travels as this sentinel
const EMPTY = '__empty__';

function SelectWidget(p: WidgetProps) {
    const value = p.value === null || p.value === undefined || p.value === '' ? undefined : String(p.value);
    return (
        <Select
            name={p.name}
            disabled={p.disabled}
            value={value}
            onValueChange={(next) => p.onChange(next === EMPTY ? '' : next)}
        >
            <SelectTrigger
                id={p.id}
                onBlur={p.onBlur}
                aria-invalid={p.invalid || undefined}
                aria-describedby={p.describedBy}
            >
                <SelectValue placeholder="Please select" />
            </SelectTrigger>
            <SelectContent>
                {p.choices.map((choice) => (
                    <SelectItem key={String(choice.value)} value={String(choice.value) || EMPTY}>
                        {choice.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

/** A list of checkboxes; the form value is the array of checked values. */
function CheckboxListWidget(p: WidgetProps) {
    const selected = Array.isArray(p.value) ? p.value.map(String) : [];
    const toggle = (value: string, checked: boolean) =>
        p.onChange(checked ? [...selected, value] : selected.filter((item) => item !== value));
    return (
        <div id={p.id} role="group" aria-labelledby={`${p.id}-label`} className="flex flex-col gap-2">
            {p.choices.map((choice) => {
                const value = String(choice.value);
                const itemId = `${p.id}-${value}`;
                return (
                    <label key={value} htmlFor={itemId} className="flex items-center gap-2 text-sm">
                        <Checkbox
                            id={itemId}
                            checked={selected.includes(value)}
                            disabled={p.disabled}
                            onCheckedChange={(checked) => toggle(value, checked === true)}
                        />
                        {choice.label}
                    </label>
                );
            })}
        </div>
    );
}

/** The label and help text of a boolean are drawn by the Field slot; this is just the switch. */
function SwitchWidget(p: WidgetProps) {
    return (
        <Switch
            id={p.id}
            checked={!!p.value}
            disabled={p.disabled || p.readOnly}
            onCheckedChange={p.onChange}
            aria-describedby={p.describedBy}
        />
    );
}

/** Pill input for a list of tags (a `TagField`): Enter or a comma adds one, Backspace removes one. */
function TagWidget(p: WidgetProps) {
    const tags = parseTags(p.value);
    const [draft, setDraft] = useState('');
    const limit = typeof p.maxTags === 'number' ? p.maxTags : Infinity;

    const add = () => {
        const tag = draft.trim().slice(0, typeof p.maxTagLength === 'number' ? p.maxTagLength : undefined);
        setDraft('');
        if (!tag || tags.length >= limit || tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
        p.onChange([...tags, tag]);
    };

    return (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
            {tags.map((tag) => (
                <Badge key={tag}>
                    {tag}
                    {p.disabled ? null : (
                        <button
                            type="button"
                            aria-label={`Remove ${tag}`}
                            onClick={() => p.onChange(tags.filter((t) => t !== tag))}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </Badge>
            ))}
            <input
                id={p.id}
                className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                value={draft}
                disabled={p.disabled}
                placeholder={tags.length >= limit ? '' : p.placeholder}
                aria-invalid={p.invalid || undefined}
                aria-describedby={p.describedBy}
                onBlur={p.onBlur}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault(); // Enter must never submit the form from here
                        add();
                    } else if (e.key === 'Backspace' && !draft && tags.length) {
                        p.onChange(tags.slice(0, -1));
                    }
                }}
            />
        </div>
    );
}

/** Django widget class name (or a `ReactComponentWidget`'s component key) -> the component that draws it. */
export const widgets: Record<string, (p: WidgetProps) => JSX.Element> = {
    TextInput: text('text'),
    EmailInput: text('email'),
    URLInput: text('url'),
    NumberInput: text('number'),
    PasswordInput: text('password'),
    HiddenInput: text('hidden'),
    DateInput: text('date'),
    TimeInput: text('time'),
    DateTimeInput: DateTimeWidget,
    Textarea: TextareaWidget,
    FileInput: FileWidget,
    ClearableFileInput: FileWidget,
    Select: SelectWidget,
    CheckboxSelectMultiple: CheckboxListWidget,
    CheckboxInput: SwitchWidget,
    TagInput: TagWidget,
};
