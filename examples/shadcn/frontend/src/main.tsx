import { configure, mountOnReady, registerSlot, registerWidget, type SlotProps } from 'django-react-forms';
import 'django-react-forms/quill'; // rich text, for the course form
import 'quill/dist/quill.snow.css';

import './index.css';
import { slots } from './dreact/slots';
import { widgets } from './dreact/widgets';

// Draw each Django widget with a shadcn/ui component, and the layout around them
for (const [name, component] of Object.entries(widgets)) registerWidget(name, component);
for (const [name, component] of Object.entries(slots)) registerSlot(name as keyof SlotProps, component as never);

// The library never draws notices itself; show them however you like
configure({
    notify: ({ title, description, variant }) => {
        const status = document.getElementById('status');
        if (!status) return;
        status.textContent = [title, description].filter(Boolean).join(' - ');
        status.className =
            variant === 'error'
                ? 'rounded-md border border-destructive/50 px-3 py-2 text-sm font-medium text-destructive'
                : 'rounded-md border px-3 py-2 text-sm font-medium';
    },
});

mountOnReady();
