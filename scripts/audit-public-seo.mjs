// Read-only audit. Run after publishing: pnpm run audit:seo
// Findings describe public HTTP responses, not indexing or ranking guarantees.
import marketingPageData from '../apps/app/src/shared/seo/marketing-pages.json' with {type: 'json'};

const origin = 'https://www.dutying.ai';
const docsOrigin = 'https://docs.dutying.ai';
const publicMarketingUrls = marketingPageData.pages.flatMap((page) => [`${origin}${page.path}`, `${origin}${page.nurseApp.path}`]);
const targets = [
    ...publicMarketingUrls.map((url) => ({url, canonical: url, publicPage: true})),
    {url: `${origin}/login`, canonical: `${origin}/login`, publicPage: false},
    ...['/', '/guides/nurse-scheduling', '/troubleshooting/faq'].map((path) => ({
        url: `${docsOrigin}${path}`,
        canonical: `${docsOrigin}${path}`,
        publicPage: true,
    })),
    {url: 'https://www.dutying.net/', redirect: `${origin}/`},
    {url: 'https://www.dutying.net/login?next=%2Fmake', redirect: `${origin}/login?next=%2Fmake`},
    {url: `${origin}/robots.txt`, text: `Sitemap: ${origin}/sitemap.xml`},
    {url: `${docsOrigin}/robots.txt`, text: `Sitemap: ${docsOrigin}/sitemap.xml`},
    {url: `${origin}/sitemap.xml`, sitemapOrigin: origin},
    {url: `${docsOrigin}/sitemap.xml`, sitemapOrigin: docsOrigin},
];

const audit = async (target) => {
    const issues = [];
    const response = await fetch(target.url, {redirect: 'manual', signal: AbortSignal.timeout(20000)});
    const body = await response.text();
    if (target.redirect) {
        if (![301, 308].includes(response.status)) issues.push('Expected a permanent redirect (301/308)');
        if (response.headers.get('location') !== target.redirect) issues.push(`Unexpected redirect: ${response.headers.get('location')}`);
    } else {
        if (response.status !== 200) issues.push(`Expected HTTP 200, received ${response.status}`);
        if (target.canonical) {
            const canonical = body.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
            if (canonical !== target.canonical) issues.push(`Unexpected canonical: ${canonical}`);
            const robots = body.match(/<meta\b[^>]*name="robots"[^>]*content="([^"]+)"/)?.[1] ?? '';
            const headerRobots = response.headers.get('x-robots-tag') ?? '';
            if (target.publicPage) {
                if (/noindex/i.test(`${robots} ${headerRobots}`)) issues.push('Public page is noindex');
                if (!/<h1(?:\s|>)/.test(body)) issues.push('No H1 in initial HTML');
                const blocks = [...body.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
                if (!blocks.length) issues.push('No JSON-LD in initial HTML');
                for (const [, block] of blocks) {
                    try {
                        JSON.parse(block);
                    } catch {
                        issues.push('Invalid JSON-LD');
                    }
                }
            } else if (!/noindex/i.test(`${robots} ${headerRobots}`)) {
                issues.push('App route is indexable');
            }
        }
        if (target.text && !body.includes(target.text)) issues.push(`Missing: ${target.text}`);
        if (target.sitemapOrigin) {
            const urls = [...body.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
            if (!urls.length) issues.push('Sitemap has no URLs');
            if (urls.some((url) => !url.startsWith(`${target.sitemapOrigin}/`))) issues.push('Sitemap contains a different host');
            if (
                target.sitemapOrigin === origin &&
                (urls.length !== publicMarketingUrls.length || publicMarketingUrls.some((url) => !urls.includes(url)))
            )
                issues.push('App sitemap does not match the public marketing routes');
            if (target.sitemapOrigin === docsOrigin && !urls.includes(`${docsOrigin}/guides/nurse-scheduling`))
                issues.push('Guide missing from docs sitemap');
        }
    }
    return {url: target.url, status: response.status, issues};
};

// Bounded concurrency and timeout: this never requests indexing or changes hosting.
const results = [];
for (let index = 0; index < targets.length; index += 4) {
    const batch = await Promise.allSettled(targets.slice(index, index + 4).map(audit));
    batch.forEach((result, offset) =>
        results.push(result.status === 'fulfilled' ? result.value : {url: targets[index + offset].url, issues: [String(result.reason)]}),
    );
}
console.log(JSON.stringify({checkedAt: new Date().toISOString(), results}, null, 2));
process.exitCode = results.some((result) => result.issues.length) ? 1 : 0;
