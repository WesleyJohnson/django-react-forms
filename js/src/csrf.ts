/**
 * Reads Django's CSRF token from a cookie (``csrftoken`` by default) at call time rather than at
 * mount, so a token rotated after the page loaded (e.g. on login) is still picked up.
 */
export function getCsrfToken(cookieName: string = 'csrftoken'): string | undefined {
    if (typeof document === 'undefined') {
        return undefined;
    }
    for (const part of document.cookie.split(';')) {
        const [name, ...rest] = part.trim().split('=');
        if (name === cookieName) {
            return decodeURIComponent(rest.join('='));
        }
    }
    return undefined;
}
