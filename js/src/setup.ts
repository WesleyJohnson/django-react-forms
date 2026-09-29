import { Bridge } from './bridge';
import { Choice, ChoiceList, FieldDef, FormDef, WidgetDef } from './adapters';
import { registerDefaultSlots } from './components/slots';
import { registerDefaultWidgets } from './components/widgets';
import { ReactForm } from './components/react-form';
import { registerComponent } from './registry';
import { registerAdapter } from './telepath';

/** Names the Python adapters send (``js_constructor``), and what builds each one. */
export function registerCore(): void {
    registerAdapter('dreact.Bridge', Bridge);
    registerAdapter('dreact.Form', FormDef);
    registerAdapter('dreact.FormField', FieldDef);
    registerAdapter('dreact.Widget', WidgetDef);
    registerAdapter('dreact.ChoiceList', ChoiceList);
    registerAdapter('dreact.Choice', Choice);
    // Dates, decimals, UUIDs and file URLs arrive as text; FieldDef reads them back with String()
    registerAdapter('dreact.String', String);

    registerComponent('ReactForm', ReactForm);
    registerDefaultSlots();
    registerDefaultWidgets();
}
