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

// Naver's ownership challenge is a literal verification response, not an HTML page.
const isSiteVerificationFile = (file) => {
    const match = file.match(/\/(naver[0-9a-f]{32}\.html)$/);
    if (!match) return false;
    assert(read(file) === `naver-site-verification: ${match[1]}`, `${file}: 네이버 소유 확인 응답 불일치`);
    return true;
};

if (process.argv[2] === '--preview') {
    const directories = process.argv.slice(3);
    assert(directories.length === 2, 'preview 앱·문서 빌드 폴더를 지정하세요');
    for (const directory of directories) {
        const files = collectHtmlFiles(directory).filter((file) => !isSiteVerificationFile(file));
        assert(files.length > 0, `${directory}: HTML이 없음`);
        for (const file of files) {
            assert(/<meta name="robots" content="noindex[, "]/.test(read(file)), `${file}: preview가 indexable함`);
        }
        assertContains(read(`${directory}/robots.txt`), 'Disallow: /', `${directory}/robots.txt`);
        assert(!existsSync(resolve(root, directory, 'sitemap.xml')), `${directory}: preview sitemap이 발행됨`);
    }
    console.log('Preview SEO verification passed: noindex HTML, blocked robots, no sitemaps.');
    process.exit(0);
}

assert(existsSync(resolve(root, 'apps/app/dist/legacy-roster.html')), '개인 근무표 이전 직접 진입 HTML 누락');

const appHtmlFiles = collectHtmlFiles('apps/app/dist').filter((file) => !file.endsWith('/404.html') && !isSiteVerificationFile(file));
assert(existsSync(resolve(root, 'apps/app/dist/naverb0ecf482534f7fa837c88fc96af7e302.html')), '네이버 .ai 사이트 소유 확인 파일 누락');
const homePages = JSON.parse(read('apps/app/src/shared/seo/marketing-pages.json')).pages;
const nurseAppPages = homePages.map(({nurseApp, ...page}) => ({...page, ...nurseApp}));
const marketingGroups = [homePages, nurseAppPages];
const marketingPageUrl = (path) => `https://www.dutying.ai${path}`;
const marketingPageByFile = new Map(
    marketingGroups.flatMap((group) =>
        group.map((page) => [page.path === '/' ? 'apps/app/dist/index.html' : `apps/app/dist${page.path}.html`, {page, group}]),
    ),
);
const marketingTitles = new Set();
const marketingDescriptions = new Set();

for (const file of appHtmlFiles) {
    const html = read(file);
    const marketingEntry = marketingPageByFile.get(file);
    const marketingPage = marketingEntry?.page;
    const canonicalPath = marketingPage?.path ?? file.replace('apps/app/dist', '').replace(/\.html$/, '');
    const canonicalUrl = canonicalPath === '/' ? 'https://www.dutying.ai/' : `https://www.dutying.ai${canonicalPath}`;

    assertContains(
        html,
        marketingPage ? '<meta name="robots" content="index, follow"' : '<meta name="robots" content="noindex, follow"',
        file,
    );
    if (file.endsWith('/app-shell.html')) {
        assert(!html.includes('rel="canonical"'), `${file}: 동적 앱 셸에 잘못된 canonical이 있음`);
    } else {
        assertContains(html, `<link rel="canonical" href="${canonicalUrl}"`, file);
    }

    if (marketingEntry) {
        const {page, group} = marketingEntry;
        const landingData = JSON.parse(
            html.match(/<script id="landing-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1] ?? 'null',
        );
        assert(landingData?.language === page.language, `${file}: 랜딩 hydration 언어 불일치`);

        assertContains(html, `<html lang="${page.language}"`, file);
        assertContains(html, `<title>${page.title}</title>`, file);
        assertContains(html, `<meta name="description" content="${page.description}"`, file);
        assertContains(html, 'data-rendered="landing"', file);
        assertContains(html, 'landing-main--responsive', file);
        assertContains(html, 'id="app"', file);
        assertContains(html, 'id="mobile-app-download"', file);
        assertContains(html, 'rel="stylesheet"', file);
        assert(!html.includes('marketing-fallback'), `${file}: 검색용 임시 화면이 남아 있음`);
        assert(!html.includes('is-reveal-pending'), `${file}: 초기 HTML의 본문이 숨겨져 있음`);
        assert(!html.includes('<!--$!-->'), `${file}: 미완성 Suspense fallback이 정적 HTML에 남아 있음`);
        assert(countMatches(html, /<h1(?:\s|>)/g) === 1, `${file}: 최초 HTML의 H1은 정확히 하나여야 함`);
        assert(!marketingTitles.has(page.title), `${file}: 검색 제목 중복`);
        assert(!marketingDescriptions.has(page.description), `${file}: 검색 설명 중복`);

        if (group === homePages) {
            assertContains(html, 'id="web"', file);
            assertContains(html, 'href="/login?next=%2Fmake"', file);
            assertContains(html, `href="${page.nurseApp.path}"`, file);
            assertContains(html, 'href="https://docs.dutying.ai/guides/nurse-scheduling"', file);
            assertContains(html, 'href="https://docs.dutying.ai/troubleshooting/faq"', file);
        } else {
            assert(!html.includes('id="web"'), `${file}: 관리자 웹 소개가 간호사 앱에 남아 있음`);
            assertContains(html, `href="${page.iosStoreUrl}"`, file);
            assertContains(html, `href="${page.androidStoreUrl.replaceAll('&', '&amp;')}"`, file);
        }

        for (const alternatePage of group) {
            assertContains(
                html,
                `<link rel="alternate" hreflang="${alternatePage.language}" href="${marketingPageUrl(alternatePage.path)}"`,
                file,
            );
        }

        const defaultUrl = marketingPageUrl(group.find((alternatePage) => alternatePage.language === 'en').path);

        assertContains(html, `<link rel="alternate" hreflang="x-default" href="${defaultUrl}"`, file);
        assert(
            countMatches(html, /<link rel="alternate" hreflang=/g) === group.length + 1,
            `${file}: 다른 페이지 그룹의 hreflang이 포함됨`,
        );
        assertContains(html, `"inLanguage":"${page.schemaLanguage}"`, file);
        const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? 'null')?.['@graph'];
        assert(Array.isArray(graph), `${file}: JSON-LD graph 누락`);
        const website = graph.find((node) => node['@type'] === 'WebSite');
        const webpage = graph.find((node) => node['@type'] === 'WebPage');
        assert(website?.['@id'] === 'https://www.dutying.ai/#website', `${file}: 언어마다 WebSite ID가 달라짐`);
        assert(website?.name === '듀팅' && website?.alternateName === 'Dutying', `${file}: 사이트 브랜드명 누락`);
        assert(webpage?.url === canonicalUrl && webpage?.name === page.title, `${file}: WebPage 내용 불일치`);
        marketingTitles.add(page.title);
        marketingDescriptions.add(page.description);
    } else {
        assert(!html.includes('data-rendered="landing"'), `${file}: 앱 내부 경로에 랜딩이 남아 있음`);
        assert(!html.includes('application/ld+json'), `${file}: 앱 내부 경로에 홈 구조화 데이터가 남아 있음`);
        assert(!html.includes('hreflang='), `${file}: 앱 내부 경로에 홈 언어 대체 링크가 남아 있음`);
    }
}

assert(
    !existsSync(resolve(root, 'apps/landing/package.json')) && !existsSync(resolve(root, 'apps/landing/src')),
    '은퇴한 apps/landing 소스가 남아 있음',
);

assert(existsSync(resolve(root, 'apps/app/dist/404.html')), '앱 404.html 누락');
assertContains(read('apps/app/dist/404.html'), '<meta name="robots" content="noindex, follow"', 'apps/app/dist/404.html');
assert(existsSync(resolve(root, 'apps/app/dist/sitemap.xml')), 'www 앱 sitemap.xml 누락');
assertContains(read('apps/app/dist/robots.txt'), 'Allow: /', 'apps/app/dist/robots.txt');
assertContains(read('apps/app/dist/robots.txt'), 'Sitemap: https://www.dutying.ai/sitemap.xml', 'apps/app/dist/robots.txt');

const appSitemap = read('apps/app/dist/sitemap.xml');
const sitemapEntries = [...appSitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/g)];
const sitemapByUrl = new Map(sitemapEntries.map(([, url, alternateLinks]) => [url, alternateLinks]));

assert(sitemapEntries.length === marketingPageByFile.size, '앱 sitemap에 검색용 본문이 없는 경로가 포함됨');

for (const group of marketingGroups) {
    const defaultUrl = marketingPageUrl(group.find((page) => page.language === 'en').path);

    for (const page of group) {
        const url = marketingPageUrl(page.path);
        const alternates = sitemapByUrl.get(url);

        assert(alternates, `앱 sitemap: ${url} 누락`);
        for (const alternatePage of group) {
            assertContains(
                alternates,
                `<xhtml:link rel="alternate" hreflang="${alternatePage.language}" href="${marketingPageUrl(alternatePage.path)}" />`,
                url,
            );
        }

        assertContains(alternates, `<xhtml:link rel="alternate" hreflang="x-default" href="${defaultUrl}" />`, url);
        assert(
            countMatches(alternates, /<xhtml:link rel="alternate" hreflang=/g) === group.length + 1,
            `${url}: 다른 페이지 그룹이 포함됨`,
        );
    }
}

const appRedirects = read('apps/app/dist/_redirects');

assertContains(appRedirects, '/dutying/notices/:noticeId /app-shell 200', 'apps/app/dist/_redirects');
assert(!appRedirects.includes('/* /index.html 200'), '전체 SPA fallback 규칙이 남아 있음');
assert(!appRedirects.includes('/ https://www.dutying.ai'), '앱 루트가 www에서 자기 자신으로 리디렉션될 수 있음');

const appVercelConfig = JSON.parse(read('apps/app/vercel.json'));

assert(
    !(appVercelConfig.redirects ?? []).some(({source}) => source === '/'),
    'apps/app/vercel.json: 호스트 구분 없는 루트 리디렉션이 남아 있음',
);

const docsPages = collectHtmlFiles('apps/docs/.vitepress/dist').filter((file) => !file.endsWith('/404.html'));
const docsTitles = new Set();
const docsDescriptions = new Set();
const docsSitemap = read('apps/docs/.vitepress/dist/sitemap.xml');

for (const file of docsPages) {
    const html = read(file);
    const routePath = file
        .replace('apps/docs/.vitepress/dist', '')
        .replace(/index\.html$/, '')
        .replace(/\.html$/, '');
    const canonicalUrl = `https://docs.dutying.ai${routePath}`;
    const title = html.match(/<title>(.*?)<\/title>/)?.[1];
    const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1];

    assert(title && !docsTitles.has(title), `${file}: 문서 제목 누락 또는 중복`);
    assert(description && !docsDescriptions.has(description), `${file}: 문서 설명 누락 또는 중복`);
    assertContains(html, `<link rel="canonical" href="${canonicalUrl}"`, file);
    assertContains(html, '<meta name="robots" content="index, follow"', file);
    assertContains(html, '<h1', file);
    assertContains(html, '<body', file);
    const structuredData = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? 'null');
    assert(
        structuredData?.['@graph']?.some((node) => node['@type'] === 'BreadcrumbList'),
        `${file}: BreadcrumbList 누락`,
    );
    assert(
        structuredData?.['@graph']?.some((node) => node['@type'] === 'WebPage' && node.url === canonicalUrl),
        `${file}: WebPage URL 불일치`,
    );
    assertContains(docsSitemap, `<loc>${canonicalUrl}</loc>`, 'docs sitemap');
    docsTitles.add(title);
    docsDescriptions.add(description);
}

assertContains(read('apps/docs/.vitepress/dist/404.html'), '<meta name="robots" content="noindex, follow"', 'docs 404');
assertContains(read('apps/docs/.vitepress/dist/robots.txt'), 'Sitemap: https://docs.dutying.ai/sitemap.xml', 'docs robots');
assertContains(read('apps/docs/.vitepress/dist/guides/nurse-scheduling.html'), 'AI가 만든 표는 무엇을 검토하나요?', '근무표 가이드');
assertContains(read('apps/docs/.vitepress/dist/troubleshooting/faq.html'), 'www.dutying.ai', '공식 주소 FAQ');

console.log(
    `SEO build verification passed: ${appHtmlFiles.length} www HTML routes (only public landing pages indexable), ${docsPages.length} docs pages.`,
);
