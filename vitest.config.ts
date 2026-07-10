// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // This top-level setup is good, but we'll also be explicit in the project.
    setupFiles: ['./vitest.setup.ts'],
    
    projects: [
      {
        name: 'jsdom',
        // Projects don't inherit root plugins; without this, JSX in files that
        // don't explicitly import React fails with "React is not defined".
        esbuild: { jsx: 'automatic' },
        test: {
          environment: 'jsdom',
          include: ['components/**/*.test.{ts,tsx}', 'app/admin/**/*.test.{ts,tsx}', 'app/volzar/**/*.test.{ts,tsx}', 'app/*.test.{ts,tsx}', 'app/auth/**/*.test.{ts,tsx}'],
          // --- ADD THIS LINE ---
          // Explicitly declare the setup file for this project
          setupFiles: ['./vitest.setup.ts'], 
          alias: {
            '@': path.resolve(__dirname, './'),
            'crypto': 'uncrypto',
          },
        },
      },
      {
        name: 'node',
        test: {
          environment: 'node',
          include: ['security/**/*.test.ts', 'app/api/**/*.test.ts', 'app/discord-v2/**/*.test.ts', 'app/stores/**/*.test.ts', 'app/wants/**/*.test.ts', 'models/**/*.test.ts', 'lib/**/*.test.ts'],
          setupFiles: ['./vitest.setup.ts'],
          alias: {
            '@': path.resolve(__dirname, './'),
          },
        },
      },
    ],
  },
});
// // vitest.config.ts
// import { defineConfig } from 'vitest/config';
// import react from '@vitejs/plugin-react';
// import path from 'path';

// export default defineConfig({
//   plugins: [react()],
//   test: {
//     globals: true,
//     setupFiles: ['./vitest.setup.ts'],
    
//     // Define separate projects for frontend and backend tests
//     projects: [
//       {
//         name: 'jsdom',
//         test: {
//           environment: 'jsdom',
//           include: ['components/**/*.test.{ts,tsx}'],
//           // --- ALIASES FOR JSDOM PROJECT ---
//           alias: {
//             '@': path.resolve(__dirname, './'),
//             'crypto': 'uncrypto', // Crypto polyfill for browser environment
//           },
//         },
//       },
//       {
//         name: 'node',
//         test: {
//           environment: 'node',
//           include: ['app/api/**/*.test.ts', 'models/**/*.test.ts', 'lib/**/*.test.ts'],
//           setupFiles: ['./vitest.setup.ts'], 
//           alias: {
//             '@': path.resolve(__dirname, './'),
//           },
//         },
//       },
//     ],
//   },
//   // REMOVED the top-level resolve.alias
// });
// // vitest.config.ts
// import { defineConfig } from 'vitest/config';
// import react from '@vitejs/plugin-react';
// import path from 'path';

// export default defineConfig({
//   plugins: [react()],
//   test: {
//     globals: true,
//     setupFiles: ['./vitest.setup.ts'],
    
//     // --- THIS IS THE KEY ---
//     environmentMatchGlobs: [
//         // All component tests will run in JSDOM (the default)
//         ['components/**', 'jsdom'],
        
//         // Specifically target API routes and model tests to run in Node
//         ['app/api/**', 'node'],
//         ['models/tests/**', 'node'],
//         ['lib/trade-analysis/tests/**', 'node'], // Your trade analysis tests are also backend logic
//       ],
//   },
//   resolve: {
//     alias: {
//       '@': path.resolve(__dirname, './'),
//       // The crypto alias is now less critical but safe to keep for components
//       'crypto': 'uncrypto',
//     },
//   },
// });
// // // vitest.config.ts
// // import { defineConfig } from 'vitest/config';
// // import react from '@vitejs/plugin-react';
// // import path from 'path';

// // export default defineConfig({
// //   plugins: [react()],
// //   test: {
// //     globals: true, // This is essential
// //     environment: 'jsdom',
    
// //     // This prevents Vitest from scanning node_modules
// //     include: ['**/*.test.{ts,tsx}'],
// //     exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],

// //     setupFiles: ['./vitest.setup.ts'], 
// //   },
// //   resolve: {
// //     alias: {
// //       '@': path.resolve(__dirname, './'),
// //       'crypto': 'uncrypto',
// //     },
// //   },
// // });



// // // vitest.config.ts
// // import { defineConfig } from 'vitest/config';
// // import react from '@vitejs/plugin-react';
// // import path from 'path';

// // export default defineConfig({
// //   plugins: [react()],
// //   test: {
// //     globals: true, // This makes `expect`, `describe`, etc. globally available
// //     environment: 'jsdom',
    
// //     // --- THIS IS THE CRUCIAL FIX FOR THE HANGING/SLOW TEST ---
// //     // Tell Vitest to ONLY look for test files inside your source code,
// //     // and explicitly EXCLUDE node_modules.
// //     include: ['**/*.test.{ts,tsx}'],
// //     exclude: ['node_modules'],

// //     // The setup file remains the same
// //     setupFiles: ['./vitest.setup.ts'], 
// //   },
// //   resolve: {
// //     alias: {
// //       '@': path.resolve(__dirname, './'),
// //       'crypto': 'uncrypto',
// //     },
// //   },
// // });