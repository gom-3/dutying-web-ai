import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import mkcert from 'vite-plugin-mkcert';

interface Chunks {
    [key: string]: string[];
}

const renderChunks = (deps: Record<string, string>) => {
    const chunks: Chunks = {};
    Object.keys(deps).forEach((key) => {
        if (['react', 'react-router-dom', 'react-dom'].includes(key)) {
            return;
        }
        chunks[key] = [key];
    });

    return chunks;
};

const dependencies = {
    '@hookform/resolvers': '@hookform/resolvers',
    '@tanstack/react-query': '@tanstack/react-query',
    '@tanstack/react-query-devtools': '@tanstack/react-query-devtools',
    axios: 'axios',
    exceljs: 'exceljs',
    history: 'history',
    immer: 'immer',
    'lodash-es': 'lodash-es',
    qs: 'qs',
    react: 'react',
    '@hello-pangea/dnd': '@hello-pangea/dnd',
    'react-cool-onclickoutside': 'react-cool-onclickoutside',
    'react-dom': 'react-dom',
    'react-draggable': 'react-draggable',
    'react-facebook-pixel': 'react-facebook-pixel',
    'react-ga4': 'react-ga4',
    'react-helmet': 'react-helmet',
    'react-hook-form': 'react-hook-form',
    'react-hot-toast': 'react-hot-toast',
    'react-loader-spinner': 'react-loader-spinner',
    'ts-pattern': 'ts-pattern',
    yup: 'yup',
    zustand: 'zustand',
};

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({command}) => ({
    envDir: workspaceRoot,
    build: {
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-router-dom', 'react-dom', 'react-router', 'react-router-dom'],
                    ...renderChunks(dependencies),
                },
            },
        },
    },
    plugins: [
        react({
            babel: {
                plugins: [
                    ['babel-plugin-react-compiler'],
                    [
                        '@locator/babel-jsx/dist',
                        {
                            env: 'development',
                        },
                    ],
                ],
            },
        }),
        tsconfigPaths({projects: ['./tsconfig.app.json']}),
        tailwindcss(),
        ...(command === 'serve'
            ? [
                  mkcert({
                      hosts: ['local.app.dutying.net', 'localhost', '127.0.0.1'],
                  }),
              ]
            : []),
    ],
    server: {
        host: 'local.app.dutying.net',
        https: {},
        hmr: {
            host: 'local.app.dutying.net',
            protocol: 'wss',
        },
        port: 3000,
    },
    css: {
        devSourcemap: true,
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/vitest-setup.ts'],
    },
}));
