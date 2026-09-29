/**
 * A rich-text value: Quill's delta (its document model) and the html it renders to. This is what
 * ``django-quill-editor`` stores, and what the server sends for a saved field.
 */
export class QuillValue {
    delta: any;
    html: string;

    constructor(data: { delta: any; html: string }) {
        let delta = data.delta;
        if (typeof delta === 'string') {
            if (delta) {
                try {
                    delta = JSON.parse(delta);
                } catch {
                    console.error(`Failed to parse quill data: ${delta}`);
                    delta = '';
                }
            } else {
                delta = '';
            }
        }
        this.delta = delta;
        this.html = data.html;
    }

    /** The delta double-encoded as a string, the way django-quill stores it. */
    toString() {
        return JSON.stringify({ delta: JSON.stringify(this.delta), html: this.html });
    }

    /** JSON and multipart bodies send the same shape: the delta as an object. */
    toJSON() {
        return { delta: this.delta, html: this.html };
    }
}

/** A field's starting value as ``{delta, html}``: parses a JSON string, defaults to empty. */
export function initialRichTextValue(value: unknown): { delta: any; html: string } {
    const empty = { delta: '', html: '' };
    const isValue = (candidate: unknown): candidate is { delta: any; html: string } =>
        !!candidate && typeof candidate === 'object' && !Array.isArray(candidate);
    if (typeof value === 'string' && value) {
        try {
            const parsed = JSON.parse(value);
            return isValue(parsed) ? parsed : empty;
        } catch {
            return empty;
        }
    }
    return isValue(value) ? value : empty;
}
