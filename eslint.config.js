import globals from 'globals'
import pluginReact from 'eslint-plugin-react'

export default [
  {
    ignores: ['dist']
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.dom
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    plugins: { react: pluginReact },
    rules: {
      'react/react-in-jsx-scope': 'off',
    },
  },
]