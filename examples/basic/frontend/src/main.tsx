import { configure, mountOnReady } from 'django-react-forms';
import 'django-react-forms/quill'; // rich text, for the course form
import 'django-react-forms/styles.css';
import 'quill/dist/quill.snow.css';

// The library never draws notices itself; show them however you like
configure({
    notify: ({ title, description, variant }) => {
        const status = document.getElementById('status');
        if (!status) return;
        status.textContent = [title, description].filter(Boolean).join(' - ');
        status.dataset.variant = variant;
    },
});

mountOnReady();
