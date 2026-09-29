export interface QuillConfig {
    /** Quill toolbar container config. Defaults to headings, basic formats, lists and links. */
    toolbar?: unknown[];
    /**
     * Turns the toolbar's image button on: called with the chosen file, returns the URL to
     * embed. Without it there is no image button (a data: URL would bloat the stored html).
     */
    onImageUpload?: (file: File) => Promise<string>;
}

const defaultToolbar = [
    [{ header: [1, 2, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    ['link'],
    ['blockquote'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['clean'],
];

let config: QuillConfig = {};

/** Set once at startup, before the first form mounts. */
export function configureQuill(next: QuillConfig): void {
    config = next;
}

export function getQuillConfig(): Required<Pick<QuillConfig, 'toolbar'>> & QuillConfig {
    const toolbar = config.toolbar ?? [...defaultToolbar];
    if (config.onImageUpload && !config.toolbar) {
        toolbar.splice(2, 1, ['link', 'image']);
    }
    return { ...config, toolbar };
}
