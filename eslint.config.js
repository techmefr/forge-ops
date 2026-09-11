import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import globals from 'globals'

const DIRECTIVE = /^\s*(eslint-|@ts-|prettier-|v8 ignore|c8 ignore|#|\/ <reference)/

const house = {
  rules: {
    'no-comments': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          comment: 'House rule: no comments in code. Say it with a name, not a comment.',
        },
      },
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              if (DIRECTIVE.test(comment.value)) {
                continue
              }
              context.report({ node: comment, messageId: 'comment' })
            }
          },
        }
      },
    },
  },
}

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'gateproof/fixtures/**',
      'db/**',
      'design/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.{ts,vue,js}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] },
    },
    plugins: { house },
    rules: {
      'house/no-comments': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: [
      'backend/src/*.ts',
      'backend/src/technical/Guardrail/*Hook.ts',
      'backend/src/technical/Http/BoardServer.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
)
