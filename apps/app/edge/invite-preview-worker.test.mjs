import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {INVITE_PAGE_COPY} from '../src/pages/invite-fallback/copy';
import images from './invite-preview-images.json';
import marketingPages from '../src/shared/seo/marketing-pages.json';
import {createInvitePreviewWorker, createPagesWorker, resolvePreviewLanguage} from './invite-preview-worker.mjs';

const data = Object.fromEntries(
    Object.entries(images).map(([language, image]) => [language, {image, invites: INVITE_PAGE_COPY[language].invites}]),
);
const shell = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8').replace(/__APP_SITE_URL__/g, 'https://www.dutying.ai');
const makeAssets = () => ({
    fetch: vi.fn(
        async () =>
            new Response(shell, {
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'X-Content-Type-Options': 'nosniff',
                    ETag: 'static-shell',
                    'Content-Length': '100',
                },
            }),
    ),
});

describe.each([
    {kind: 'friend', path: '/app/friends/invite', origin: 'https://www.dutying.ai'},
    {kind: 'moim', path: '/app/moim/invite', origin: 'https://app.dutying.ai'},
])('$kind invitation metadata', ({kind, path, origin}) => {
    it.each(Object.keys(images))('serves %s image, title and description in the initial HTML without JavaScript', async (language) => {
        const url = `${origin}${path}?code=TEST42&lng=${language}`;
        const assets = makeAssets();
        const response = await createInvitePreviewWorker(data).fetch(new Request(url, {headers: {'Accept-Language': 'ko-KR'}}), {
            ASSETS: assets,
        });
        const document = new DOMParser().parseFromString(await response.text(), 'text/html');
        const copy = INVITE_PAGE_COPY[language].invites[kind];
        const og = (property) => document.querySelector(`meta[property="og:${property}"]`)?.getAttribute('content');

        expect(response.status).toBe(200);
        expect(document.documentElement.lang).toBe(language);
        expect(document.title).toBe(copy.pageTitle);
        expect(og('title')).toBe(copy.pageTitle);
        expect(og('description')).toBe(copy.description);
        expect(og('image')).toBe(origin + images[language].path);
        expect(og('image:width')).toBe(String(images[language].width));
        expect(og('image:height')).toBe(String(images[language].height));
        expect(og('locale')).toBe(images[language].locale);
        expect(og('url')).toBe(url);
        expect(document.querySelector('link[rel="canonical"]').href).toBe(url);
        expect(document.querySelector('meta[name="twitter:title"]').content).toBe(copy.pageTitle);
        expect(document.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
        expect(document.querySelector('meta[name="robots"]').content).toBe('noindex, nofollow');
        expect(document.getElementById('root')).not.toBeNull();
        expect(document.querySelector('script[type="module"]')).not.toBeNull();
        expect(assets.fetch.mock.calls[0][0].url).toBe(origin + '/app-shell');
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        expect(response.headers.get('Vary')).toContain('Accept-Language');
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(response.headers.has('ETag')).toBe(false);
        expect(response.headers.has('Content-Length')).toBe(false);
    });
});

describe('invitation metadata request handling', () => {
    it.each([
        ['?lng=JA-jp', 'en-US', 'ja'],
        ['', 'en-US;q=0.5,vi-VN;q=0.9,ja;q=0', 'vi'],
        ['?lng=fr', 'fr-FR,zh-CN;q=0.8,en;q=0.3', 'zh'],
        ['', 'de-DE,*;q=0.1', 'ko'],
        ['', 'ja;q=NaN,en;q=0.7', 'en'],
    ])('selects the URL language or supported Accept-Language: %s / %s', (search, header, expected) => {
        expect(resolvePreviewLanguage(new URL('https://www.dutying.ai/app/friends/invite' + search), header, data)).toBe(expected);
    });

    it('preserves query parameters safely without treating URL dollars as replacement patterns', async () => {
        const url = new URL('https://www.dutying.ai/app/friends/invite?code=$&lng=ja&extra=%22%3E%3Cscript%3E');
        const response = await createInvitePreviewWorker(data).fetch(new Request(url), {ASSETS: makeAssets()});
        const document = new DOMParser().parseFromString(await response.text(), 'text/html');

        expect(document.querySelector('meta[property="og:url"]').content).toBe(url.href);
        expect(document.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
        expect(document.querySelector('meta[property="og:title"]').content).toBe(INVITE_PAGE_COPY.ja.invites.friend.pageTitle);
    });

    it('supports trailing slashes and HEAD requests', async () => {
        const response = await createInvitePreviewWorker(data).fetch(
            new Request('https://www.dutying.ai/app/moim/invite/?lng=ja', {method: 'HEAD'}),
            {ASSETS: makeAssets()},
        );

        expect(response.status).toBe(200);
        expect(await response.text()).toBe('');
    });

    it.each(['/ja', '/workspace', '/app/notice/5', '/img/og-image-preview222.png'])(
        'passes %s directly to static hosting',
        async (path) => {
            const assets = makeAssets();
            const request = new Request('https://www.dutying.ai' + path);

            await createInvitePreviewWorker(data).fetch(request, {ASSETS: assets});

            expect(assets.fetch).toHaveBeenCalledExactlyOnceWith(request);
        },
    );

    it('passes through an unavailable app shell without hiding its error status', async () => {
        const response = await createInvitePreviewWorker(data).fetch(new Request('https://www.dutying.ai/app/friends/invite?lng=ja'), {
            ASSETS: {fetch: async () => new Response('Missing', {status: 404})},
        });

        expect(response.status).toBe(404);
    });
});

describe('direct home language routing', () => {
    const worker = createPagesWorker(data, {
        ...marketingPages.homeLanguagePreference,
        paths: Object.fromEntries(marketingPages.pages.map(({language, path}) => [language, path])),
    });
    const {cookieName} = marketingPages.homeLanguagePreference;
    const origin = 'https://www.dutying.ai';
    const directHeaders = {
        'Accept-Language': 'ko-KR',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Site': 'none',
    };
    const requestFrom = (country, {url = origin + '/', headers = directHeaders, method = 'GET', verifiedBot = false} = {}) =>
        Object.assign(new Request(url, {headers, method}), {cf: {country, botManagement: {verifiedBot}}});

    it.each([
        ['JP', 'ja'],
        ['US', 'en'],
        ['CN', 'zh'],
        ['TH', 'th'],
        ['VN', 'vi'],
    ])('temporarily redirects %s using Cloudflare country and preserves the query', async (country, language) => {
        const request = requestFrom(country, {url: origin + '/?utm_source=example'});
        const assets = makeAssets();
        const response = await worker.fetch(request, {ASSETS: assets});

        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toBe(origin + '/' + language + '?utm_source=example');
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        expect(response.headers.get('Set-Cookie')).toContain(`${cookieName}=${language};`);
        expect(assets.fetch).not.toHaveBeenCalled();
    });

    it.each(['KR', 'CA', null])('keeps Korean HTML and remembers the first visit from %s', async (country) => {
        const request = requestFrom(country);
        const assets = makeAssets();
        const response = await worker.fetch(request, {ASSETS: assets});

        expect(response.status).toBe(200);
        expect(await response.text()).toBe(shell);
        expect(response.headers.get('Set-Cookie')).toContain(`${cookieName}=ko;`);
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it.each([
        ['ko', null],
        ['en', origin + '/en'],
        ['zh', origin + '/zh'],
    ])('uses saved %s even when visiting from Japan', async (language, location) => {
        const request = requestFrom('JP', {headers: {...directHeaders, Cookie: `other=1; ${cookieName}=${language}`}});
        const response = await worker.fetch(request, {ASSETS: makeAssets()});

        expect(response.status).toBe(location ? 302 : 200);
        expect(response.headers.get('Location')).toBe(location);
        expect(response.headers.has('Set-Cookie')).toBe(false);
    });

    it('does not redirect to a destination supplied through a cookie', async () => {
        const request = requestFrom('US', {headers: {...directHeaders, Cookie: `${cookieName}=//evil.example`}});
        const response = await worker.fetch(request, {ASSETS: makeAssets()});

        expect(response.headers.get('Location')).toBe(origin + '/en');
    });

    it.each([
        ['ordinary crawler request', {headers: {}}],
        ['verified crawler with browser headers', {verifiedBot: true}],
        ['link from search or another site', {headers: {...directHeaders, 'Sec-Fetch-Site': 'cross-site'}}],
        ['prefetch', {headers: {...directHeaders, 'Sec-Purpose': 'prefetch'}}],
        ['explicit locale URL', {url: origin + '/ja'}],
        ['explicit language query', {url: origin + '/?lng=ko'}],
        ['app host', {url: 'https://app.dutying.ai/'}],
        ['HEAD', {method: 'HEAD'}],
    ])('preserves the static response for %s', async (_, options) => {
        const request = requestFrom('US', options);
        const assets = makeAssets();
        const response = await worker.fetch(request, {ASSETS: assets});

        expect(assets.fetch).toHaveBeenCalledExactlyOnceWith(request);
        expect(response.status).toBe(200);
        expect(response.headers.has('Location')).toBe(false);
        expect(response.headers.has('Set-Cookie')).toBe(false);
    });
});
