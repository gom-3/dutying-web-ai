import assert from 'node:assert/strict';
import test from 'node:test';
import worker, {selectLandingLanguage} from './worker.mjs';

const assets = {ASSETS: {fetch: async () => new Response('static', {status: 200})}};
const request = (path, {country, language, cookie, userAgent} = {}) => {
    const headers = new Headers();
    if (language) headers.set('Accept-Language', language);
    if (cookie) headers.set('Cookie', cookie);
    if (userAgent) headers.set('User-Agent', userAgent);
    return Object.assign(new Request(`https://www.dutying.ai${path}`, {headers}), {cf: {country}});
};

test('first arrival uses country before browser language', async () => {
    const response = await worker.fetch(request('/?campaign=autumn', {country: 'JP', language: 'en-US'}), assets);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), 'https://www.dutying.ai/ja?campaign=autumn');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
});

test('a saved choice wins while a direct locale URL stays fixed', async () => {
    const root = await worker.fetch(request('/', {country: 'JP', language: 'ja-JP', cookie: 'dutying.locale=en'}), assets);
    const direct = await worker.fetch(request('/ja', {country: 'KR', language: 'ko-KR'}), assets);
    assert.equal(root.headers.get('Location'), 'https://www.dutying.ai/en');
    assert.equal(await direct.text(), 'static');
});

test('Korean visitors and search crawlers can read the Korean root', async () => {
    assert.equal(await (await worker.fetch(request('/', {country: 'KR', language: 'ja-JP'}), assets)).text(), 'static');
    assert.equal(await (await worker.fetch(request('/', {country: 'US', userAgent: 'Googlebot/2.1'}), assets)).text(), 'static');
});

test('visitors without Accept-Language still receive their country language', async () => {
    const response = await worker.fetch(request('/', {country: 'JP'}), assets);
    assert.equal(response.headers.get('Location'), 'https://www.dutying.ai/ja');
});

test('country endpoint returns only the country and is never cached', async () => {
    const response = await worker.fetch(request('/__visitor-country', {country: 'KR'}), assets);
    assert.deepEqual(await response.json(), {country: 'KR'});
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(await (await worker.fetch(request('/__visitor-country', {country: 'XX'}), assets)).json(), {country: null});
});

test('unknown markets fall back to a supported browser language or English', () => {
    assert.equal(selectLandingLanguage({country: 'DE', acceptLanguage: 'fr-FR,fr;q=0.9,ja-JP;q=0.8'}), 'ja');
    assert.equal(selectLandingLanguage({country: 'DE', acceptLanguage: 'fr-FR'}), 'en');
    assert.equal(selectLandingLanguage({country: 'CN', acceptLanguage: 'en-US'}), 'zh');
});
