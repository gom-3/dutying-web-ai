import {defineConfig} from 'astro/config';

export default defineConfig({
    site: process.env.PUBLIC_MARKETING_SITE_URL ?? 'https://dutying.net',
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
