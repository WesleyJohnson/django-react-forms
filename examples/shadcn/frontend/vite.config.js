import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Builds into the Django demo's static folder, next to the basic example's bundle
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
        // The library is linked from a checkout here; share one copy of these with it
        dedupe: ['react', 'react-dom', 'react-hook-form', 'quill'],
    },
    build: {
        outDir: '../../basic/demo/static/demo',
        emptyOutDir: false,
        lib: { entry: 'src/main.tsx', formats: ['es'], fileName: () => 'shadcn.js' },
        rollupOptions: { output: { assetFileNames: 'shadcn[extname]' } },
    },
    define: { 'process.env.NODE_ENV': '"production"' },
});
