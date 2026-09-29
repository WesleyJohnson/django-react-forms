import { defineConfig } from 'vite';

// Builds into the Django app's static folder
export default defineConfig({
    build: {
        outDir: '../demo/static/demo',
        emptyOutDir: false,
        lib: { entry: 'src/main.tsx', formats: ['es'], fileName: () => 'app.js' },
    },
    define: { 'process.env.NODE_ENV': '"production"' },
});
