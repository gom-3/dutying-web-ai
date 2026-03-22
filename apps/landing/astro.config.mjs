import {defineConfig} from 'astro/config';

export default defineConfig({
    site: 'https://dutying.net',
    build: {
        format: 'directory',
    },
    server: {
        host: 'local.dutying.net',
        port: 4321,
    },
    preview: {
        host: 'local.dutying.net',
        port: 4321,
    },
});
