import { describe, expect, it } from 'vitest';
import { ChoiceDef, FieldDef, WidgetDef, buildRHFRules, buildRHFValidationRules } from '@/adapters';

function widget(name = 'TextInput'): WidgetDef {
    return new WidgetDef(name, null, {}, '', '', '');
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

describe('FieldDef', () => {
    it('coerces values to strings and null/undefined to empty string', () => {
        expect(field({ value: 42 }).value).toBe('42');
        expect(field({ value: null }).value).toBe('');
        expect(field({ value: undefined }).value).toBe('');
        expect(field({ value: false }).value).toBe('false');
    });

    it('keeps required as the boolean it was given (never a string)', () => {
        expect(field({ required: true }).required).toBe(true);
        expect(field({ required: false }).required).toBe(false);
    });

    it('keeps a plain-object value (an existing file) instead of "[object Object]"', () => {
        const existing = { name: 'logo.png', url: '/media/logo.png' };
        expect(field({ field_type: 'FileField', value: existing }).value).toEqual(existing);
    });

    it('still stringifies non-plain objects such as dates', () => {
        const day = new Date(2026, 0, 2);
        expect(field({ value: day }).value).toBe(String(day));
    });

    it('does not coerce Quill values, by field_type or by widget name', () => {
        const delta = { ops: [{ insert: 'hi' }] };
        const byType = field({ field_type: 'QuillFormField', value: { delta, html: '<p>hi</p>' } });
        expect(byType.value).toEqual({ delta, html: '<p>hi</p>' });

        const byWidget = field({ widget: widget('QuillWidget'), value: { delta, html: '' } });
        expect(byWidget.value).toEqual({ delta, html: '' });
    });

    it('defaults a missing Quill value to an empty string, not "null"', () => {
        expect(field({ field_type: 'QuillFormField', value: null }).value).toBe('');
    });

    it('normalizes choices from arrays, plain objects, and ChoiceDef instances', () => {
        const existing = new ChoiceDef('c', 'Gamma', 'Group', 'desc');
        const f = field({
            choices: [
                ['a', 'Alpha'],
                ['b', 'Beta', 'G1'],
                { value: 'd', label: 'Delta', description: 'x' },
                existing,
            ],
        });
        expect(f.choices).toHaveLength(4);
        expect(f.choices[0]).toMatchObject({ value: 'a', label: 'Alpha', group: '', description: '' });
        expect(f.choices[1]).toMatchObject({ value: 'b', label: 'Beta', group: 'G1' });
        expect(f.choices[2]).toMatchObject({ value: 'd', label: 'Delta', description: 'x' });
        expect(f.choices[3]).toBe(existing);
    });

    it('defaults choices to [] and condition to null', () => {
        const f = field();
        expect(f.choices).toEqual([]);
        expect(f.condition).toBeNull();
    });

    it('keeps a condition when provided', () => {
        const f = field({ condition: { fee_type__eq: 'paid' } });
        expect(f.condition).toEqual({ fee_type__eq: 'paid' });
    });
});

describe('buildRHFRules', () => {
    it('requires a value with a label-based message', () => {
        const rules = buildRHFRules(field({ required: true }));
        expect(rules.required).toBe('Title is required.');
    });

    it('does not add a required rule for BooleanField', () => {
        const rules = buildRHFRules(field({ required: true, field_type: 'BooleanField' }));
        expect(rules.required).toBeUndefined();
    });

    it('requires at least one item for multiple choice', () => {
        const rules = buildRHFRules(
            field({
                required: true,
                field_type: 'MultipleChoiceField',
                widget: widget('CheckboxSelectMultiple'),
            }),
        );
        expect(rules.validate!([])).toBe('Title is required.');
        expect(rules.validate!('not-an-array')).toBe('Title is required.');
        expect(rules.validate!(['a'])).toBe(true);
    });

    it('validates a non-required multiple choice is an array', () => {
        const rules = buildRHFRules(field({ field_type: 'MultipleChoiceField' }));
        expect(rules.validate!('nope')).toBe('Please select valid options.');
        expect(rules.validate!([])).toBe(true);
    });

    it.each(['CharField', 'TextField', 'PasswordField', 'EmailField', 'URLField'])(
        'applies min/max length to %s',
        (field_type) => {
            const rules = buildRHFRules(field({ field_type, min_length: 2, max_length: 5 }));
            expect(rules.minLength).toEqual({ value: 2, message: 'Title must be at least 2 characters.' });
            expect(rules.maxLength).toEqual({
                value: 5,
                message: 'Title must be no more than 5 characters.',
            });
        },
    );

    it('ignores min/max length on non-string fields', () => {
        const rules = buildRHFRules(field({ field_type: 'IntegerField', min_length: 2, max_length: 5 }));
        expect(rules.minLength).toBeUndefined();
        expect(rules.maxLength).toBeUndefined();
    });

    describe('numeric fields', () => {
        it('allows empty values (required is handled separately)', () => {
            const rules = buildRHFRules(field({ field_type: 'IntegerField' }));
            expect(rules.validate!('')).toBe(true);
            expect(rules.validate!(null)).toBe(true);
            expect(rules.validate!(undefined)).toBe(true);
        });

        it('rejects non-numbers', () => {
            const rules = buildRHFRules(field({ field_type: 'DecimalField' }));
            expect(rules.validate!('abc')).toBe('Title must be a number.');
            expect(rules.validate!('12.5')).toBe(true);
        });

        it('rejects fractions for IntegerField only', () => {
            const integer = buildRHFRules(field({ field_type: 'IntegerField' }));
            const decimal = buildRHFRules(field({ field_type: 'DecimalField' }));
            expect(integer.validate!('1.5')).toBe('Title must be a whole number.');
            expect(decimal.validate!('1.5')).toBe(true);
        });

        it('still applies the required rule alongside the numeric check', () => {
            const rules = buildRHFRules(field({ field_type: 'IntegerField', required: true }));
            expect(rules.required).toBe('Title is required.');
            expect(typeof rules.validate).toBe('function');
        });
    });

    it('adds an email pattern', () => {
        const { pattern } = buildRHFRules(field({ field_type: 'EmailField' }));
        expect(pattern!.value.test('a@b.co')).toBe(true);
        expect(pattern!.value.test('a@b')).toBe(false);
        expect(pattern!.value.test('a b@c.co')).toBe(false);
    });

    it('adds a URL pattern requiring http(s)', () => {
        const { pattern } = buildRHFRules(field({ field_type: 'URLField' }));
        expect(pattern!.value.test('https://example.com')).toBe(true);
        expect(pattern!.value.test('HTTP://example.com')).toBe(true);
        expect(pattern!.value.test('ftp://example.com')).toBe(false);
        expect(pattern!.value.test('example.com')).toBe(false);
    });

    it('leaves non-required choice fields open to dynamic values but rejects non-strings', () => {
        const rules = buildRHFRules(field({ field_type: 'ChoiceField' }));
        expect(rules.validate!('')).toBe(true);
        expect(rules.validate!('anything-not-in-choices')).toBe(true);
        expect(rules.validate!(5)).toBe('Please select a valid option.');
    });

    it('adds no rules to an optional plain text field', () => {
        expect(buildRHFRules(field())).toEqual({});
    });
});

describe('buildRHFValidationRules', () => {
    it('keys the rules by field name', () => {
        const rules = buildRHFValidationRules([
            field({ name: 'a', required: true }),
            field({ name: 'b', field_type: 'EmailField' }),
        ]);
        expect(Object.keys(rules)).toEqual(['a', 'b']);
        expect(rules.a.required).toBe('Title is required.');
        expect(rules.b.pattern).toBeDefined();
    });
});
