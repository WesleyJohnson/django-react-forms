import { registerCore } from './setup';

registerCore();

export { ReactForm } from './components/react-form';
export type { Notification, ReactFormProps } from './components/react-form';
export { mountAll, mountOnReady, unmountAll } from './mount';
export {
    getComponent,
    getSlot,
    getWidget,
    registerComponent,
    registerSlot,
    registerWidget,
} from './registry';
export type { SlotProps, WidgetBehavior, WidgetProps } from './registry';
export { registerAdapter } from './telepath';
export { Bridge } from './bridge';
export { ChoiceDef, FieldDef, FormDef, WidgetDef } from './adapters';
export { evaluateCondition } from './conditions';
export type { FieldCondition } from './conditions';
export { configure } from './configure';
export type { FormDefaults } from './configure';
export { getCsrfToken } from './csrf';
export { defaultMessages, setDefaultMessages } from './messages';
export type { Messages, PartialMessages } from './messages';
export { parseTags } from './components/tag-input';
