import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ClipboardEvent } from 'react';
import type { WidgetProps } from '../registry';

/**
 * Normalizes a tag field value to an array. The server sends ``TagField`` values as a
 * JSON-encoded list; once edited, the form holds a real array.
 */
export function parseTags(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map(String);
    }
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

// Characters that split pasted text into separate tags
const PASTE_SEPARATOR = /[,\n\r\t]+/;

export function TagInput({
    id,
    name,
    value,
    onChange,
    onBlur,
    disabled = false,
    placeholder,
    className,
    style,
    invalid,
    describedBy,
    maxTags,
    maxTagLength,
}: WidgetProps) {
    const tags = parseTags(value);
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const atLimit = !!maxTags && tags.length >= maxTags;

    const addTags = (candidates: string[]) => {
        const next = [...tags];
        const seen = new Set(next.map((tag) => tag.toLocaleLowerCase()));
        for (const candidate of candidates) {
            const tag = maxTagLength ? candidate.trim().slice(0, maxTagLength) : candidate.trim();
            if (!tag || seen.has(tag.toLocaleLowerCase())) continue;
            if (maxTags && next.length >= maxTags) break;
            seen.add(tag.toLocaleLowerCase());
            next.push(tag);
        }
        if (next.length !== tags.length) {
            onChange(next);
        }
        setDraft('');
    };

    // Commit a half-typed tag when the enclosing form submits. The capture-phase listener runs
    // before React's delegated onSubmit, so react-hook-form reads the new tag. (Committing on
    // blur instead adds a pill mid-click, which can shift the submit button out from under the
    // pointer and swallow the click.)
    useEffect(() => {
        const form = inputRef.current?.form;
        if (!form || !draft.trim()) return;
        const commitDraft = () => addTags([draft]);
        form.addEventListener('submit', commitDraft, true);
        return () => form.removeEventListener('submit', commitDraft, true);
    });

    const removeTag = (index: number) => {
        onChange(tags.filter((_, i) => i !== index));
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        const hasDraft = draft.trim() !== '';
        if (e.key === 'Enter' || e.key === ',') {
            // Enter always stays inside the tag input so it never submits the form
            e.preventDefault();
            if (hasDraft) addTags([draft]);
        } else if (e.key === 'Tab' && hasDraft) {
            // Tab with an empty draft falls through to normal focus navigation
            e.preventDefault();
            addTags([draft]);
        } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
            e.preventDefault();
            removeTag(tags.length - 1);
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        const text = e.clipboardData.getData('text');
        if (!PASTE_SEPARATOR.test(text)) return;
        e.preventDefault();
        addTags((draft + text).split(PASTE_SEPARATOR));
    };

    return (
        <div
            className={['dreact-tags', className].filter(Boolean).join(' ')}
            style={style}
            data-disabled={disabled}
            onClick={() => inputRef.current?.focus()}
        >
            {tags.map((tag, index) => (
                <span key={`${tag}-${index}`} className="dreact-tag">
                    {tag}
                    {disabled ? null : (
                        <button
                            type="button"
                            className="dreact-tag-remove"
                            aria-label={`Remove ${tag}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                removeTag(index);
                            }}
                        >
                            ×
                        </button>
                    )}
                </span>
            ))}
            <input
                ref={inputRef}
                id={id}
                name={name}
                type="text"
                className="dreact-tag-draft"
                value={draft}
                disabled={disabled}
                maxLength={maxTagLength || undefined}
                placeholder={tags.length === 0 ? placeholder : undefined}
                aria-label={atLimit ? `Tag limit of ${maxTags} reached` : undefined}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onBlur={onBlur}
            />
        </div>
    );
}
