import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};
const assertContains = (html, value, file) => assert(html.includes(value), `${file}: ${value} 누락`);
const countMatches = (value, pattern) => value.match(pattern)?.length ?? 0;

const collectHtmlFiles = (directory) =>
    readdirSync(resolve(root, directory), {withFileTypes: true}).flatMap((entry) => {
        const relativePath = `${directory}/${entry.name}`;

        if (entry.isDirectory()) return collectHtmlFiles(relativePath);

        return entry.name.endsWith('.html') ? [relativePath] : [];
    });

const appHtmlFiles = collectHtmlFiles('apps/app/dist').filter((file) => !file.endsWith('/404.html'));
const marketingPages = JSON.parse(read('apps/app/src/shared/seo/marketing-pages.json')).pages;
const marketingPageByFile = new Map(
    marketingPages.map((page) => [page.path === '/' ? 'apps/app/dist/index.html' : `apps/app/dist${page.path}.html`, page]),
);
const marketingTitles = new Set();
const marketingDescriptions = new Set();

for (const file of appHtmlFiles) {
    const html = read(file);
    const marketingPage = marketingPageByFile.get(file);
    const canonicalPath = marketingPage?.path ?? '/';
    const canonicalUrl = canonicalPath === '/' ? 'https://www.dutying.ai/' : `https://www.dutying.ai${canonicalPath}`;

    assertContains(html, '<meta name="robots" content="index, follow"', file);
    assertContains(html, `<link rel="canonical" href="${canonicalUrl}"`, file);

    if (marketingPage) {
        const marketingHeading = marketingPage.title.split(' | ')[0] ?? marketingPage.title;

        assertContains(html, `<html lang="${marketingPage.language}"`, file);
        assertContains(html, `<title>${marketingPage.title}</title>`, file);
        assertContains(html, `<meta name="description" content="${marketingPage.description}"`, file);
        assertContains(html, 'data-marketing-fallback', file);
        assertContains(html, marketingHeading, file);
        assert(countMatches(html, /<h1(?:\s|>)/g) === 1, `${file}: 최초 HTML의 H1은 정확히 하나여야 함`);
        assert(!marketingTitles.has(marketingPage.title), `${file}: 검색 제목 중복`);
        assert(!marketingDescriptions.has(marketingPage.description), `${file}: 검색 설명 중복`);

        for (const alternatePage of marketingPages) {
            const alternateUrl = alternatePage.path === '/' ? 'https://www.dutying.ai/' : `https://www.dutying.ai${alternatePage.path}`;

            assertContains(html, `<link rel="alternate" hreflang="${alternatePage.language}" href="${alternateUrl}"`, file);
        }

        assertContains(html, '<link rel="alternate" hreflang="x-default" href="https://www.dutying.ai/en"', file);
        assertContains(html, `"inLanguage":"${marketingPage.schemaLanguage}"`, file);
        marketingTitles.add(marketingPage.title);
        marketingDescriptions.add(marketingPage.description);
    } else {
        assert(!html.includes('data-marketing-fallback'), `${file}: 앱 내부 경로에 검색용 랜딩 fallback이 남아 있음`);
    }
}

assert(!existsSync(resolve(root, 'apps/landing')), '은퇴한 apps/landing 디렉터리가 남아 있음');

assert(existsSync(resolve(root, 'apps/app/dist/404.html')), '앱 404.html 누락');
assertContains(read('apps/app/dist/404.html'), '<meta name="robots" content="noindex, follow"', 'apps/app/dist/404.html');
assert(existsSync(resolve(root, 'apps/app/dist/sitemap.xml')), 'www 앱 sitemap.xml 누락');
assertContains(read('apps/app/dist/robots.txt'), 'Allow: /', 'apps/app/dist/robots.txt');
assertContains(read('apps/app/dist/robots.txt'), 'Sitemap: https://www.dutying.ai/sitemap.xml', 'apps/app/dist/robots.txt');

const appSitemap = read('apps/app/dist/sitemap.xml');

for (const url of [
    ...marketingPages.map((page) => (page.path === '/' ? 'https://www.dutying.ai/' : `https://www.dutying.ai${page.path}`)),
    'https://www.dutying.ai/privacy',
    'https://www.dutying.ai/terms',
]) {
    assertContains(appSitemap, `<loc>${url}</loc>`, 'apps/app/dist/sitemap.xml');
}

for (const page of marketingPages) {
    const alternateUrl = page.path === '/' ? 'https://www.dutying.ai/' : `https://www.dutying.ai${page.path}`;

    assertContains(
        appSitemap,
        `<xhtml:link rel="alternate" hreflang="${page.language}" href="${alternateUrl}" />`,
        'apps/app/dist/sitemap.xml',
    );
}

assertContains(
    appSitemap,
    '<xhtml:link rel="alternate" hreflang="x-default" href="https://www.dutying.ai/en" />',
    'apps/app/dist/sitemap.xml',
);

const appRedirects = read('apps/app/dist/_redirects');

assertContains(appRedirects, '/dutying/notices/:noticeId / 200', 'apps/app/dist/_redirects');
assert(!appRedirects.includes('/* /index.html 200'), '전체 SPA fallback 규칙이 남아 있음');
assert(!appRedirects.includes('/ https://www.dutying.ai'), '앱 루트가 www에서 자기 자신으로 리디렉션될 수 있음');

const appVercelConfig = JSON.parse(read('apps/app/vercel.json'));

assert(
    !(appVercelConfig.redirects ?? []).some(({source}) => source === '/'),
    'apps/app/vercel.json: 호스트 구분 없는 루트 리디렉션이 남아 있음',
);

const docsPages = [
    'apps/docs/.vitepress/dist/index.html',
    'apps/docs/.vitepress/dist/troubleshooting/faq.html',
    'apps/docs/.vitepress/dist/web-guide/index.html',
];

for (const file of docsPages) {
    const html = read(file);

    assertContains(html, '<title>', file);
    assertContains(html, '<meta name="description"', file);
    assertContains(html, '<link rel="canonical"', file);
    assertContains(html, '<h1', file);
    assertContains(html, '<body', file);
}

console.log(`SEO build verification passed: ${appHtmlFiles.length} indexed www app routes, ${docsPages.length} docs pages.`);
