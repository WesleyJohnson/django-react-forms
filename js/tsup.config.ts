import { defineConfig } from 'tsup';

export default defineConfig({
    entry: { index: 'src/index.ts', quill: 'src/quill/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom', 'react-hook-form', 'quill', 'telepath-unpack'],
});
