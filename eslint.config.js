// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Clean Architecture layers. Dependencies point inwards only:
 *   main → presentation / infrastructure → application → domain
 */
const layers = [
  { type: 'domain', pattern: 'src/domain' },
  { type: 'application', pattern: 'src/application' },
  { type: 'infrastructure', pattern: 'src/infrastructure' },
  { type: 'presentation', pattern: 'src/presentation' },
  { type: 'main', pattern: 'src/main' },
];

/** @param {...string} types */
const allowTo = (...types) => ({
  allow: { to: { element: { types: { anyOf: types } } } },
});

export default defineConfig(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': layers,
      'boundaries/include': ['src/**/*.ts'],
      'import/resolver': { typescript: { project: './tsconfig.json' } },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            { from: { element: { type: 'domain' } }, ...allowTo('domain') },
            { from: { element: { type: 'application' } }, ...allowTo('application', 'domain') },
            {
              from: { element: { type: 'infrastructure' } },
              ...allowTo('infrastructure', 'application', 'domain'),
            },
            {
              from: { element: { type: 'presentation' } },
              ...allowTo('presentation', 'application', 'domain'),
            },
            {
              from: { element: { type: 'main' } },
              ...allowTo('main', 'presentation', 'infrastructure', 'application', 'domain'),
            },
          ],
        },
      ],
    },
  },
  {
    // The domain and application layers stay framework-free: no Phaser, no browser libs.
    files: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!@domain/|@application/|\\.)',
              message: 'Domain and application code must not depend on external packages.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
