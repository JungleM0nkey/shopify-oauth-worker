export default [
  {
    ignores: ['node_modules/', 'dist/', 'pages/', '.wrangler/']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Cloudflare Workers globals
        addEventListener: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        crypto: 'readonly',
        fetch: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        console: 'readonly',
        // Node.js test globals
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'brace-style': ['error', '1tbs'],
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always']
    }
  }
];