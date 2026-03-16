import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom for DOM-related tests
    environment: 'jsdom',
    globals: true,
    
    // Setup files to run before tests
    setupFiles: ['./client/src/test/setup.ts'],
    
    // Test file patterns (exclude E2E tests)
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['e2e.spec.ts', 'playwright.config.ts', 'node_modules/**', 'dist/**'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'server/public/',
        '**/*.config.*',
        '**/test/**',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
});
