/**
 * A condition rule that controls whether a field is visible. Keys use Django-style
 * double-underscore operators (``fee_type__in``, ``fee_type__eq``); several keys are ANDed.
 * Fields without a condition are always visible.
 */
export type FieldCondition = Record<string, string | string[]>;

/**
 * Whether a field with this condition is visible, given the form's current values.
 *
 * Unknown operators and malformed keys fail open (visible). Comparison is strict, so a number or
 * boolean never equals a string. The server evaluates the same rules for the same cases
 * (``django_react_forms.conditions``); ``python/tests/fixtures/condition-cases.json`` is shared by
 * both test suites so the two sides always agree.
 *
 * @param watchedValues current form values, keyed by (prefixed) field name
 * @param prefix the form's field-name prefix, if any
 */
export function evaluateCondition(
    condition: FieldCondition,
    watchedValues: Record<string, any>,
    prefix: string | null | undefined,
): boolean {
    return Object.entries(condition).every(([key, value]) => {
        const separatorIdx = key.lastIndexOf('__');
        if (separatorIdx === -1) return true; // malformed key: fail open
        const fieldName = key.substring(0, separatorIdx);
        const operator = key.substring(separatorIdx + 2);
        const lookupKey = prefix ? `${prefix}-${fieldName}` : fieldName;
        const watchedValue = watchedValues[lookupKey];
        switch (operator) {
            case 'in':
                return Array.isArray(value) && value.includes(watchedValue);
            case 'eq':
                return watchedValue === value;
            default:
                return true; // unknown operator: fail open
        }
    });
}
