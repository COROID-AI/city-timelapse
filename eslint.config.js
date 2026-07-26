import js from '@eslint/js';
import react from 'eslint-plugin-react';
import ts from 'typescript-eslint';
import globals from 'globals';

export default ts.config(
  {
    ignores: ['dist', 'node_modules', 'build'],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      react,
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',

      // The current codebase has intentional/temporary unused bindings and
      // some any-typed surfaces used for WebGL/DOM interop. Keep lint
      // focused on correctness rather than stylistic strictness.
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
