import Quill from 'quill';
import { useEffect, useRef } from 'react';
import type { WidgetProps } from '../registry';
import { getQuillConfig } from './config';
import { QuillValue, initialRichTextValue } from './quill-value';

/**
 * The rich-text editor. Uncontrolled while the user types (Quill owns the document); it reloads
 * when the form sets a different value from outside, such as a reset. Import Quill's stylesheet
 * (``quill/dist/quill.snow.css``) yourself.
 */
export function RichTextWidget({
    id,
    value,
    onChange,
    disabled,
    invalid,
    describedBy,
    className,
    style,
}: WidgetProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const quillRef = useRef<Quill | null>(null);
    const onChangeRef = useRef(onChange);
    const lastEmitted = useRef<unknown>(value);
    onChangeRef.current = onChange;

    // Create the editor once
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const { toolbar, onImageUpload } = getQuillConfig();

        const editorElement = container.appendChild(container.ownerDocument.createElement('div'));
        const quill = new Quill(editorElement, {
            theme: 'snow',
            modules: {
                toolbar: {
                    container: toolbar,
                    handlers: onImageUpload
                        ? {
                              image: () => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = async () => {
                                      const file = input.files?.[0];
                                      if (!file) return;
                                      const url = await onImageUpload(file);
                                      const index = quill.getSelection(true)?.index ?? quill.getLength();
                                      quill.insertEmbed(index, 'image', url, 'user');
                                  };
                                  input.click();
                              },
                          }
                        : {},
                },
            },
        });
        quillRef.current = quill;

        const initial = initialRichTextValue(value);
        if (initial.delta) {
            quill.setContents(initial.delta);
        } else if (initial.html) {
            quill.clipboard.dangerouslyPasteHTML(initial.html);
        }
        quill.history.clear();

        quill.on(Quill.events.TEXT_CHANGE, (_delta, _old, source) => {
            if (source === 'silent') return;
            const next = new QuillValue({
                delta: JSON.stringify(quill.getContents()),
                html: quill.root.innerHTML,
            });
            lastEmitted.current = next;
            onChangeRef.current(next);
        });

        return () => {
            quillRef.current = null;
            container.innerHTML = '';
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // A value that didn't come from the editor (a form reset, say) replaces its contents
    useEffect(() => {
        const quill = quillRef.current;
        if (!quill || value === lastEmitted.current) return;
        lastEmitted.current = value;
        const next = initialRichTextValue(value);
        if (next.delta) {
            quill.setContents(next.delta, 'silent');
        } else {
            quill.setContents([], 'silent');
            if (next.html) quill.clipboard.dangerouslyPasteHTML(next.html, 'silent');
        }
    }, [value]);

    useEffect(() => {
        quillRef.current?.enable(!disabled);
    }, [disabled]);

    return (
        <div
            id={id}
            ref={containerRef}
            className={['dreact-rich-text', className].filter(Boolean).join(' ')}
            style={style}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
        />
    );
}
