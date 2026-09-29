import type { FieldCondition } from './conditions';
import { type Messages, getDefaultMessages } from './messages';

/** One option of a choice field. Built from ``[value, label]`` pairs or ``{value, label, ...}``. */
export class ChoiceDef {
    value: string | number;
    label: string;
    group: string;
    description: string;

    constructor(value: string | number, label: string, group?: string, description?: string) {
        this.value = value;
        this.label = label;
        this.group = group || '';
        this.description = description || '';
    }
}

/** A Django widget as the client sees it: its class name plus any component/props override. */
export class WidgetDef {
    name: string;
    component: string | null;
    props: Record<string, any>;
    cls: string;
    style: string;
    placeholder: string;

    constructor(
        name: string,
        component: string | null,
        props: Record<string, any>,
        cls: string,
        style: string,
        placeholder: string,
    ) {
        this.name = name;
        this.component = component;
        this.props = props || {};
        this.cls = cls;
        this.style = style;
        this.placeholder = placeholder;
    }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

/** Whether a value is a rich-text ``{delta, html}`` pair (a stored value, or one being edited). */
export function isRichTextValue(value: unknown): value is { delta: unknown; html: unknown } {
    return (
        typeof value === 'object' &&
        value !== null &&
        !(typeof File !== 'undefined' && value instanceof File) &&
        'delta' in value &&
        'html' in value
    );
}

/** A form field: what Django knows about it, ready for the client to draw. */
export class FieldDef {
    name: string;
    value: any;
    widget: WidgetDef;
    field_type: string;
    label: string;
    required: boolean;
    disabled: boolean;
    readonly: boolean;
    help_text: string;
    max_length: number | null;
    min_length: number | null;
    empty_value: any;
    choices: ChoiceDef[];
    condition: FieldCondition | null;

    constructor(field: any) {
        this.name = field.name;
        if (
            Array.isArray(field.value) ||
            isPlainObject(field.value) ||
            isRichTextValue(field.value) ||
            field.field_type === 'QuillFormField'
        ) {
            // Lists (ModelMultipleChoiceField pks), plain objects (an existing file's {name, url})
            // and rich text keep their shape: String() would give "1,2" and "[object Object]"
            this.value = field.value === undefined || field.value === null ? '' : field.value;
        } else {
            this.value = field.value === undefined || field.value === null ? '' : String(field.value);
        }
        this.widget = field.widget;
        this.field_type = field.field_type;
        this.label = field.label;
        this.required = field.required;
        this.disabled = field.disabled;
        this.readonly = field.readonly;
        this.help_text = field.help_text;
        this.max_length = field.max_length;
        this.min_length = field.min_length;
        this.empty_value = field.empty_value;
        this.choices = (field.choices || []).map(
            (choice: unknown[] | ChoiceDef | Record<string, any>): ChoiceDef => {
                if (choice instanceof ChoiceDef) return choice;
                if (Array.isArray(choice)) return new ChoiceDef(choice[0], choice[1], choice[2]);
                return new ChoiceDef(choice.value, choice.label, choice.group, choice.description);
            },
        );
        this.condition = field.condition || null;
    }
}

interface FieldGroup {
    name: string;
    fields: string[];
}

/** A whole form: its fields, where to post it, and how to lay it out. */
export class FormDef {
    fields: FieldDef[];
    fetchUrl: string;
    prefix: string | null;
    fieldGroups: FieldGroup[] | null;
    disabled: boolean;

    constructor(
        fields: FieldDef[],
        fetchUrl: string,
        prefix: string | null,
        fieldGroups: FieldGroup[] | null,
        disabled: boolean,
    ) {
        this.fields = fields;
        this.fetchUrl = fetchUrl;
        this.prefix = prefix;
        this.fieldGroups = fieldGroups;
        this.disabled = disabled;
    }
}

/** ``new`` of these is how Telepath builds the lists the server sends. */
export function ChoiceList(...items: unknown[]) {
    return items;
}
export function Choice(value: string, label: string) {
    return [value, label];
}

export interface RHFRules {
    required?: boolean | string;
    minLength?: { value: number; message: string };
    maxLength?: { value: number; message: string };
    pattern?: { value: RegExp; message: string };
    validate?: (value: any) => boolean | string;
}

const TEXT_FIELDS = ['CharField', 'TextField', 'PasswordField', 'EmailField', 'URLField'];

/**
 * Lightweight client-side validation rules for a field. The server stays the source of truth;
 * these only save a round trip for the obvious cases.
 */
export function buildRHFRules(field: FieldDef, messages: Messages = getDefaultMessages()): RHFRules {
    const rules: RHFRules = {};
    const { field_type, label, required, min_length, max_length } = field;
    const v = messages.validation;
    const isMultiple = field_type === 'MultipleChoiceField' || field.widget.name === 'CheckboxSelectMultiple';

    if (required) {
        if (field_type === 'BooleanField') {
            // A boolean is either true or false; the server decides whether "unchecked" is allowed
        } else if (isMultiple) {
            const message = v.required(label);
            rules.required = message;
            rules.validate = (value: any) => (!Array.isArray(value) || value.length === 0 ? message : true);
        } else {
            rules.required = v.required(label);
        }
    }

    if (min_length && TEXT_FIELDS.includes(field_type)) {
        rules.minLength = { value: min_length, message: v.minLength(label, min_length) };
    }
    if (max_length && TEXT_FIELDS.includes(field_type)) {
        rules.maxLength = { value: max_length, message: v.maxLength(label, max_length) };
    }

    if (['IntegerField', 'FloatField', 'DecimalField'].includes(field_type)) {
        rules.validate = (value: any) => {
            if (value === '' || value === null || value === undefined) return true; // see `required`
            const num = Number(value);
            if (isNaN(num)) return v.number(label);
            if (field_type === 'IntegerField' && !Number.isInteger(num)) return v.integer(label);
            return true;
        };
    }

    if (field_type === 'EmailField') {
        rules.pattern = { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: v.email };
    }
    if (field_type === 'URLField') {
        rules.pattern = { value: /^(https?:\/\/).+/i, message: v.url };
    }

    // Choice fields: only check the type, not membership - the server knows the (possibly
    // dynamic) choices
    if (['ChoiceField', 'TypedChoiceField', 'ModelChoiceField'].includes(field_type) && !required) {
        if (!rules.validate) {
            rules.validate = (value: any) => {
                if (value === '' || value === null || value === undefined) return true;
                return typeof value === 'string' ? true : v.chooseOne;
            };
        }
    }

    if (isMultiple) {
        const existing = rules.validate;
        rules.validate = (value: any) => {
            if (existing) {
                const result = existing(value);
                if (result !== true) return result;
            }
            return Array.isArray(value) ? true : v.chooseMany;
        };
    }

    return rules;
}

export function buildRHFValidationRules(
    fields: FieldDef[],
    messages: Messages = getDefaultMessages(),
): Record<string, RHFRules> {
    return Object.fromEntries(fields.map((field) => [field.name, buildRHFRules(field, messages)]));
}
