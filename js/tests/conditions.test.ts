import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '@/conditions';
// The Python suite runs these same cases against django_react_forms.conditions
import cases from '../../python/tests/fixtures/condition-cases.json';

describe('evaluateCondition (shared with the server)', () => {
    it.each(cases.cases)('$name', ({ condition, values, prefix, visible }: any) => {
        expect(evaluateCondition(condition, values, prefix ?? null)).toBe(visible);
    });
});
