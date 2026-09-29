import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { registerCore } from '@/setup';

// The package entry point does this on import; tests that import pieces directly need it too
registerCore();

afterEach(() => {
    cleanup();
});
