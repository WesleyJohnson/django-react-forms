import { registerSlot, type SlotProps } from '../registry';
import { useMessages } from '../messages-context';

function DefaultField({ field, id, error, children }: SlotProps['Field']) {
    const messages = useMessages();
    return (
        <div className="dreact-field" data-field={field.name}>
            <label id={`${id}-label`} htmlFor={id} className="dreact-label">
                {field.label}
                {field.required ? null : <span className="dreact-optional"> {messages.optional}</span>}
            </label>
            {field.help_text ? (
                <p id={`${id}-help`} className="dreact-help">
                    {field.help_text}
                </p>
            ) : null}
            {children}
            {error ? (
                <p id={`${id}-error`} role="alert" className="dreact-error">
                    {error}
                </p>
            ) : null}
        </div>
    );
}

function DefaultFieldset({ name, children }: SlotProps['Fieldset']) {
    return (
        <fieldset className="dreact-fieldset">
            <legend>{name}</legend>
            {children}
        </fieldset>
    );
}

function DefaultFormError({ message }: SlotProps['FormError']) {
    return (
        <p role="alert" className="dreact-form-error">
            {message}
        </p>
    );
}

function DefaultSubmitButton({ label, disabled, hidden, loading, buttonRef }: SlotProps['SubmitButton']) {
    return (
        <button
            ref={buttonRef}
            type="submit"
            className="dreact-submit"
            disabled={disabled || loading}
            aria-busy={loading}
            style={{ display: hidden ? 'none' : undefined }}
        >
            {label}
        </button>
    );
}

export function registerDefaultSlots(): void {
    registerSlot('Field', DefaultField);
    registerSlot('Fieldset', DefaultFieldset);
    registerSlot('FormError', DefaultFormError);
    registerSlot('SubmitButton', DefaultSubmitButton);
}
