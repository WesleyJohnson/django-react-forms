import { registerWidget } from '../registry';
import { registerAdapter } from '../telepath';
import { RichTextWidget } from './rich-text';
import { QuillValue, initialRichTextValue } from './quill-value';

// Importing this entry point turns Quill support on: the server's `QuillValue` unpacks, and the
// `QuillWidget` (django-quill-editor's widget) is drawn by the editor.
registerAdapter('dreact.QuillValue', QuillValue);
registerWidget('QuillWidget', RichTextWidget, {
    defaultValue: (field) => initialRichTextValue(field.value),
});

export { RichTextWidget, QuillValue, initialRichTextValue };
export { configureQuill } from './config';
export type { QuillConfig } from './config';
