/**
 * Every string the library shows or builds. Pass a partial override as ``messages`` to
 * ``ReactForm`` (or set it once with ``setDefaultMessages``) to translate or reword them.
 */
export interface Messages {
    submit: string;
    optional: string;
    currentFile: string;
    selectPlaceholder: string;
    unsupportedWidget: (widgetName: string) => string;
    unknownComponent: (name: string) => string;
    notifications: {
        saved: string;
        savedDescription: string;
        reviewForm: string;
        reviewFormDescription: string;
        saveFailed: string;
        saveFailedDescription: string;
    };
    validation: {
        required: (label: string) => string;
        minLength: (label: string, min: number) => string;
        maxLength: (label: string, max: number) => string;
        number: (label: string) => string;
        integer: (label: string) => string;
        email: string;
        url: string;
        chooseOne: string;
        chooseMany: string;
    };
}

export type PartialMessages = {
    [K in keyof Messages]?: Messages[K] extends (...args: any[]) => any
        ? Messages[K]
        : Messages[K] extends object
          ? Partial<Messages[K]>
          : Messages[K];
};

export const defaultMessages: Messages = {
    submit: 'Submit',
    optional: '(optional)',
    currentFile: 'Current file:',
    selectPlaceholder: 'Please select',
    unsupportedWidget: (name) => `This field can't be displayed (${name} isn't supported).`,
    unknownComponent: (name) => `Unknown component "${name}".`,
    notifications: {
        saved: 'Success!',
        savedDescription: 'Your changes have been saved.',
        reviewForm: 'Please review your form',
        reviewFormDescription: 'Some fields have errors. Please review and correct them before submitting.',
        saveFailed: 'Unable to save changes',
        saveFailedDescription: "We couldn't submit your form due to a technical issue. Please try again.",
    },
    validation: {
        required: (label) => `${label} is required.`,
        minLength: (label, min) => `${label} must be at least ${min} characters.`,
        maxLength: (label, max) => `${label} must be no more than ${max} characters.`,
        number: (label) => `${label} must be a number.`,
        integer: (label) => `${label} must be a whole number.`,
        email: 'Please enter a valid email address.',
        url: 'Please enter a valid URL.',
        chooseOne: 'Please select a valid option.',
        chooseMany: 'Please select valid options.',
    },
};

let globalMessages: Messages = defaultMessages;

/** Merge overrides onto the defaults (one level deep for the grouped messages). */
export function mergeMessages(base: Messages, overrides?: PartialMessages): Messages {
    if (!overrides) return base;
    return {
        ...base,
        ...(overrides as Partial<Messages>),
        notifications: { ...base.notifications, ...overrides.notifications },
        validation: { ...base.validation, ...overrides.validation },
    };
}

/** Set overrides for every form on the page, e.g. to translate the library once. */
export function setDefaultMessages(overrides: PartialMessages): void {
    globalMessages = mergeMessages(defaultMessages, overrides);
}

export function getDefaultMessages(): Messages {
    return globalMessages;
}
