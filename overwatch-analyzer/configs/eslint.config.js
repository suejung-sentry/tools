import typescriptParser from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import noOnlyTestsPlugin from 'eslint-plugin-no-only-tests';
import noSecretsPlugin from 'eslint-plugin-no-secrets';
import prettierPlugin from 'eslint-plugin-prettier';
import securityPlugin from 'eslint-plugin-security';
import sonarjsPlugin from 'eslint-plugin-sonarjs';
import unicornPlugin from 'eslint-plugin-unicorn';

export default [
  {
    languageOptions: {
      globals: {
        browser: true,
        node: true,
        es2022: true
      },
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: '../../configs/tsconfig.json' // Added project option for type-aware rules
      }
    }
  },
  {
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      'import': importPlugin,
      'unicorn': unicornPlugin,
      'sonarjs': sonarjsPlugin, 
      'security': securityPlugin,
      'prettier': prettierPlugin,
      'no-only-tests': noOnlyTestsPlugin,
      'no-secrets': noSecretsPlugin
    },
    rules: {
      // Strict type checking
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',

      // Code quality
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-duplicate-string': 'error',
      'sonarjs/no-identical-functions': 'error',
      
      // Security
      'security/detect-object-injection': 'error',
      'security/detect-non-literal-regexp': 'error',
      'no-secrets/no-secrets': 'error',

      // Testing
      'no-only-tests/no-only-tests': 'error',

      // Import rules
      'import/order': ['error', {
        'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        'alphabetize': { 'order': 'asc' }
      }],
      'import/no-unresolved': 'error',
      'import/no-cycle': 'error',
      'import/no-self-import': 'error',
      'import/no-mutable-exports': 'error',

      // General
      'no-console': 'error',
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'complexity': ['error', 10],
      'max-lines': ['error', { 'max': 300, 'skipBlankLines': true, 'skipComments': true }],
      'max-lines-per-function': ['error', { 'max': 50, 'skipBlankLines': true, 'skipComments': true }],
      'max-depth': ['error', 3],
      'max-params': ['error', 3]
    },
    settings: {
      'import/resolver': {
        typescript: true,
        node: true
      }
    }
  },
  // Including extended configs directly in the array
  { name: 'eslint:recommended' },
  { name: 'plugin:@typescript-eslint/recommended' },
  { name: 'plugin:@typescript-eslint/recommended-requiring-type-checking' },
  { name: 'plugin:import/recommended' },
  { name: 'plugin:import/typescript' },
  { name: 'plugin:unicorn/recommended' },
  { name: 'plugin:sonarjs/recommended' },
  { name: 'plugin:security/recommended' },
  { name: 'plugin:prettier/recommended' }
]
