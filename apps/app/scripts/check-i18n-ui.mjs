import puppeteer from 'puppeteer';

const baseUrl = process.env.I18N_UI_BASE_URL ?? 'https://127.0.0.1:3000';
const routes = (process.env.I18N_UI_ROUTES ?? '/login,/')
    .split(',')
    .map((route) => route.trim())
    .filter(Boolean);
const languages = ['ko', 'ja', 'en', 'zh', 'th'];
const viewports = [
    {name: 'mobile', width: 390, height: 844},
    {name: 'desktop', width: 1440, height: 1000},
];

const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--ignore-certificate-errors', '--no-sandbox', '--disable-setuid-sandbox'],
});

const results = [];

try {
    for (const viewport of viewports) {
        for (const route of routes) {
            for (const language of languages) {
                const page = await browser.newPage();
                await page.setViewport({width: viewport.width, height: viewport.height, deviceScaleFactor: 1});

                const separator = route.includes('?') ? '&' : '?';
                const url = `${baseUrl}${route}${separator}lng=${language}`;

                try {
                    await page.goto(url, {waitUntil: 'networkidle2', timeout: 20_000});
                    await page.evaluate(() => document.fonts?.ready);

                    const check = await page.evaluate(() => {
                        const isVisible = (element) => {
                            const style = window.getComputedStyle(element);
                            const rect = element.getBoundingClientRect();
                            return (
                                !element.closest('[aria-hidden="true"]') &&
                                !element.classList.contains('text-highlight-soft') &&
                                style.visibility !== 'hidden' &&
                                style.display !== 'none' &&
                                rect.width > 1 &&
                                rect.height > 1
                            );
                        };

                        const overflow = Array.from(document.querySelectorAll('button,a,label,input,h1,p,span'))
                            .filter((element) => isVisible(element))
                            .map((element) => {
                                const rect = element.getBoundingClientRect();
                                const text = (
                                    element.textContent ||
                                    element.getAttribute('placeholder') ||
                                    element.getAttribute('aria-label') ||
                                    ''
                                )
                                    .replace(/\s+/g, ' ')
                                    .trim();

                                return {
                                    tag: element.tagName.toLowerCase(),
                                    text,
                                    width: Math.round(rect.width),
                                    height: Math.round(rect.height),
                                    xOverflow: element.scrollWidth - element.clientWidth,
                                    yOverflow: element.scrollHeight - element.clientHeight,
                                };
                            })
                            .filter((item) => item.text.length > 0 && (item.xOverflow > 2 || item.yOverflow > 2));

                        return {
                            lang: document.documentElement.lang,
                            sample: (document.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 220),
                            overflow,
                        };
                    });

                    results.push({route, requestedLanguage: language, viewport: viewport.name, ok: check.overflow.length === 0, ...check});
                } catch (error) {
                    results.push({route, requestedLanguage: language, viewport: viewport.name, ok: false, error: error.message});
                } finally {
                    await page.close();
                }
            }
        }
    }
} finally {
    await browser.close();
}

const failures = results.filter((result) => !result.ok);

console.log(JSON.stringify(results, null, 2));

if (failures.length > 0) {
    console.error(`i18n UI check failed: ${failures.length} case(s) have load errors or visible text overflow.`);
    process.exit(1);
}
