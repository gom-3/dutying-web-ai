import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig, loadEnv} from 'vite';
import mkcert from 'vite-plugin-mkcert';
import tsconfigPaths from 'vite-tsconfig-paths';
import marketingPageData from './src/shared/seo/marketing-pages.json';

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));
// www가 리뉴얼 랜딩과 제품 앱을 함께 제공하는 운영 정식 호스트다.
// app.dutying.ai는 기존 링크와 딥링크 호환을 위해 같은 앱을 제공한다.
const defaultAppSiteUrl = 'https://www.dutying.ai';
const defaultPreviewAppSiteUrl = 'https://dev.dutying.ai';

type TMarketingPage = (typeof marketingPageData.pages)[number];

const marketingPages = marketingPageData.pages;
const koreanMarketingPage = marketingPages.find((page) => page.language === 'ko') as TMarketingPage;
const appStaticRoutes = [
    ...marketingPages.filter((page) => page.path !== '/').map((page) => page.path),
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
const marketingSeoBlockPattern = /<!-- MARKETING_SEO_START -->[\s\S]*?<!-- MARKETING_SEO_END -->/;
const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const withHttpsProtocol = (value: string) => (/^https?:\/\//.test(value) ? value : `https://${value}`);
const getEnvValue = (value: string | undefined) => (value === undefined || value === '' ? undefined : value);
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const normalizeMarketingPath = (value: string) => {
    const pathname = new URL(value, 'https://local.dutying.net').pathname.replace(/\.html$/, '');

    if (pathname === '/' || pathname === '/index') return '/';

    return pathname.replace(/\/+$/, '');
};
const getMarketingPage = (path: string) => marketingPages.find((page) => page.path === normalizeMarketingPath(path)) ?? koreanMarketingPage;
const getCanonicalUrl = (appSiteUrl: string, path: string) => (path === '/' ? `${appSiteUrl}/` : `${appSiteUrl}${path}`);
const createStructuredData = (page: TMarketingPage, appSiteUrl: string) => {
    const canonicalUrl = getCanonicalUrl(appSiteUrl, page.path);

    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Organization',
                '@id': `${appSiteUrl}/#organization`,
                name: 'Dutying',
                url: `${appSiteUrl}/`,
                logo: `${appSiteUrl}/logo-wordmark-purple.png`,
            },
            {
                '@type': 'WebSite',
                '@id': `${canonicalUrl}#website`,
                name: 'Dutying',
                url: canonicalUrl,
                inLanguage: page.schemaLanguage,
                publisher: {'@id': `${appSiteUrl}/#organization`},
            },
            {
                '@type': 'SoftwareApplication',
                '@id': `${appSiteUrl}/#software-application`,
                name: 'Dutying',
                description: page.description,
                url: canonicalUrl,
                applicationCategory: 'BusinessApplication',
                applicationSubCategory: 'WorkforceManagementApplication',
                operatingSystem: 'Web, iOS, Android',
                inLanguage: page.schemaLanguage,
                sameAs: [page.iosStoreUrl, page.androidStoreUrl],
                publisher: {'@id': `${appSiteUrl}/#organization`},
            },
        ],
    };
};
const createMarketingSeoBlock = (page: TMarketingPage, appSiteUrl: string, robots: string) => {
    const canonicalUrl = getCanonicalUrl(appSiteUrl, page.path);
    const alternatePages = marketingPages.filter((alternatePage) => alternatePage.language !== page.language);
    const ogImageUrl = `${appSiteUrl}/img/og-image-preview222.png`;
    const structuredData = JSON.stringify(createStructuredData(page, appSiteUrl)).replace(/</g, '\\u003c');

    return `<!-- MARKETING_SEO_START -->
        <title>${escapeHtml(page.title)}</title>
        <meta name="title" content="${escapeHtml(page.title)}" />
        <meta name="description" content="${escapeHtml(page.description)}" />
        <meta name="robots" content="${robots}" />
        <link rel="canonical" href="${canonicalUrl}" />
${marketingPages
    .map(
        (alternatePage) =>
            `        <link rel="alternate" hreflang="${alternatePage.language}" href="${getCanonicalUrl(appSiteUrl, alternatePage.path)}" />`,
    )
    .join('\n')}
        <link rel="alternate" hreflang="x-default" href="${getCanonicalUrl(appSiteUrl, '/')}" />

        <meta property="og:type" content="website" />
        <meta property="og:url" content="${canonicalUrl}" />
        <meta property="og:locale" content="${page.ogLocale}" />
${alternatePages.map((alternatePage) => `        <meta property="og:locale:alternate" content="${alternatePage.ogLocale}" />`).join('\n')}
        <meta property="og:title" content="${escapeHtml(page.title)}" />
        <meta property="og:description" content="${escapeHtml(page.description)}" />
        <meta property="og:image" content="${ogImageUrl}" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="${escapeHtml(page.imageAlt)}" />

        <meta property="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="${canonicalUrl}" />
        <meta property="twitter:title" content="${escapeHtml(page.title)}" />
        <meta property="twitter:description" content="${escapeHtml(page.description)}" />
        <meta property="twitter:image" content="${ogImageUrl}" />
        <script type="application/ld+json">${structuredData}</script>
        <!-- MARKETING_SEO_END -->`;
};
const renderMarketingSeoHtml = (html: string, page: TMarketingPage, appSiteUrl: string, robots: string) =>
    html
        .replace(/<html lang="[^"]*">/, `<html lang="${page.language}">`)
        .replace(marketingSeoBlockPattern, createMarketingSeoBlock(page, appSiteUrl, robots));
const createSitemap = (appSiteUrl: string) => {
    const localizedUrls = marketingPages
        .map((page) => {
            const alternates = marketingPages
                .map(
                    (alternatePage) =>
                        `    <xhtml:link rel="alternate" hreflang="${alternatePage.language}" href="${getCanonicalUrl(appSiteUrl, alternatePage.path)}" />`,
                )
                .join('\n');

            return `  <url>\n    <loc>${getCanonicalUrl(appSiteUrl, page.path)}</loc>\n${alternates}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${getCanonicalUrl(appSiteUrl, '/')}" />\n  </url>`;
        })
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${localizedUrls}\n  <url>\n    <loc>${appSiteUrl}/privacy</loc>\n  </url>\n  <url>\n    <loc>${appSiteUrl}/terms</loc>\n  </url>\n</urlset>\n`;
};
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
                transformIndexHtml(html, context) {
                    // 개발 서버의 SPA fallback은 context.path를 /index.html로 바꾼다.
                    // 원래 요청 주소를 우선해야 /en, /ja에서도 올바른 언어 메타데이터가 나온다.
                    const page = getMarketingPage(context.originalUrl ?? context.path);

                    return renderMarketingSeoHtml(html, page, appSiteUrl, isProductionSite ? 'index, follow' : 'noindex, nofollow');
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
                        source: createSitemap(appSiteUrl),
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
                        const marketingPage = marketingPages.find((page) => page.path === route);
                        const routeHtml = marketingPage
                            ? renderMarketingSeoHtml(
                                  indexHtml,
                                  marketingPage,
                                  appSiteUrl,
                                  isProductionSite ? 'index, follow' : 'noindex, nofollow',
                              )
                            : indexHtml;

                        mkdirSync(dirname(routeFile), {recursive: true});
                        writeFileSync(routeFile, routeHtml);
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
