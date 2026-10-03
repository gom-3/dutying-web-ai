import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
export default defineConfig({
    resolve: {alias: {'@': fileURLToPath(new URL('../../src', import.meta.url))}},
    plugins: [react(), tailwindcss(), tsconfigPaths({projects: ['./tsconfig.app.json']})],
    server: {
        host: '127.0.0.1',
        port: 4176,
        strictPort: true,
        proxy: {'/api': {target: 'http://127.0.0.1:38082', rewrite: (path) => path.replace(/^\/api/, '')}},
    },
});
