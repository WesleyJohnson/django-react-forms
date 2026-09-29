import { afterEach, describe, expect, it } from 'vitest';
import { getCsrfToken } from '@/csrf';

const clear = (name: string) => (document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`);

describe('getCsrfToken', () => {
    afterEach(() => {
        clear('csrftoken');
        clear('other');
    });

    it('returns undefined when there is no cookie', () => {
        expect(getCsrfToken()).toBeUndefined();
    });

    it('reads the csrftoken cookie among others', () => {
        document.cookie = 'other=1';
        document.cookie = 'csrftoken=abc123';
        expect(getCsrfToken()).toBe('abc123');
    });

    it('picks up a token that changes after first read', () => {
        document.cookie = 'csrftoken=first';
        expect(getCsrfToken()).toBe('first');
        document.cookie = 'csrftoken=second';
        expect(getCsrfToken()).toBe('second');
    });

    it('does not match a cookie whose name merely ends with csrftoken', () => {
        document.cookie = 'not_csrftoken=nope';
        expect(getCsrfToken()).toBeUndefined();
        clear('not_csrftoken');
    });

    it('supports a custom cookie name', () => {
        document.cookie = 'other=xyz';
        expect(getCsrfToken('other')).toBe('xyz');
    });
});
