import { type ReactNode, type Ref, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
    type FieldDef,
    type FormDef,
    buildRHFValidationRules,
    isPlainObject,
    isRichTextValue,
} from '../adapters';
import { evaluateCondition } from '../conditions';
import { getFormDefaults } from '../configure';
import { getCsrfToken } from '../csrf';
import { styleFromString } from '../css';
import { MessagesContext } from '../messages-context';
import { type PartialMessages, getDefaultMessages, mergeMessages } from '../messages';
import { getSlot, getWidget, getWidgetBehavior, type WidgetProps } from '../registry';

export interface Notification {
    title: string;
    description?: string;
    variant: 'success' | 'error';
}

export interface ReactFormProps {
    /** The form to draw (what the server sends). */
    form: FormDef;
    /** Hide the built-in submit button, e.g. when a dialog supplies its own and clicks ``submitRef``. */
    hideSubmit?: boolean;
    /** Called with the submitted values (and the server's JSON reply) after a successful save. */
    onSuccess?: (values: Record<string, any>, response?: any) => void;
    /** Called when validation or the request fails. */
    onError?: () => void;
    /** Called (debounced) as the user edits. */
    onFormChange?: (values: Record<string, any>) => void;
    /** Ref to the submit button, so a wrapper can trigger a submit. */
    submitRef?: Ref<HTMLButtonElement>;
    /** Don't post; hand the values to ``onSuccess`` instead. */
    preventSubmission?: boolean;
    /** Replace the form's values (e.g. when a parent loads a record). */
    overrideValues?: Record<string, any>;
    /** Post here instead of ``form.fetchUrl``. */
    overrideFetchUrl?: string;
    /** Show a toast or banner. The library never renders notifications itself. */
    notify?: (notification: Notification) => void;
    /** Reword or translate any text the library shows. */
    messages?: PartialMessages;
    /** Name of the cookie holding Django's CSRF token (default ``csrftoken``). */
    csrfCookieName?: string;
    /** After a save with no ``onSuccess``, wait this long before following a ``redirect``. */
    redirectDelay?: number;
    className?: string;
}

/** Which registered widget draws a field: its ``component`` key if it names one, else its class. */
function widgetKey(field: FieldDef): string {
    return field.widget.component || field.widget.name;
}

/** Initial react-hook-form values, coerced from the (mostly string) Telepath field values. */
function buildDefaultValues(fields: FieldDef[]): Record<string, any> {
    const defaults: Record<string, any> = {};
    for (const field of fields) {
        const behavior = getWidgetBehavior(widgetKey(field));
        if (behavior?.defaultValue) {
            defaults[field.name] = behavior.defaultValue(field);
        } else if (field.field_type === 'IntegerField' || field.field_type === 'FloatField') {
            const text = typeof field.value === 'string' ? field.value : String(field.value || '');
            defaults[field.name] = text === '' ? '' : Number(text);
        } else if (field.field_type === 'BooleanField') {
            const text = typeof field.value === 'string' ? field.value : String(field.value || '');
            defaults[field.name] = text === '' ? false : text === 'true';
        } else {
            defaults[field.name] = field.value;
        }
    }
    return defaults;
}

/** Props left undefined don't override a configured default. */
function definedOnly<T extends object>(props: T): Partial<T> {
    return Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function UnsupportedWidget({ name, message }: { name: string; message: string }) {
    useEffect(() => {
        console.error(`ReactForm has no component for the "${name}" widget`);
    }, [name]);
    return (
        <p role="alert" className="dreact-error">
            {message}
        </p>
    );
}

export function ReactForm(givenProps: ReactFormProps) {
    const props: ReactFormProps = { ...getFormDefaults(), ...definedOnly(givenProps) } as ReactFormProps;
    const {
        form: formDef,
        hideSubmit = false,
        onSuccess,
        onError,
        onFormChange,
        submitRef,
        preventSubmission = false,
        overrideValues,
        overrideFetchUrl,
        notify,
        csrfCookieName,
        redirectDelay = 0,
        className,
    } = props;

    const messages = useMemo(() => mergeMessages(getDefaultMessages(), props.messages), [props.messages]);
    const formId = `dreact-${useId().replace(/:/g, '')}`;
    const [isLoading, setIsLoading] = useState(false);

    const { fields: formFields, fieldGroups, prefix } = formDef;
    const fetchUrl = overrideFetchUrl || formDef.fetchUrl;
    const validationRules = useMemo(
        () => buildRHFValidationRules(formFields, messages),
        [formFields, messages],
    );

    const form = useForm<Record<string, any>>({
        shouldFocusError: true,
        mode: 'onChange',
        shouldUnregister: false,
        defaultValues: buildDefaultValues(formFields),
    });
    const watchedValues = useWatch({ control: form.control });

    // Track whether a values change came from the user, so onFormChange isn't fired for the
    // initial render or for a programmatic reset
    const isFirstRender = useRef(true);
    const isFormReset = useRef(false);

    const resetTo = useCallback(
        (values: Record<string, any>) => {
            isFormReset.current = true;
            form.reset(values);
            setTimeout(() => {
                isFormReset.current = false;
            }, 100);
        },
        [form],
    );

    useEffect(() => {
        resetTo(buildDefaultValues(formFields));
    }, [formFields, resetTo]);

    useEffect(() => {
        if (overrideValues && Object.keys(overrideValues).length > 0) {
            resetTo(overrideValues);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [overrideValues]);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (isFormReset.current || !onFormChange) {
            return;
        }
        const timeoutId = setTimeout(() => onFormChange(watchedValues), 500);
        return () => clearTimeout(timeoutId);
    }, [watchedValues, onFormChange]);

    const send = (notification: Notification) => notify?.(notification);

    function onFormError() {
        send({
            title: messages.notifications.reviewForm,
            description: messages.notifications.reviewFormDescription,
            variant: 'error',
        });
        onError?.();
    }

    /** Fields hidden by a condition are irrelevant, so they aren't submitted (the server ignores them too). */
    function withoutHiddenFields(allValues: Record<string, any>): Record<string, any> {
        const hidden = new Set(
            formFields
                .filter((f) => f.condition && !evaluateCondition(f.condition, allValues, prefix))
                .map((f) => f.name),
        );
        return Object.fromEntries(Object.entries(allValues).filter(([name]) => !hidden.has(name)));
    }

    function buildBody(values: Record<string, any>): { body: BodyInit; headers: Record<string, string> } {
        const headers: Record<string, string> = {
            Accept: 'application/json',
            'X-CSRFToken': getCsrfToken(csrfCookieName) ?? '',
        };
        const hasFiles = formFields.some((f) => ['FileInput', 'ClearableFileInput'].includes(f.widget.name));
        if (!hasFiles) {
            headers['Content-Type'] = 'application/json';
            return { body: JSON.stringify(values), headers };
        }

        // Multipart: the browser sets the content type (and its boundary)
        const jsonEncoded = new Set(
            formFields.filter((f) => f.widget.name === 'TagInput').map((f) => f.name),
        );
        const fileFields = new Set(
            formFields
                .filter((f) => ['FileInput', 'ClearableFileInput'].includes(f.widget.name))
                .map((f) => f.name),
        );

        const formData = new FormData();
        for (const [key, value] of Object.entries(values)) {
            if (fileFields.has(key) && !(value instanceof File)) {
                // A file field only ever sends a file; an untouched one has nothing to upload
                continue;
            }
            if (isRichTextValue(value)) {
                // The same {delta, html} shape a JSON body sends
                formData.append(key, JSON.stringify(value));
            } else if (value instanceof File) {
                formData.append(key, value);
            } else if (jsonEncoded.has(key)) {
                // String(array) would comma-join; TagField parses a JSON-encoded list
                formData.append(key, JSON.stringify(value));
            } else if (Array.isArray(value)) {
                // One entry per selection, which is what Django's getlist() reads
                value.forEach((item) => formData.append(key, String(item)));
            } else if (isPlainObject(value)) {
                // An existing file's {name, url}: nothing to upload, and Django keeps the file
            } else if (value !== null && value !== undefined) {
                formData.append(key, String(value));
            }
        }
        return { body: formData, headers };
    }

    async function applyServerErrors(response: Response) {
        const { errors, error } = (await response.json()) as {
            errors?: Record<string, string[] | string>;
            error?: string;
        };
        let isFirst = true;
        for (const [key, value] of Object.entries(errors ?? {})) {
            form.setError(
                key === '__all__' ? 'root' : key,
                { type: 'custom', message: Array.isArray(value) ? value.join(', ') : value },
                { shouldFocus: isFirst },
            );
            isFirst = false;
        }
        if (error) {
            form.setError('root', { type: 'custom', message: error });
        }
        onFormError();
    }

    async function onFormSubmit(allValues: Record<string, any>) {
        const values = withoutHiddenFields(allValues);

        if (preventSubmission) {
            onSuccess?.(values);
            return;
        }

        setIsLoading(true);
        try {
            const { body, headers } = buildBody(values);
            const response = await fetch(fetchUrl, {
                credentials: 'include',
                method: 'POST',
                mode: 'same-origin',
                headers,
                body,
            });

            if (response.ok) {
                const json = await response.json();
                if (json.data) {
                    for (const [key, value] of Object.entries(json.data)) {
                        form.setValue(key, value);
                    }
                }
                send({
                    title: messages.notifications.saved,
                    description: json.message || messages.notifications.savedDescription,
                    variant: 'success',
                });
                if (onSuccess) {
                    onSuccess(values, json);
                } else if (json.redirect) {
                    setTimeout(() => window.location.assign(json.redirect), redirectDelay);
                }
            } else if (response.status === 400) {
                await applyServerErrors(response);
            } else {
                // 5xx, or another 4xx such as a CSRF failure
                throw new Error(response.statusText);
            }
        } catch (error) {
            console.error(error);
            send({
                title: messages.notifications.saveFailed,
                description: messages.notifications.saveFailedDescription,
                variant: 'error',
            });
            onError?.();
        } finally {
            setIsLoading(false);
        }
    }

    const Field = getSlot('Field');
    const Fieldset = getSlot('Fieldset');
    const FormError = getSlot('FormError');
    const SubmitButton = getSlot('SubmitButton');

    function renderField(field: FieldDef): ReactNode {
        if (field.condition && !evaluateCondition(field.condition, watchedValues, prefix)) {
            return null;
        }
        const key = widgetKey(field);
        const Widget = getWidget(key);
        const id = `${formId}-${field.name}`;

        return (
            <Controller
                key={field.name}
                control={form.control}
                name={field.name}
                disabled={!!field.disabled || isLoading}
                rules={validationRules[field.name]}
                render={({ field: control, fieldState }) => {
                    const error = fieldState.error?.message;
                    const describedBy =
                        [field.help_text ? `${id}-help` : '', error ? `${id}-error` : '']
                            .filter(Boolean)
                            .join(' ') || undefined;

                    const control_ = Widget ? (
                        <Widget
                            id={id}
                            name={control.name}
                            value={control.value}
                            onChange={control.onChange}
                            onBlur={control.onBlur}
                            disabled={control.disabled}
                            readOnly={field.readonly === true}
                            placeholder={field.widget.placeholder || undefined}
                            className={field.widget.cls || undefined}
                            style={styleFromString(field.widget.style)}
                            choices={field.choices}
                            field={field}
                            invalid={!!error}
                            describedBy={describedBy}
                            inputRef={control.ref}
                            {...field.widget.props}
                        />
                    ) : (
                        <UnsupportedWidget name={key} message={messages.unsupportedWidget(key)} />
                    );

                    if (field.widget.name === 'HiddenInput') return control_;
                    return (
                        <Field field={field} id={id} error={error}>
                            {control_}
                        </Field>
                    );
                }}
            />
        );
    }

    function renderFields(fields: FieldDef[]) {
        return <>{fields.map(renderField)}</>;
    }

    const rootError = form.formState.errors.root?.message;
    const grouped = fieldGroups && fieldGroups.length > 0;

    return (
        <MessagesContext.Provider value={messages}>
            <form
                id={formId}
                className={['dreact-form', className].filter(Boolean).join(' ')}
                noValidate
                onSubmit={(e) => {
                    if (preventSubmission) {
                        e.stopPropagation();
                    }
                    void form.handleSubmit(onFormSubmit, onFormError)(e);
                }}
            >
                {grouped ? (
                    <>
                        {fieldGroups.map((group) => (
                            <Fieldset key={group.name} name={group.name}>
                                {renderFields(formFields.filter((f) => group.fields.includes(f.name)))}
                            </Fieldset>
                        ))}
                        {/* A field no group lists is still drawn, so it can't vanish or leave an error nobody sees */}
                        {renderFields(
                            formFields.filter((f) => !fieldGroups.some((g) => g.fields.includes(f.name))),
                        )}
                    </>
                ) : (
                    renderFields(formFields)
                )}
                {rootError ? <FormError message={rootError} /> : null}
                <SubmitButton
                    label={messages.submit}
                    disabled={formDef.disabled}
                    hidden={hideSubmit}
                    loading={isLoading}
                    buttonRef={submitRef}
                />
            </form>
        </MessagesContext.Provider>
    );
}
