// vitest.setup.ts

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest'; // Use the vitest-specific extension
import { loadEnvConfig } from '@next/env';
import { vi } from 'vitest';

// 1. Load environment variables first.
// This ensures process.env is populated before any of your app code runs.
loadEnvConfig(process.cwd());

// 2. Run React Testing Library's cleanup function after each test.
// This unmounts components and prevents memory leaks between tests.
afterEach(() => {
  cleanup();
});

// 3. Mock global APIs that are not available in JSDOM, like `fetch`.
// This prevents any component that makes a network request from hanging.
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data: {} }),
  })
) as any;

// 4. Mock Next.js-specific modules like the router.
// This prevents errors when testing components that use these hooks.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({}),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '/',
}));

// --- Note on the `expect is not defined` error ---
// The previous error was fixed by adding `globals: true` to `vitest.config.ts`.
// The import for `@testing-library/jest-dom/vitest` is now correct because
// it will run in an environment where `expect` has been globally defined.
