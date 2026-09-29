import type { CSSProperties } from 'react';

/** ``"width: 200px; margin-top: 4px"`` (a widget's ``style`` attribute) as a React style object. */
export function styleFromString(css: string | null | undefined): CSSProperties {
    const style: Record<string, string> = {};
    for (const declaration of (css || '').split(';')) {
        const separator = declaration.indexOf(':');
        if (separator === -1) continue;
        const property = declaration.slice(0, separator).trim();
        const value = declaration.slice(separator + 1).trim();
        if (!property || !value) continue;
        const key = property.startsWith('--')
            ? property
            : property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
        style[key] = value;
    }
    return style as CSSProperties;
}
