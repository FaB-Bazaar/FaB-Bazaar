// vitest.config.node.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // THIS IS THE KEY: Explicitly set the environment to Node.js
    environment: 'node',
    
    // Tell this config to only run tests in specific directories
    include: ['models/tests/**/*.test.ts', 'app/api/**/tests/**/*.test.ts'],
    
    // Use a setup file to load environment variables
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    // This alias setup must match your tsconfig.json
    alias: {
      '@': path.resolve(__dirname, './'),
      'crypto': undefined, 
    },
  },
});