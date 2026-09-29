import type { ComponentType, CSSProperties, ReactNode, Ref } from 'react';
import type { ChoiceDef, FieldDef } from './adapters';

/** What every widget component receives. Extra ``props`` from the Python widget are spread in. */
export interface WidgetProps {
    id: string;
    name: string;
    value: any;
    onChange: (value: any) => void;
    onBlur?: () => void;
    disabled?: boolean;
    readOnly?: boolean;
    placeholder?: string;
    className?: string;
    style?: CSSProperties;
    choices: ChoiceDef[];
    field: FieldDef;
    invalid?: boolean;
    describedBy?: string;
    inputRef?: Ref<any>;
    [extra: string]: any;
}

/** Layout pieces you can swap to match a design system. */
export interface SlotProps {
    /** Wraps one field: label, help text, the control, and the error message. */
    Field: { field: FieldDef; id: string; error?: string; children: ReactNode };
    /** Wraps a group of fields (``field_groups``). */
    Fieldset: { name: string; children: ReactNode };
    /** A form-level error (``__all__`` or ``error`` from the server). */
    FormError: { message: string };
    /** The submit button. */
    SubmitButton: {
        label: string;
        disabled: boolean;
        hidden: boolean;
        loading: boolean;
        buttonRef?: Ref<HTMLButtonElement>;
    };
}

/** Optional extras a widget can register to own how its value is created and read. */
export interface WidgetBehavior {
    /** The form's initial value for a field drawn by this widget (default: coerced by field type). */
    defaultValue?: (field: FieldDef) => any;
}

const components = new Map<string, ComponentType<any>>();
const widgets = new Map<string, ComponentType<WidgetProps>>();
const behaviors = new Map<string, WidgetBehavior>();
const slots = new Map<string, ComponentType<any>>();

/** Register a component the server can mount by name (``component = 'ReactForm'``). */
export function registerComponent(name: string, component: ComponentType<any>): void {
    components.set(name, component);
}
export function getComponent(name: string): ComponentType<any> | undefined {
    return components.get(name);
}

/**
 * Register the component that draws a widget. The key is the Django widget class name
 * (``'Select'``, ``'TextInput'``, ...) or, for a ``ReactComponentWidget``, its ``component`` key.
 * Registering an existing key replaces it.
 */
export function registerWidget(
    name: string,
    component: ComponentType<WidgetProps>,
    behavior?: WidgetBehavior,
): void {
    widgets.set(name, component);
    if (behavior) behaviors.set(name, behavior);
}
export function getWidget(name: string): ComponentType<WidgetProps> | undefined {
    return widgets.get(name);
}
export function getWidgetBehavior(name: string): WidgetBehavior | undefined {
    return behaviors.get(name);
}

/** Replace one of the layout pieces in {@link SlotProps}. */
export function registerSlot<K extends keyof SlotProps>(
    name: K,
    component: ComponentType<SlotProps[K]>,
): void {
    slots.set(name, component);
}
export function getSlot<K extends keyof SlotProps>(name: K): ComponentType<SlotProps[K]> {
    return slots.get(name) as ComponentType<SlotProps[K]>;
}
