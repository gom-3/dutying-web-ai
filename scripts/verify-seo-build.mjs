import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};
const assertContains = (html, value, file) => assert(html.includes(value), `${file}: ${value} 누락`);

const collectHtmlFiles = (directory) =>
    readdirSync(resolve(root, directory), {withFileTypes: true}).flatMap((entry) => {
        const relativePath = `${directory}/${entry.name}`;

        if (entry.isDirectory()) return collectHtmlFiles(relativePath);

        return entry.name.endsWith('.html') ? [relativePath] : [];
    });

const appHtmlFiles = collectHtmlFiles('apps/app/dist').filter((file) => !file.endsWith('/404.html'));

for (const file of appHtmlFiles) {
    const html = read(file);

    assertContains(html, '<meta name="robots" content="index, follow"', file);
    assertContains(html, '<link rel="canonical" href="https://www.dutying.ai/"', file);
}

assert(existsSync(resolve(root, 'apps/app/dist/404.html')), '앱 404.html 누락');
assertContains(read('apps/app/dist/404.html'), '<meta name="robots" content="noindex, follow"', 'apps/app/dist/404.html');
assert(existsSync(resolve(root, 'apps/app/dist/sitemap.xml')), 'www 앱 sitemap.xml 누락');
assertContains(read('apps/app/dist/robots.txt'), 'Allow: /', 'apps/app/dist/robots.txt');
assertContains(read('apps/app/dist/robots.txt'), 'Sitemap: https://www.dutying.ai/sitemap.xml', 'apps/app/dist/robots.txt');

const appSitemap = read('apps/app/dist/sitemap.xml');

for (const url of ['https://www.dutying.ai/', 'https://www.dutying.ai/privacy', 'https://www.dutying.ai/terms']) {
    assertContains(appSitemap, `<loc>${url}</loc>`, 'apps/app/dist/sitemap.xml');
}

const appRedirects = read('apps/app/dist/_redirects');

assertContains(appRedirects, '/dutying/notices/:noticeId /index.html 200', 'apps/app/dist/_redirects');
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
