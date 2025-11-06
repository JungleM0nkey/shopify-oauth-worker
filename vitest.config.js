import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '*.config.js',
        'deployment/**',
        'extension/**',
        'pages/**',
        'wiki/**',
      ],
    },
    include: ['tests/**/*.test.js'],
    testTimeout: 10000,
  },
});
