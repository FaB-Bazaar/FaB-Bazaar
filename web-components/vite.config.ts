import { defineConfig } from 'vite';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'FabBazaarUI',
      formats: ['es'],
      fileName: 'fabbazaar-ui',
    },
    rollupOptions: {
      // Bundle everything for easy distribution
      external: [],
    },
    // Disable source maps in production to prevent code inspection
    sourcemap: false,
    // Enable minification with terser for better obfuscation
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      mangle: {
        properties: false, // Keep property names for Lit compatibility
      },
      format: {
        comments: false, // Remove all comments
      },
    },
    // Target modern browsers that support Web Components
    target: 'es2020',
  },
  // Development server configuration
  server: {
    port: 3001,
  },
});
