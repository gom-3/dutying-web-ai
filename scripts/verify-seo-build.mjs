import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};
const assertContains = (html, value, file) => assert(html.includes(value), `${file}: ${value} 누락`);

const publicPages = [
    {
        file: 'apps/landing/dist/index.html',
        title: '듀팅 | 간호사 근무표를 더 간편하게',
        canonical: 'https://www.dutying.ai/',
        h1: '듀팅,',
    },
    {
        file: 'apps/landing/dist/features.html',
        title: '기능 소개 | 간호사 근무표·일정 관리 듀팅',
        canonical: 'https://www.dutying.ai/features',
        h1: '간호사 근무표 작성부터 일정 공유까지',
    },
    {
        file: 'apps/landing/dist/faq.html',
        title: '자주 묻는 질문(FAQ) | 듀팅',
        canonical: 'https://www.dutying.ai/faq',
        h1: '자주 묻는 질문',
    },
    {
        file: 'apps/landing/dist/privacy.html',
        title: '개인정보 처리방침 | 듀팅',
        canonical: 'https://www.dutying.ai/privacy',
        h1: '개인정보 처리방침',
    },
    {
        file: 'apps/landing/dist/terms.html',
        title: '이용약관 | 듀팅',
        canonical: 'https://www.dutying.ai/terms',
        h1: '이용약관',
    },
    {
        file: 'apps/landing/dist/account-deletion.html',
        title: '계정삭제 및 회원 탈퇴 안내 | 듀팅',
        canonical: 'https://www.dutying.ai/account-deletion',
        h1: '듀팅 계정삭제 안내',
    },
    {
        file: 'apps/landing/dist/guide.html',
        title: '듀팅 사용 가이드 | 간호사 근무표 시작하기',
        canonical: 'https://www.dutying.ai/guide',
        h1: '듀팅 사용 가이드',
    },
];

for (const page of publicPages) {
    const html = read(page.file);

    assertContains(html, `<title>${page.title}</title>`, page.file);
    assertContains(html, '<meta name="description" content="', page.file);
    assertContains(html, `<link rel="canonical" href="${page.canonical}">`, page.file);
    assertContains(html, '<h1', page.file);
    assertContains(html, page.h1, page.file);
    assertContains(html, '<main', page.file);
}

const collectHtmlFiles = (directory) =>
    readdirSync(resolve(root, directory), {withFileTypes: true}).flatMap((entry) => {
        const relativePath = `${directory}/${entry.name}`;

        if (entry.isDirectory()) return collectHtmlFiles(relativePath);

        return entry.name.endsWith('.html') ? [relativePath] : [];
    });

const appNoindexFiles = collectHtmlFiles('apps/app/dist');

for (const file of appNoindexFiles) {
    assertContains(read(file), '<meta name="robots" content="noindex, follow"', file);
}

assert(existsSync(resolve(root, 'apps/landing/dist/404.html')), '랜딩 404.html 누락');
assert(existsSync(resolve(root, 'apps/app/dist/404.html')), '앱 404.html 누락');
assert(!existsSync(resolve(root, 'apps/app/dist/sitemap.xml')), 'noindex 앱에 sitemap.xml이 생성됨');
assertContains(read('apps/app/dist/robots.txt'), 'Allow: /', 'apps/app/dist/robots.txt');

const appRedirects = read('apps/app/dist/_redirects');

assertContains(appRedirects, '/dutying/notices/:noticeId /index.html 200', 'apps/app/dist/_redirects');
assert(!appRedirects.includes('/* /index.html 200'), '전체 SPA fallback 규칙이 남아 있음');

const sitemap = read('apps/landing/dist/sitemap-0.xml');

for (const page of publicPages.slice(1)) {
    assertContains(sitemap, `<loc>${page.canonical}</loc>`, 'apps/landing/dist/sitemap-0.xml');
}
assert(!sitemap.includes('/404'), '404 URL이 랜딩 sitemap에 포함됨');

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

console.log(
    `SEO build verification passed: ${publicPages.length} public pages, ${appNoindexFiles.length} noindex app routes, ${docsPages.length} docs pages.`,
);
