import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig, loadEnv} from 'vite';
import mkcert from 'vite-plugin-mkcert';
import tsconfigPaths from 'vite-tsconfig-paths';

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));
// www가 리뉴얼 랜딩과 제품 앱을 함께 제공하는 운영 정식 호스트다.
// app.dutying.ai는 기존 링크와 딥링크 호환을 위해 같은 앱을 제공한다.
const defaultAppSiteUrl = 'https://www.dutying.ai';
const defaultPreviewAppSiteUrl = 'https://dev.dutying.ai';
const appStaticRoutes = [
    '/privacy',
    '/terms',
    '/home',
    '/register',
    '/enter-ward',
    '/register-ward',
    '/onboarding/ward-create',
    '/login',
    '/signup',
    '/refresh',
    '/maintenance',
    '/renewal',
    '/oauth2/redirect',
    '/app/friends/invite',
    '/app/moim/invite',
    '/onboarding',
    '/make',
    '/request',
    '/duty',
    '/board',
    '/member',
    '/ward-settings',
    '/ward-settings/admins',
    '/ward-info-settings',
    '/profile',
    '/dutying',
    '/dutying/notices',
] as const;
const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const withHttpsProtocol = (value: string) => (/^https?:\/\//.test(value) ? value : `https://${value}`);
const getEnvValue = (value: string | undefined) => (value === undefined || value === '' ? undefined : value);
const getConfiguredAppSiteUrl = (env: Record<string, string>) => {
    const explicitUrl = getEnvValue(env.VITE_APP_PUBLIC_URL) ?? getEnvValue(env.VITE_APP_SITE_URL);
    // Cloudflare Pages: CF_PAGES=1, CF_PAGES_BRANCH=배포 브랜치, CF_PAGES_URL=배포 URL.
    // 프로덕션 브랜치(main)가 아니면 preview로 간주한다.
    const isCloudflarePages = process.env.CF_PAGES === '1';
    const isCloudflareProduction = isCloudflarePages && process.env.CF_PAGES_BRANCH === 'main';
    const cloudflareUrl = isCloudflareProduction ? undefined : getEnvValue(process.env.CF_PAGES_URL);
    const appSiteUrl =
        explicitUrl ??
        (isCloudflarePages && !isCloudflareProduction ? defaultPreviewAppSiteUrl : undefined) ??
        cloudflareUrl ??
        defaultAppSiteUrl;

    return stripTrailingSlash(withHttpsProtocol(appSiteUrl));
};

export default defineConfig(({mode}) => {
    const env = loadEnv(mode, workspaceRoot, '');
    const appSiteUrl = getConfiguredAppSiteUrl(env);
    // 운영 www 빌드만 검색 색인을 허용하고 dev/preview는 차단한다.
    const isProductionSite = appSiteUrl === defaultAppSiteUrl;
    const isWindows = process.platform === 'win32';
    const isTest = mode === 'test';
    let resolvedOutDir = resolve(process.cwd(), 'dist');
    let shouldEmitStaticRoutes = false;

    return {
        envDir: workspaceRoot,
        build: {
            sourcemap: true,
        },
        plugins: [
            react({
                babel: {
                    plugins: [
                        ['babel-plugin-react-compiler'],
                        ...(!isWindows
                            ? [
                                  [
                                      '@locator/babel-jsx/dist',
                                      {
                                          env: 'development',
                                      },
                                  ] as const,
                              ]
                            : []),
                    ],
                },
            }),
            tsconfigPaths({projects: ['./tsconfig.app.json']}),
            tailwindcss(),
            ...(isTest ? [] : [mkcert()]),
            {
                name: 'app-site-url-assets',
                configResolved(config) {
                    resolvedOutDir = config.build.outDir;
                    shouldEmitStaticRoutes = config.command === 'build';
                },
                transformIndexHtml(html) {
                    return html
                        .split('__APP_SITE_URL__')
                        .join(appSiteUrl)
                        .split('__ROBOTS_META__')
                        .join(isProductionSite ? 'index, follow' : 'noindex, nofollow');
                },
                generateBundle() {
                    // www의 리뉴얼 랜딩은 색인하고 dev/preview 배포는 중복 색인을 막는다.
                    this.emitFile({
                        type: 'asset',
                        fileName: 'robots.txt',
                        source: isProductionSite
                            ? `User-agent: *\nAllow: /\nSitemap: ${appSiteUrl}/sitemap.xml\n`
                            : 'User-agent: *\nDisallow: /\n',
                    });

                    if (!isProductionSite) return;

                    this.emitFile({
                        type: 'asset',
                        fileName: 'sitemap.xml',
                        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${appSiteUrl}/</loc>\n  </url>\n  <url>\n    <loc>${appSiteUrl}/privacy</loc>\n  </url>\n  <url>\n    <loc>${appSiteUrl}/terms</loc>\n  </url>\n</urlset>\n`,
                    });
                },
                closeBundle() {
                    if (!shouldEmitStaticRoutes) return;

                    const indexHtml = readFileSync(resolve(resolvedOutDir, 'index.html'), 'utf8');

                    // Cloudflare Pages에 404.html이 있으면 자동 SPA fallback이 꺼진다.
                    // 유효한 라우트만 정적 HTML 별칭으로 발행해 딥링크는 200을 유지하고,
                    // 나머지 URL은 플랫폼의 실제 404 응답으로 보낸다.
                    appStaticRoutes.forEach((route) => {
                        const routeFile = resolve(resolvedOutDir, `${route.slice(1)}.html`);

                        mkdirSync(dirname(routeFile), {recursive: true});
                        writeFileSync(routeFile, indexHtml);
                    });
                },
            },
        ],
        server: {
            host: 'local.app.dutying.net',
            port: 3000,
        },
        css: {
            devSourcemap: true,
        },
        test: {
            globals: true,
            environment: 'jsdom',
            setupFiles: ['./src/vitest-setup.ts'],
            coverage: {
                reporter: ['text', 'json-summary', 'json'],
            },
        },
    };
});
