module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  // NOTE: the standard `recommended` set is used as the baseline. The original
  // config referenced the full type-checked set, but that name was malformed
  // (missing the `plugin:` prefix) so it never actually ran. Enabling the full
  // type-checked set surfaces 100+ pre-existing violations, and some of its
  // autofixes (e.g. `||` -> `??` on `process.env.X || 'default'`) would change
  // runtime behavior. We keep the high-signal, type-aware `no-floating-promises`
  // rule explicitly and treat the stylistic type-aware rules as warnings.
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', caughtErrors: 'none' },
    ],
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'warn',
    '@typescript-eslint/no-floating-promises': 'error',
    'no-console': 'off', // Allow console.log for CLI tool
  },
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/'],
  overrides: [
    {
      // Test files are excluded from tsconfig, so disable type-aware parsing
      // for them and enable the Jest globals.
      files: ['**/*.test.ts'],
      parserOptions: { project: null },
      env: { jest: true },
      rules: {
        // These rules require type information, which is disabled above for tests.
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/prefer-nullish-coalescing': 'off',
        '@typescript-eslint/prefer-optional-chain': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },
  ],
};
