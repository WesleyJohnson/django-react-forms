import type { ReactNode } from 'react';
import type { SlotProps } from 'django-react-forms';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function FieldError({ id, error }: { id: string; error?: string }) {
    return error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
            {error}
        </p>
    ) : null;
}

/** A boolean is a bordered row: label and help on the left, the switch on the right. */
function SwitchRow({ field, id, error, children }: SlotProps['Field']) {
    return (
        <div className="space-y-2" data-field={field.name}>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-0.5">
                    <Label htmlFor={id} id={`${id}-label`}>
                        {field.label}
                    </Label>
                    {field.help_text ? (
                        <p id={`${id}-help`} className="text-sm text-muted-foreground">
                            {field.help_text}
                        </p>
                    ) : null}
                </div>
                {children}
            </div>
            <FieldError id={id} error={error} />
        </div>
    );
}

function Field(props: SlotProps['Field']) {
    const { field, id, error, children } = props;
    if (field.widget.name === 'CheckboxInput') return <SwitchRow {...props} />;
    return (
        <div className="space-y-2" data-field={field.name}>
            <Label id={`${id}-label`} htmlFor={id} className={cn(error && 'text-destructive')}>
                {field.label}
                {field.required ? null : <span className="ml-2 text-xs font-normal text-muted-foreground">optional</span>}
            </Label>
            {field.help_text ? (
                <p id={`${id}-help`} className="text-sm text-muted-foreground">
                    {field.help_text}
                </p>
            ) : null}
            {children}
            <FieldError id={id} error={error} />
        </div>
    );
}

function Fieldset({ name, children }: { name: string; children: ReactNode }) {
    return (
        <fieldset className="space-y-4 rounded-lg border p-4">
            <legend className="px-2 text-sm font-semibold">{name}</legend>
            {children}
        </fieldset>
    );
}

function FormError({ message }: SlotProps['FormError']) {
    return (
        <p role="alert" className="rounded-md border border-destructive/50 px-3 py-2 text-sm font-medium text-destructive">
            {message}
        </p>
    );
}

function SubmitButton({ label, disabled, hidden, loading, buttonRef }: SlotProps['SubmitButton']) {
    return (
        <Button ref={buttonRef} type="submit" disabled={disabled || loading} className={cn(hidden && 'hidden')}>
            {loading ? 'Saving...' : label}
        </Button>
    );
}

export const slots = { Field, Fieldset, FormError, SubmitButton };
