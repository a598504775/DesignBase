import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import next from 'eslint-plugin-next';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  next.configs['core-web-vitals'],
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-unused-vars': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
];
