// ESLint 9 flat config.
//
// The repo carried a `lint` script for a tool that was never installed and a
// config file that never existed, so `npm run lint` has always failed on the
// first line. The script also used --ext, which ESLint 9 removed; file matching
// lives in this file now.
//
// Rules are set where they catch real defects and left off where they would
// only generate churn across a working codebase. `any` is a warning rather than
// an error: there are 51 in source, most of them in catch blocks that a shared
// error helper is replacing, and failing the build on all of them today would
// mean either a huge unrelated diff or a suppression comment on every one.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'eslint.config.js'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // The rule that actually pays for itself here: a missing dependency in a
      // useEffect is a real bug class, and this codebase already shipped one
      // (a wizard effect firing on every Settings visit).
      'react-hooks/exhaustive-deps': 'warn',

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      '@typescript-eslint/no-explicit-any': 'warn',
      // Unused values are worth flagging, but an intentionally ignored binding
      // should have a way to say so rather than needing a disable comment.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Off deliberately: empty catch blocks are used in a few places to mean
      // "best effort, carry on", which is a legitimate choice here.
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    // Tests reach for `any` constantly to shape mock module signatures, and
    // that is the right call there -- typing a vi.fn() passthrough adds noise
    // and catches nothing.
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
