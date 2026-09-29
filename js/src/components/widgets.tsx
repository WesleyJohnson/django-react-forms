import type { ChangeEvent } from 'react';
import { isPlainObject } from '../adapters';
import { useMessages } from '../messages-context';
import { registerWidget, type WidgetBehavior, type WidgetProps } from '../registry';
import { TagInput, parseTags } from './tag-input';

/** Attributes every native control shares. */
function controlProps(p: WidgetProps) {
    return {
        id: p.id,
        name: p.name,
        disabled: p.disabled,
        className: p.className,
        style: p.style,
        onBlur: p.onBlur,
        ref: p.inputRef,
        'aria-invalid': p.invalid || undefined,
        'aria-describedby': p.describedBy,
    };
}

function textLike(type: string) {
    return function TextLikeInput(p: WidgetProps) {
        return (
            <input
                {...controlProps(p)}
                type={type}
                readOnly={p.readOnly}
                placeholder={p.placeholder}
                value={p.value ?? ''}
                onChange={(e) => p.onChange(e.target.value)}
            />
        );
    };
}

const TextInput = textLike('text');
const NumberInput = textLike('number');
const EmailInput = textLike('email');
const URLInput = textLike('url');
const PasswordInput = textLike('password');
const HiddenInput = textLike('hidden');
const DateInput = textLike('date');
const TimeInput = textLike('time');

/** Django sends "YYYY-MM-DD HH:MM:SS"; a datetime-local input wants "YYYY-MM-DDTHH:MM". */
function DateTimeInput(p: WidgetProps) {
    const shown = typeof p.value === 'string' ? p.value.replace(' ', 'T').slice(0, 16) : '';
    return (
        <input
            {...controlProps(p)}
            type="datetime-local"
            readOnly={p.readOnly}
            value={shown}
            onChange={(e) => p.onChange(e.target.value)}
        />
    );
}

function Textarea(p: WidgetProps) {
    return (
        <textarea
            {...controlProps(p)}
            readOnly={p.readOnly}
            placeholder={p.placeholder}
            value={p.value ?? ''}
            onChange={(e) => p.onChange(e.target.value)}
        />
    );
}

function CheckboxInput(p: WidgetProps) {
    return (
        <input
            {...controlProps(p)}
            type="checkbox"
            checked={!!p.value}
            disabled={p.disabled || p.readOnly}
            onChange={(e) => p.onChange(e.target.checked)}
        />
    );
}

function Options({ choices }: Pick<WidgetProps, 'choices'>) {
    const groups: Record<string, typeof choices> = {};
    for (const choice of choices) (groups[choice.group] ??= []).push(choice);
    return (
        <>
            {Object.entries(groups).map(([group, items]) => {
                const options = items.map((choice) => (
                    <option key={String(choice.value)} value={String(choice.value)}>
                        {choice.label}
                    </option>
                ));
                return group ? (
                    <optgroup key={group} label={group}>
                        {options}
                    </optgroup>
                ) : (
                    options
                );
            })}
        </>
    );
}

function Select(p: WidgetProps) {
    const messages = useMessages();
    const value = p.value === null || p.value === undefined ? '' : String(p.value);
    // A select shows its first option when nothing matches, which would disagree with the form's
    // (empty) value; a placeholder keeps what's shown and what's held the same
    const needsPlaceholder = value === '' && !p.choices.some((choice) => String(choice.value) === '');
    return (
        <select {...controlProps(p)} value={value} onChange={(e) => p.onChange(e.target.value)}>
            {needsPlaceholder ? (
                <option value="" disabled>
                    {messages.selectPlaceholder}
                </option>
            ) : null}
            <Options choices={p.choices} />
        </select>
    );
}

/** The selected values of a widget whose value is a list, as strings. */
function selectedValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string' && value) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
            return [];
        }
    }
    return [];
}

function SelectMultiple(p: WidgetProps) {
    return (
        <select
            {...controlProps(p)}
            multiple
            value={selectedValues(p.value)}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                p.onChange(Array.from(e.target.selectedOptions, (option) => option.value))
            }
        >
            <Options choices={p.choices} />
        </select>
    );
}

function CheckboxSelectMultiple(p: WidgetProps) {
    const selected = selectedValues(p.value);
    const toggle = (value: string, checked: boolean) =>
        p.onChange(checked ? [...selected, value] : selected.filter((item) => item !== value));
    return (
        <div
            id={p.id}
            role="group"
            aria-labelledby={`${p.id}-label`}
            aria-describedby={p.describedBy}
            className={['dreact-choices', p.className].filter(Boolean).join(' ')}
            style={p.style}
        >
            {p.choices.map((choice) => {
                const value = String(choice.value);
                return (
                    <label key={value} className="dreact-choice">
                        <input
                            type="checkbox"
                            name={p.name}
                            value={value}
                            checked={selected.includes(value)}
                            disabled={p.disabled}
                            onBlur={p.onBlur}
                            onChange={(e) => toggle(value, e.target.checked)}
                        />{' '}
                        {choice.label}
                        {choice.description ? <small> {choice.description}</small> : null}
                    </label>
                );
            })}
        </div>
    );
}

function RadioSelect(p: WidgetProps) {
    return (
        <div
            id={p.id}
            role="radiogroup"
            aria-labelledby={`${p.id}-label`}
            aria-describedby={p.describedBy}
            className={['dreact-choices', p.className].filter(Boolean).join(' ')}
            style={p.style}
        >
            {p.choices.map((choice) => {
                const value = String(choice.value);
                return (
                    <label key={value} className="dreact-choice">
                        <input
                            type="radio"
                            name={p.name}
                            value={value}
                            checked={String(p.value ?? '') === value}
                            disabled={p.disabled}
                            onBlur={p.onBlur}
                            onChange={() => p.onChange(value)}
                        />{' '}
                        {choice.label}
                        {choice.description ? <small> {choice.description}</small> : null}
                    </label>
                );
            })}
        </div>
    );
}

/** Only http(s) and relative URLs become links; anything else (``javascript:``) is dropped. */
function safeHref(url: unknown): string | null {
    if (typeof url !== 'string' || !url) return null;
    try {
        const parsed = new URL(url, window.location.href);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null;
    } catch {
        return null;
    }
}

function FileInput(p: WidgetProps) {
    const messages = useMessages();
    const existing = isPlainObject(p.value) ? p.value : null;
    const href = existing ? safeHref(existing.url) : null;
    return (
        <>
            <input {...controlProps(p)} type="file" onChange={(e) => p.onChange(e.target.files?.[0])} />
            {existing && href ? (
                <p className="dreact-current-file">
                    <a href={href} target="_blank" rel="noopener noreferrer">
                        {messages.currentFile} {String(existing.name)}
                    </a>
                </p>
            ) : null}
        </>
    );
}

/**
 * A list value: a JSON string from the server, or the array once edited. Items keep their type
 * (a TypedMultipleChoiceField of ints stays ints) until the user changes the selection.
 */
const listBehavior: WidgetBehavior = {
    defaultValue: (field) => {
        if (Array.isArray(field.value)) return field.value;
        if (typeof field.value === 'string' && field.value) {
            try {
                const parsed = JSON.parse(field.value);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }
        return [];
    },
};

export function registerDefaultWidgets(): void {
    registerWidget('TextInput', TextInput);
    registerWidget('NumberInput', NumberInput);
    registerWidget('EmailInput', EmailInput);
    registerWidget('URLInput', URLInput);
    registerWidget('PasswordInput', PasswordInput);
    registerWidget('HiddenInput', HiddenInput);
    registerWidget('DateInput', DateInput);
    registerWidget('DateTimeInput', DateTimeInput);
    registerWidget('TimeInput', TimeInput);
    registerWidget('Textarea', Textarea);
    registerWidget('CheckboxInput', CheckboxInput);
    registerWidget('Select', Select);
    registerWidget('SelectMultiple', SelectMultiple, listBehavior);
    registerWidget('CheckboxSelectMultiple', CheckboxSelectMultiple, listBehavior);
    registerWidget('RadioSelect', RadioSelect);
    registerWidget('FileInput', FileInput);
    registerWidget('ClearableFileInput', FileInput);
    registerWidget('TagInput', TagInput, { defaultValue: (field) => parseTags(field.value) });
}
