import type { ReactFormProps } from './components/react-form';

/** Props that can be set for every form, since the server can only send data, not functions. */
export type FormDefaults = Pick<
    ReactFormProps,
    'notify' | 'onSuccess' | 'onError' | 'redirectDelay' | 'csrfCookieName'
>;

let defaults: FormDefaults = {};

/**
 * Set behavior for every form on the page: show notices with ``notify``, decide what happens after
 * a save with ``onSuccess``, and so on. A prop given to a specific ``ReactForm`` wins.
 */
export function configure(next: FormDefaults): void {
    defaults = { ...defaults, ...next };
}

export function getFormDefaults(): FormDefaults {
    return defaults;
}
