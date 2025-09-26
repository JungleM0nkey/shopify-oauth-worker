import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'pages/',
        '.wrangler/',
        'vitest.config.js',
        'eslint.config.js'
      ]
    }
  }
});