import sitemap from '@astrojs/sitemap';
import {defineConfig} from 'astro/config';
import {loadRootEnv} from '../../packages/config/load-root-env.mjs';

const env = loadRootEnv(process.cwd());

export default defineConfig({
    // canonical 호스트는 www 다. apex 는 Cloudflare Redirect Rule 로 여기에 301 된다.
    site: env.PUBLIC_MARKETING_SITE_URL ?? 'https://www.dutying.ai',
    integrations: [
        sitemap({
            filter: (page) => !new URL(page).pathname.startsWith('/app/'),
        }),
    ],
    build: {
        // Cloudflare Pages가 `/privacy.html`을 `/privacy`로 제공하므로 canonical과
        // 실제 응답 URL을 슬래시 없이 일치시킨다.
        format: 'file',
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
