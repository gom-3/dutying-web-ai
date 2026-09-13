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
const englishMarketingPage = marketingPages.find((page) => page.language === 'en') as TMarketingPage;
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
const marketingFallbackPattern = /<!-- MARKETING_FALLBACK_START -->[\s\S]*?<!-- MARKETING_FALLBACK_END -->/;
const marketingFallbackCopyByLanguage: Record<
    TMarketingPage['language'],
    {eyebrow: string; actionsLabel: string; webAction: string; appAction: string; heroImage: string}
> = {
    ko: {
        eyebrow: 'AI 간호사 근무표',
        actionsLabel: '듀팅 시작하기',
        webAction: '웹에서 근무표 만들기',
        appAction: '앱 다운로드',
        heroImage: '/img/landing-hero-kr.webp',
    },
    en: {
        eyebrow: 'AI nurse scheduling',
        actionsLabel: 'Get started with Dutying',
        webAction: 'Create a schedule on web',
        appAction: 'Download app',
        heroImage: '/img/landing-hero-en.webp',
    },
    ja: {
        eyebrow: 'AI看護師勤務表',
        actionsLabel: 'Dutyingを始める',
        webAction: 'Webで勤務表を作成',
        appAction: 'アプリをダウンロード',
        heroImage: '/img/landing-hero-jp.webp',
    },
    zh: {
        eyebrow: 'AI护士排班',
        actionsLabel: '开始使用 Dutying',
        webAction: '在网页上创建排班表',
        appAction: '下载应用',
        heroImage: '/img/landing-hero-cn.webp',
    },
    th: {
        eyebrow: 'ตารางเวรพยาบาล AI',
        actionsLabel: 'เริ่มต้นใช้งาน Dutying',
        webAction: 'สร้างตารางเวรบนเว็บ',
        appAction: 'ดาวน์โหลดแอป',
        heroImage: '/img/landing-hero-en.webp',
    },
    vi: {
        eyebrow: 'Lịch trực điều dưỡng AI',
        actionsLabel: 'Bắt đầu với Dutying',
        webAction: 'Tạo lịch trực trên web',
        appAction: 'Tải ứng dụng',
        heroImage: '/img/landing-hero-en.webp',
    },
};
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
const getMarketingHeading = (page: TMarketingPage) => page.title.split(' | ')[0] ?? page.title;
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
        <link rel="alternate" hreflang="x-default" href="${getCanonicalUrl(appSiteUrl, englishMarketingPage.path)}" />

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
const createMarketingFallback = (page: TMarketingPage) => {
    const copy = marketingFallbackCopyByLanguage[page.language];

    return `<!-- MARKETING_FALLBACK_START -->
            <style>
                .marketing-fallback { box-sizing: border-box; min-height: 100vh; background: #f8f5ff; color: #150b3c; font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; }
                .marketing-fallback * { box-sizing: border-box; }
                .marketing-fallback__header { display: flex; height: 64px; align-items: center; background: #fff; padding: 0 20px; }
                .marketing-fallback__header-inner { width: 100%; max-width: 1180px; margin: 0 auto; }
                .marketing-fallback__logo { display: block; width: auto; height: 29px; }
                .marketing-fallback__hero { display: grid; min-height: calc(100vh - 64px); align-items: center; gap: 40px; max-width: 1180px; margin: 0 auto; padding: 56px 20px 40px; }
                .marketing-fallback__content { position: relative; z-index: 1; max-width: 620px; }
                .marketing-fallback__eyebrow { margin: 0 0 16px; color: #7047eb; font-size: 15px; font-weight: 800; letter-spacing: -.01em; }
                .marketing-fallback__title { margin: 0; color: #150b3c; font-size: clamp(34px, 7vw, 56px); font-weight: 850; letter-spacing: -.045em; line-height: 1.16; word-break: keep-all; }
                .marketing-fallback__description { max-width: 600px; margin: 24px 0 0; color: #5f557f; font-size: 17px; font-weight: 500; letter-spacing: -.02em; line-height: 1.75; word-break: keep-all; }
                .marketing-fallback__actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 36px; }
                .marketing-fallback__action { display: inline-flex; min-height: 48px; align-items: center; justify-content: center; border-radius: 10px; padding: 0 22px; font-size: 15px; font-weight: 800; text-decoration: none; transition: background-color 160ms ease, color 160ms ease, transform 160ms ease; }
                .marketing-fallback__action--primary { background: #17131f; color: #fff; }
                .marketing-fallback__action--secondary { background: #ebe4ff; color: #5c3dc4; }
                .marketing-fallback__action--primary:hover, .marketing-fallback__action--primary:focus-visible { background: #7047eb; color: #fff; transform: translateY(-2px); }
                .marketing-fallback__action--secondary:hover, .marketing-fallback__action--secondary:focus-visible { background: #dcd0ff; color: #3b237f; transform: translateY(-2px); }
                .marketing-fallback__action:focus-visible { outline: none; }
                .marketing-fallback__visual { display: flex; align-items: center; justify-content: center; min-width: 0; }
                .marketing-fallback__visual img { display: block; width: min(100%, 620px); height: auto; }
                @media (min-width: 768px) {
                    .marketing-fallback__header { height: 72px; padding: 0 32px; }
                    .marketing-fallback__logo { height: 32px; }
                    .marketing-fallback__hero { min-height: calc(100vh - 72px); grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); gap: 56px; padding: 72px 32px 56px; }
                    .marketing-fallback__title { font-size: clamp(48px, 4.2vw, 62px); }
                    .marketing-fallback__description { font-size: 18px; }
                    .marketing-fallback__visual img { width: 116%; max-width: 720px; }
                }
                @media (max-width: 767px) {
                    .marketing-fallback__hero { align-content: center; }
                    .marketing-fallback__visual { margin: 0 -8px; }
                    .marketing-fallback__actions { display: grid; }
                    .marketing-fallback__action { width: 100%; }
                }
                @media (prefers-reduced-motion: reduce) { .marketing-fallback__action { transition: none; } }
                @media (forced-colors: active) { .marketing-fallback__action:focus-visible { outline: 2px solid ButtonText; outline-offset: 3px; } }
            </style>
            <main data-marketing-fallback class="marketing-fallback">
                <header class="marketing-fallback__header">
                    <div class="marketing-fallback__header-inner">
                        <img class="marketing-fallback__logo" src="/img/group-19.png" alt="Dutying" width="181" height="65" />
                    </div>
                </header>
                <section class="marketing-fallback__hero" aria-labelledby="marketing-fallback-title">
                    <div class="marketing-fallback__content">
                        <p class="marketing-fallback__eyebrow">${escapeHtml(copy.eyebrow)}</p>
                        <h1 id="marketing-fallback-title" class="marketing-fallback__title">${escapeHtml(getMarketingHeading(page))}</h1>
                        <p class="marketing-fallback__description">${escapeHtml(page.description)}</p>
                        <nav class="marketing-fallback__actions" aria-label="${escapeHtml(copy.actionsLabel)}">
                            <a class="marketing-fallback__action marketing-fallback__action--primary" href="/login?next=%2Fmake">${escapeHtml(copy.webAction)}</a>
                            <a class="marketing-fallback__action marketing-fallback__action--secondary" href="#app">${escapeHtml(copy.appAction)}</a>
                        </nav>
                    </div>
                    <picture class="marketing-fallback__visual">
                        <img src="${copy.heroImage}" alt="${escapeHtml(page.imageAlt)}" width="1800" height="1127" fetchpriority="high" />
                    </picture>
                </section>
            </main>
            <!-- MARKETING_FALLBACK_END -->`;
};
const renderMarketingSeoHtml = (html: string, page: TMarketingPage, appSiteUrl: string, robots: string) =>
    html
        .replace(/<html lang="[^"]*">/, `<html lang="${page.language}">`)
        .replace(marketingSeoBlockPattern, createMarketingSeoBlock(page, appSiteUrl, robots))
        .replace(marketingFallbackPattern, createMarketingFallback(page));
const createSitemap = (appSiteUrl: string) => {
    const localizedUrls = marketingPages
        .map((page) => {
            const alternates = marketingPages
                .map(
                    (alternatePage) =>
                        `    <xhtml:link rel="alternate" hreflang="${alternatePage.language}" href="${getCanonicalUrl(appSiteUrl, alternatePage.path)}" />`,
                )
                .join('\n');

            return `  <url>\n    <loc>${getCanonicalUrl(appSiteUrl, page.path)}</loc>\n${alternates}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${getCanonicalUrl(appSiteUrl, englishMarketingPage.path)}" />\n  </url>`;
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
                    // 원래 요청 주소를 우선해야 언어별 랜딩에서도 올바른 메타데이터가 나온다.
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
                            : indexHtml.replace(marketingFallbackPattern, '');

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
