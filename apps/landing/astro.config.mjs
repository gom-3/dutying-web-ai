import sitemap from '@astrojs/sitemap';
import {defineConfig} from 'astro/config';
import {loadRootEnv} from '../../packages/config/load-root-env.mjs';

const env = loadRootEnv(process.cwd());

export default defineConfig({
    // canonical 호스트는 www 다. apex 는 Cloudflare Redirect Rule 로 여기에 301 된다.
    site: env.PUBLIC_MARKETING_SITE_URL ?? 'https://www.dutying.ai',
    integrations: [
        sitemap({
            filter: (page) =>
                !['/app/friends/invite', '/app/moim/invite'].some((path) => new URL(page).pathname.startsWith(path)),
        }),
    ],
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
