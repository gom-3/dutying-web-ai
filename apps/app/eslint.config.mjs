import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import reactRefresh from 'eslint-plugin-react-refresh';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        ignores: ['coverage/**', 'dist/**', '**/*', '!src/**', '!cypress/**'],
    },
    {
        files: ['src/**/*.{ts,tsx,js,jsx}', 'cypress/**/*.{ts,tsx,js,jsx}', '*.{ts,mjs}'],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true,
                },
                project: './tsconfig.app.json',
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                React: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': typescript,
            react: react,
            'react-refresh': reactRefresh,
            'react-hooks': reactHooks,
            import: importPlugin,
            prettier: prettier,
            '@stylistic': stylistic,
        },
        rules: {
            ...typescript.configs.recommended.rules,
            ...react.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            ...prettierConfig.rules,

            // TypeScript 관련 규칙
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/consistent-type-imports': ['error', {fixStyle: 'inline-type-imports'}],

            // 일반적인 규칙 완화
            'no-redeclare': 'off', // TypeScript에서 처리
            'no-import-assign': 'off', // TypeScript에서 처리
            'no-constant-condition': 'warn', // 경고로 변경

            // Import 관련 규칙
            // -------------------------------------------------
            // FSD 레이어 규칙 + public API 규칙 (단일 선언)
            // -------------------------------------------------
            'import/no-restricted-paths': [
                'warn',
                {
                    zones: [
                        // pages → app 금지
                        {
                            target: ['./src/pages'],
                            from: ['./src/app'],
                            message: 'pages는 app을 import할 수 없습니다.',
                        },

                        // widgets → pages/app 금지
                        {
                            target: ['./src/widgets'],
                            from: ['./src/pages', './src/app'],
                            message: 'widgets는 pages/app을 import할 수 없습니다.',
                        },

                        // features → widgets/pages/app 금지
                        {
                            target: ['./src/features'],
                            from: ['./src/widgets', './src/pages', './src/app'],
                            message: 'features는 widgets/pages/app을 import할 수 없습니다.',
                        },

                        // entities → features/widgets/pages/app 금지
                        {
                            target: ['./src/entities'],
                            from: ['./src/features', './src/widgets', './src/pages', './src/app'],
                            message: 'entities는 상위 레이어를 import할 수 없습니다.',
                        },

                        // shared → 모든 상위 레이어 import 금지
                        {
                            target: ['./src/shared'],
                            from: ['./src/entities', './src/features', './src/widgets', './src/pages', './src/app'],
                            message: 'shared는 상위 레이어를 import할 수 없습니다.',
                        },
                    ],
                },
            ],

            // -------------------------------------------------
            // 사이클 방지
            // -------------------------------------------------
            'import/no-cycle': ['error', {maxDepth: 3}],
            'import/no-named-as-default-member': 'off',
            'import/prefer-default-export': 'off',
            'import/no-unresolved': 'off',
            'import/no-extraneous-dependencies': 'off',
            'import/no-named-as-default': 'off',
            'import/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                    pathGroups: [
                        {
                            pattern: '@/**',
                            group: 'internal',
                            position: 'before',
                        },
                    ],
                    'newlines-between': 'never',
                    alphabetize: {order: 'asc', caseInsensitive: true},
                },
            ],

            // React 관련 규칙
            'react/jsx-filename-extension': [
                1,
                {
                    extensions: ['.jsx', '.tsx', '.js'],
                },
            ],
            'react/react-in-jsx-scope': 'off', // React 17+ JSX Transform 사용
            'react/jsx-key': 'error',
            'react/display-name': 'off',
            'react/prop-types': 'off',

            // Prettier 관련 규칙
            'prettier/prettier': [
                'error',
                {
                    endOfLine: 'auto',
                },
            ],

            // @stylistic 스타일 규칙들
            '@stylistic/no-multiple-empty-lines': ['error', {max: 2, maxEOF: 1}], // 빈 줄 제한
            '@stylistic/padding-line-between-statements': [
                'error',
                // const 선언문 사이에 빈 줄
                {blankLine: 'always', prev: 'const', next: '*'},
                {blankLine: 'always', prev: '*', next: 'const'},
                // let/var 선언문 사이에 빈 줄
                {blankLine: 'always', prev: ['let', 'var'], next: '*'},
                {blankLine: 'always', prev: '*', next: ['let', 'var']},
                // if 문 앞뒤로 빈 줄
                {blankLine: 'always', prev: '*', next: 'if'},
                {blankLine: 'always', prev: 'if', next: '*'},
                // return 문 앞에 빈 줄
                {blankLine: 'always', prev: '*', next: 'return'},
                // function 선언 앞뒤로 빈 줄
                {blankLine: 'always', prev: '*', next: 'function'},
                {blankLine: 'always', prev: 'function', next: '*'},
                // for/while 루프 앞뒤로 빈 줄
                {blankLine: 'always', prev: '*', next: ['for', 'while']},
                {blankLine: 'always', prev: ['for', 'while'], next: '*'},
                // try-catch 앞뒤로 빈 줄
                {blankLine: 'always', prev: '*', next: 'try'},
                {blankLine: 'always', prev: 'try', next: '*'},
                // switch 문 앞뒤로 빈 줄
                {blankLine: 'always', prev: '*', next: 'switch'},
                {blankLine: 'always', prev: 'switch', next: '*'},
                // 예외: 연속된 const/let/var 선언은 빈 줄 없이
                {blankLine: 'never', prev: 'const', next: 'const'},
                {blankLine: 'never', prev: 'let', next: 'let'},
                {blankLine: 'never', prev: 'var', next: 'var'},
            ], // 구문 사이의 빈 줄 규칙

            // 기본 코드 품질 규칙들
            'prefer-const': 'error', // const 사용 권장
            'no-var': 'error', // var 사용 금지

            // TypeScript 관련 규칙들
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],

            // 미사용 변수 체크
            '@typescript-eslint/prefer-optional-chain': 'error', // 옵셔널 체이닝 권장
            '@typescript-eslint/prefer-nullish-coalescing': 'error', // ?? 연산자 권장
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'interface',
                    format: ['PascalCase'],
                    custom: {regex: '^I[A-Z]', match: true},
                },
                {
                    selector: 'typeAlias',
                    format: ['PascalCase'],
                    custom: {regex: '^T[A-Z]', match: true},
                },
            ],
        },
        settings: {
            react: {
                version: 'detect',
            },
            'import/parsers': {
                '@typescript-eslint/parser': ['.ts', '.tsx'],
            },
            'import/resolver': {
                typescript: true,
                node: {
                    extensions: ['.js', '.jsx', '.ts', '.tsx'],
                },
            },
        },
    },
];
