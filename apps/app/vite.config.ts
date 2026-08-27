import {fileURLToPath} from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig, loadEnv} from 'vite';
import mkcert from 'vite-plugin-mkcert';
import tsconfigPaths from 'vite-tsconfig-paths';

interface IChunks {
    [key: string]: string[];
}

const renderChunks = (deps: Record<string, string>) => {
    const chunks: IChunks = {};

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
    'ts-pattern': 'ts-pattern',
    yup: 'yup',
    zustand: 'zustand',
};
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));
// 앱의 정식 주소는 www 다. app.dutying.ai 는 같은 프로젝트에 함께 붙여두되
// canonical·sitemap 은 www 하나로 모은다. 서버의 OAuth 리다이렉트 기본값
// (auth.oauth.redirect.default-url = https://www.dutying.ai/) 과 맞춘 값이다.
const defaultAppSiteUrl = 'https://www.dutying.ai';
const defaultPreviewAppSiteUrl = 'https://dev.dutying.ai';
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
    // 운영 도메인으로 빌드된 것만 색인 대상이다. dev/preview/pages.dev 는 제외한다.
    const isProductionSite = appSiteUrl === defaultAppSiteUrl;
    const isWindows = process.platform === 'win32';
    const isTest = mode === 'test';

    return {
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
                transformIndexHtml(html) {
                    return html
                        .split('__APP_SITE_URL__')
                        .join(appSiteUrl)
                        .split('__ROBOTS_META__')
                        .join(isProductionSite ? 'index, follow' : 'noindex, nofollow');
                },
                generateBundle() {
                    // dev/preview 배포는 운영과 같은 앱을 서빙한다. 색인을 열어두면
                    // app.dutying.ai 와 중복 콘텐츠로 경쟁하므로 크롤러를 막는다.
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
