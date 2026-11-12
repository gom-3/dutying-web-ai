import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {createServer, defineConfig, loadEnv} from 'vite';
import mkcert from 'vite-plugin-mkcert';
import tsconfigPaths from 'vite-tsconfig-paths';
import marketingPageData from './src/shared/seo/marketing-pages.json';

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));
// www가 리뉴얼 랜딩과 제품 앱을 함께 제공하는 운영 정식 호스트다.
// app.dutying.ai는 기존 링크와 딥링크 호환을 위해 같은 앱을 제공한다.
const defaultAppSiteUrl = 'https://www.dutying.ai';
const defaultPreviewAppSiteUrl = 'https://dev.dutying.ai';

type TMarketingPage = Omit<(typeof marketingPageData.pages)[number], 'nurseApp'>;
type TMarketingPageGroup = {kind: 'home' | 'nurseApp'; pages: TMarketingPage[]};
type TMarketingEntry = {page: TMarketingPage; group: TMarketingPageGroup};

const marketingPageGroups: TMarketingPageGroup[] = [
    {kind: 'home', pages: marketingPageData.pages},
    {kind: 'nurseApp', pages: marketingPageData.pages.map(({nurseApp, ...page}) => ({...page, ...nurseApp}))},
];
const marketingPagesByPath = new Map<string, TMarketingEntry>(
    marketingPageGroups.flatMap((group) => group.pages.map((page) => [page.path, {page, group}] as const)),
);
const getDefaultMarketingPage = ({pages}: TMarketingPageGroup) => pages.find((page) => page.language === 'en') ?? pages[0];
const appStaticRoutes = [
    '/pricing',
    '/refund',
    '/subscription-terms',
    '/workspace',
    '/workspace/plans',
    '/workspace/adoption',
    '/workspace/billing-return',
    '/workspace/payment-return',
    '/privacy',
    '/terms',
    '/home',
    '/register',
    '/enter-ward',
    '/register-ward',
    '/onboarding/ward-create',
    '/login',
    '/legacy-roster',
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
    '/commercial',
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
const getCanonicalUrl = (appSiteUrl: string, path: string) => (path === '/' ? `${appSiteUrl}/` : `${appSiteUrl}${path}`);
const getOgImageMetadata = ({page, group}: TMarketingEntry) => {
    if (group.kind === 'nurseApp') {
        const suffix = page.language === 'ko' ? '' : page.language === 'ja' ? '-ja' : '-en';

        return {path: `/img/temp${suffix}.png`, width: 1430, height: 925};
    }

    if (page.language === 'ko') {
        return {
            path: '/img/og-image-preview222.png',
            width: 1200,
            height: 630,
        };
    }

    if (page.language === 'ja') {
        return {
            path: '/img/landing-hero-ja-2026.png',
            width: 1672,
            height: 941,
        };
    }

    return {
        path: '/img/landing-hero-en-2026.png',
        width: 1672,
        height: 941,
    };
};
const createStructuredData = (page: TMarketingPage, appSiteUrl: string) => {
    const canonicalUrl = getCanonicalUrl(appSiteUrl, page.path);

    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Organization',
                '@id': `${appSiteUrl}/#organization`,
                name: '듀팅',
                alternateName: 'Dutying',
                url: `${appSiteUrl}/`,
                sameAs: ['https://www.instagram.com/dutying_official/'],
                logo: `${appSiteUrl}/logo-wordmark-purple.png`,
            },
            {
                '@type': 'WebSite',
                '@id': `${appSiteUrl}/#website`,
                name: '듀팅',
                alternateName: 'Dutying',
                url: `${appSiteUrl}/`,
                inLanguage: marketingPageData.pages.map((item) => item.schemaLanguage),
                publisher: {'@id': `${appSiteUrl}/#organization`},
            },
            {
                '@type': 'WebPage',
                '@id': `${canonicalUrl}#webpage`,
                url: canonicalUrl,
                name: page.title,
                description: page.description,
                inLanguage: page.schemaLanguage,
                isPartOf: {'@id': `${appSiteUrl}/#website`},
                about: {'@id': `${appSiteUrl}/#software-application`},
            },
            {
                '@type': 'SoftwareApplication',
                '@id': `${appSiteUrl}/#software-application`,
                name: page.language === 'ko' ? '듀팅' : 'Dutying',
                alternateName: page.language === 'ko' ? 'Dutying' : '듀팅',
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
const createMarketingSeoBlock = (entry: TMarketingEntry, appSiteUrl: string, robots: string) => {
    const {page, group} = entry;
    const canonicalUrl = getCanonicalUrl(appSiteUrl, page.path);
    const alternatePages = group.pages.filter((alternatePage) => alternatePage.language !== page.language);
    const ogImage = getOgImageMetadata(entry);
    const ogImageUrl = `${appSiteUrl}${ogImage.path}`;
    const structuredData = JSON.stringify(createStructuredData(page, appSiteUrl)).replace(/</g, '\\u003c');

    return `<!-- MARKETING_SEO_START -->
        <title>${escapeHtml(page.title)}</title>
        <meta name="title" content="${escapeHtml(page.title)}" />
        <meta name="description" content="${escapeHtml(page.description)}" />
        <meta name="robots" content="${robots}" />
        <link rel="canonical" href="${canonicalUrl}" />
${group.pages
    .map(
        (alternatePage) =>
            `        <link rel="alternate" hreflang="${alternatePage.language}" href="${getCanonicalUrl(appSiteUrl, alternatePage.path)}" />`,
    )
    .join('\n')}
        <link rel="alternate" hreflang="x-default" href="${getCanonicalUrl(appSiteUrl, getDefaultMarketingPage(group).path)}" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="듀팅 · Dutying" />
        <meta property="og:url" content="${canonicalUrl}" />
        <meta property="og:locale" content="${page.ogLocale}" />
${alternatePages.map((alternatePage) => `        <meta property="og:locale:alternate" content="${alternatePage.ogLocale}" />`).join('\n')}
        <meta property="og:title" content="${escapeHtml(page.title)}" />
        <meta property="og:description" content="${escapeHtml(page.description)}" />
        <meta property="og:image" content="${ogImageUrl}" />
        <meta property="og:image:width" content="${ogImage.width}" />
        <meta property="og:image:height" content="${ogImage.height}" />
        <meta property="og:image:alt" content="${escapeHtml(page.imageAlt)}" />

        <meta property="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="${canonicalUrl}" />
        <meta property="twitter:title" content="${escapeHtml(page.title)}" />
        <meta property="twitter:description" content="${escapeHtml(page.description)}" />
        <meta property="twitter:image" content="${ogImageUrl}" />
        <script type="application/ld+json">${structuredData}</script>
        <!-- MARKETING_SEO_END -->`;
};
const renderMarketingSeoHtml = (html: string, entry: TMarketingEntry, appSiteUrl: string, robots: string) =>
    html
        .replace(/<html lang="[^"]*">/, `<html lang="${entry.page.language}">`)
        .replace(marketingSeoBlockPattern, createMarketingSeoBlock(entry, appSiteUrl, robots));
// Authenticated tools and SPA shells have no public landing content. Do not copy
// home-page hreflang or product markup onto them, or advertise them in the sitemap.
const renderAppSeoHtml = (html: string, appSiteUrl: string, path?: string) =>
    html.replace(
        marketingSeoBlockPattern,
        `<!-- MARKETING_SEO_START -->
        <title>듀팅 · Dutying</title>
        <meta name="robots" content="noindex, follow" />
        ${path ? `<link rel="canonical" href="${escapeHtml(getCanonicalUrl(appSiteUrl, path))}" />` : ''}
        <!-- MARKETING_SEO_END -->`,
    );
const createSitemap = (appSiteUrl: string) => {
    const localizedUrls = marketingPageGroups
        .flatMap((group) => {
            const alternates = group.pages
                .map(
                    (alternatePage) =>
                        `    <xhtml:link rel="alternate" hreflang="${alternatePage.language}" href="${getCanonicalUrl(appSiteUrl, alternatePage.path)}" />`,
                )
                .join('\n');

            const defaultUrl = getCanonicalUrl(appSiteUrl, getDefaultMarketingPage(group).path);

            return group.pages.map(
                (page) =>
                    `  <url>\n    <loc>${getCanonicalUrl(appSiteUrl, page.path)}</loc>\n${alternates}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${defaultUrl}" />\n  </url>`,
            );
        })
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${localizedUrls}\n</urlset>\n`;
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
    const isProductionSite =
        appSiteUrl === defaultAppSiteUrl &&
        !(process.env.CF_PAGES === '1' && process.env.CF_PAGES_BRANCH !== 'main') &&
        !(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production');
    const isWindows = process.platform === 'win32';
    const isTest = mode === 'test';

    let resolvedOutDir = resolve(process.cwd(), 'dist');
    let shouldEmitStaticRoutes = false;

    return {
        envDir: workspaceRoot,
        build: {
            manifest: true,
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
                    // 원래 요청 주소를 우선해야 언어별 랜딩에서도 올바른 메타데이터가 나온다.
                    const path = normalizeMarketingPath(context.originalUrl ?? context.path);
                    const page = marketingPagesByPath.get(path);

                    return page
                        ? renderMarketingSeoHtml(html, page, appSiteUrl, isProductionSite ? 'index, follow' : 'noindex, nofollow')
                        : renderAppSeoHtml(html, appSiteUrl, path);
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
                async closeBundle() {
                    if (!shouldEmitStaticRoutes) return;

                    const indexHtml = readFileSync(resolve(resolvedOutDir, 'index.html'), 'utf8');

                    writeFileSync(resolve(resolvedOutDir, 'app-shell.html'), renderAppSeoHtml(indexHtml, appSiteUrl));

                    // Cloudflare Pages에 404.html이 있으면 자동 SPA fallback이 꺼진다.
                    // 유효한 라우트만 정적 HTML 별칭으로 발행해 딥링크는 200을 유지하고,
                    // 나머지 URL은 플랫폼의 실제 404 응답으로 보낸다.
                    appStaticRoutes.forEach((route) => {
                        const routeFile = resolve(resolvedOutDir, `${route.slice(1)}.html`);
                        mkdirSync(dirname(routeFile), {recursive: true});
                        writeFileSync(routeFile, renderAppSeoHtml(indexHtml, appSiteUrl, route));
                    });

                    // Render the real responsive landing with the same React component used
                    // by the browser. Product routes above deliberately keep their empty SPA root.
                    const appRoot = fileURLToPath(new URL('.', import.meta.url));
                    const renderer = await createServer({
                        configFile: false,
                        root: appRoot,
                        // The build-only renderer must not replace a running dev server's prebundles.
                        cacheDir: resolve(appRoot, 'node_modules/.vite-landing-ssr'),
                        envDir: workspaceRoot,
                        mode,
                        plugins: [react(), tsconfigPaths({projects: [resolve(appRoot, 'tsconfig.app.json')]})],
                        server: {middlewareMode: true, watch: null, hmr: false, ws: false, preTransformRequests: false},
                        optimizeDeps: {noDiscovery: true, include: []},
                        appType: 'custom',
                        ssr: {noExternal: ['@dutying/utils', '@dutying/domain']},
                    });

                    try {
                        const {renderLanding} = await renderer.ssrLoadModule('/src/pages/landing/entry-server.tsx');
                        const {INVITE_PAGE_COPY} = await renderer.ssrLoadModule('/src/pages/invite-fallback/copy.ts');
                        const previewImages = JSON.parse(readFileSync(resolve(appRoot, 'edge/invite-preview-images.json'), 'utf8'));
                        const previewData = Object.fromEntries(
                            Object.entries(previewImages).map(([language, image]) => [
                                language,
                                {image, invites: INVITE_PAGE_COPY[language].invites},
                            ]),
                        );
                        const homeLanguageData = {
                            ...marketingPageData.homeLanguagePreference,
                            paths: Object.fromEntries(marketingPageData.pages.map(({language, path}) => [language, path])),
                        };
                        const pagesWorker = readFileSync(resolve(appRoot, 'edge/invite-preview-worker.mjs'), 'utf8')
                            .replace('/*__INVITE_PREVIEW_DATA__*/', () => JSON.stringify(previewData).slice(1, -1))
                            .replace('/*__HOME_LANGUAGE_DATA__*/', () => JSON.stringify(homeLanguageData).slice(1, -1));

                        writeFileSync(resolve(resolvedOutDir, '_worker.js'), pagesWorker);
                        writeFileSync(
                            resolve(resolvedOutDir, '_routes.json'),
                            JSON.stringify({
                                version: 1,
                                include: ['/', '/app/friends/invite', '/app/friends/invite/', '/app/moim/invite', '/app/moim/invite/'],
                                exclude: [],
                            }),
                        );

                        const manifest = JSON.parse(readFileSync(resolve(resolvedOutDir, '.vite/manifest.json'), 'utf8'));
                        const styles = new Set<string>();
                        const visited = new Set<string>();
                        const collectStyles = (key: string) => {
                            if (visited.has(key)) return;

                            visited.add(key);

                            const entry = manifest[key];

                            if (!entry) return;

                            (entry.css ?? []).forEach((file: string) => styles.add(file));
                            (entry.imports ?? []).forEach(collectStyles);
                        };

                        collectStyles('src/pages/landing/entry-client.tsx');

                        if (styles.size === 0) throw new Error('Landing styles are missing from the Vite manifest');

                        const stylesheetLinks = [...styles]
                            .map((file) => `<link rel="stylesheet" crossorigin href="/${file}" />`)
                            .join('\n');

                        for (const entry of marketingPagesByPath.values()) {
                            const {page} = entry;
                            const {html, data} = renderLanding(page.language, page.path);
                            const routeFile = resolve(resolvedOutDir, page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`);
                            const document = renderMarketingSeoHtml(
                                indexHtml,
                                entry,
                                appSiteUrl,
                                isProductionSite ? 'index, follow' : 'noindex, nofollow',
                            )
                                .replace('<div id="root"></div>', `<div id="root" data-rendered="landing">${html}</div>`)
                                .replace('</head>', `${stylesheetLinks}\n</head>`)
                                .replace('</body>', `<script id="landing-data" type="application/json">${data}</script>\n</body>`);

                            mkdirSync(dirname(routeFile), {recursive: true});
                            writeFileSync(routeFile, document);
                        }
                    } finally {
                        await renderer.close();
                    }
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
