import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {defineConfig} from 'vitepress';
import {docsSiteLinks} from './site.mts';

const docsTitle = '듀팅 사용 가이드';
const docsDescription = '듀팅의 간호사 근무표 작성, AI 자동 생성, 신청근무 관리와 교대근무 캘린더 사용법을 안내합니다.';
const isProductionSite =
    docsSiteLinks.docs === 'https://docs.dutying.ai' &&
    !(process.env.CF_PAGES === '1' && process.env.CF_PAGES_BRANCH !== 'main') &&
    !(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production');
const docsOgImage = `${docsSiteLinks.docs}/og-image.png`;
const getDocsRoutePath = (relativePath: string) => {
    if (!relativePath || relativePath === 'index.md') {
        return '/';
    }

    const routePath = `/${relativePath.replace(/\.md$/, '')}`;

    return routePath.endsWith('/index') ? `${routePath.slice(0, -'index'.length)}` : routePath;
};

const webGuideSidebar = [
    {
        text: '개요',
        items: [{text: '웹 사용자 가이드', link: '/web-guide/'}],
    },
    {
        text: '계정 시작',
        items: [
            {text: '로그인', link: '/web-guide/login'},
            {text: '회원가입', link: '/web-guide/register'},
        ],
    },
    {
        text: '병동 시작',
        items: [{text: '병동 생성/입장', link: '/web-guide/wards'}],
    },
    {
        text: '근무표 운영',
        items: [
            {text: '근무표 만들기', link: '/web-guide/schedule'},
            {text: '신청근무 관리', link: '/web-guide/requests'},
            {text: '간호사 관리', link: '/web-guide/nurses'},
        ],
    },
];

export default defineConfig({
    lang: 'ko-KR',
    title: docsTitle,
    description: docsDescription,
    cleanUrls: true,
    lastUpdated: true,
    srcExclude: ['README.md', 'CHANGELOG.md'],
    sitemap: isProductionSite ? {hostname: `${docsSiteLinks.docs}/`} : undefined,
    buildEnd: ({outDir}) => {
        writeFileSync(
            resolve(outDir, 'robots.txt'),
            isProductionSite ? `User-agent: *\nAllow: /\nSitemap: ${docsSiteLinks.docs}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n',
        );
    },
    head: [['link', {rel: 'icon', href: '/favicon.ico', sizes: 'any'}]],
    transformHead: ({pageData}) => {
        const pageUrl = new URL(getDocsRoutePath(pageData.relativePath), `${docsSiteLinks.docs}/`).toString();
        const pageTitle = pageData.title && pageData.title !== docsTitle ? `${pageData.title} | ${docsTitle}` : docsTitle;
        const pageDescription = pageData.description || docsDescription;

        const isNotFound = pageData.relativePath === '404.md';
        const breadcrumbs = [
            {name: docsTitle, item: `${docsSiteLinks.docs}/`},
            ...(pageUrl === `${docsSiteLinks.docs}/` ? [] : [{name: pageData.title, item: pageUrl}]),
        ];
        const structuredData = {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'WebSite',
                    '@id': `${docsSiteLinks.docs}/#website`,
                    name: docsTitle,
                    url: `${docsSiteLinks.docs}/`,
                    inLanguage: 'ko-KR',
                    publisher: {'@id': `${docsSiteLinks.marketing}/#organization`},
                },
                {
                    '@type': 'WebPage',
                    '@id': `${pageUrl}#webpage`,
                    name: pageTitle,
                    description: pageDescription,
                    url: pageUrl,
                    inLanguage: 'ko-KR',
                    isPartOf: {'@id': `${docsSiteLinks.docs}/#website`},
                    about: {'@id': `${docsSiteLinks.marketing}/#software-application`},
                    breadcrumb: {'@id': `${pageUrl}#breadcrumb`},
                },
                {
                    '@type': 'BreadcrumbList',
                    '@id': `${pageUrl}#breadcrumb`,
                    itemListElement: breadcrumbs.map((item, index) => ({'@type': 'ListItem', position: index + 1, ...item})),
                },
            ],
        };

        return [
            ...(isProductionSite && pageData.relativePath === 'index.md'
                ? ([['meta', {name: 'naver-site-verification', content: '95c802956a318d4f270de0fb105c30c05ca74900'}]] as [string, Record<string, string>][])
                : []),
            ['meta', {name: 'robots', content: isProductionSite && !isNotFound ? 'index, follow' : 'noindex, follow'}],
            ...(!isNotFound ? ([['link', {rel: 'canonical', href: pageUrl}]] as [string, Record<string, string>][]) : []),
            ...(!isNotFound
                ? ([['script', {type: 'application/ld+json'}, JSON.stringify(structuredData).replace(/</g, '\\u003c')]] as [
                      string,
                      Record<string, string>,
                      string,
                  ][])
                : []),
            ['meta', {name: 'title', content: pageTitle}],
            ['meta', {property: 'og:type', content: 'website'}],
            ['meta', {property: 'og:title', content: pageTitle}],
            ['meta', {property: 'og:description', content: pageDescription}],
            ['meta', {property: 'og:url', content: pageUrl}],
            ['meta', {property: 'og:image', content: docsOgImage}],
            ['meta', {property: 'og:image:alt', content: '듀팅 사용자 가이드 대표 이미지'}],
            ['meta', {name: 'twitter:card', content: 'summary_large_image'}],
            ['meta', {name: 'twitter:title', content: pageTitle}],
            ['meta', {name: 'twitter:description', content: pageDescription}],
            ['meta', {name: 'twitter:image', content: docsOgImage}],
        ];
    },
    themeConfig: {
        logo: '/logo.svg',
        siteTitle: docsTitle,
        nav: [
            {text: '시작하기', link: '/getting-started/'},
            {text: '간호사 근무표 작성 가이드', link: '/guides/nurse-scheduling'},
            {text: '웹 사용자 가이드', link: '/web-guide/'},
            {text: '모바일 가이드', link: '/mobile-guide/'},
            {text: 'FAQ', link: '/troubleshooting/faq'},
            {text: '앱 열기', link: docsSiteLinks.app},
            {text: '랜딩 보기', link: docsSiteLinks.marketing},
        ],
        sidebar: {
            '/guides/': [{text: '근무표 작성 가이드', items: [{text: '간호사 근무표 자동 생성', link: '/guides/nurse-scheduling'}]}],
            '/getting-started/': [
                {
                    text: '시작하기',
                    items: [{text: '듀팅 시작하기', link: '/getting-started/'}],
                },
            ],
            '/web-guide/': webGuideSidebar,
            '/mobile-guide/': [
                {
                    text: '모바일 가이드',
                    items: [{text: '교대근무 캘린더 사용법', link: '/mobile-guide/'}],
                },
            ],
            '/troubleshooting/': [
                {
                    text: '문제 해결',
                    items: [{text: 'FAQ', link: '/troubleshooting/faq'}],
                },
            ],
        },
        search: {
            provider: 'local',
        },
        socialLinks: [{icon: 'instagram', link: 'https://www.instagram.com/dutying_official/'}],
        outline: {
            label: '이 페이지에서',
        },
        docFooter: {
            prev: '이전 문서',
            next: '다음 문서',
        },
        footer: {
            message: '듀팅 · 간호사 근무표와 교대근무 관리',
            copyright: 'Copyright © Dutying',
        },
    },
});
