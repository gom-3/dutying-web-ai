import assert from 'node:assert/strict';
import test from 'node:test';
import {createBuildMetadata} from './build-metadata.mjs';

const pages = {
    CF_PAGES: '1',
    CF_PAGES_COMMIT_SHA: 'a'.repeat(40),
    CF_PAGES_BRANCH: 'main',
    CF_PAGES_URL: 'https://12345678.dutying-web-ai.pages.dev',
};

test('records the provider commit and production URL without copying unrelated build values', () => {
    assert.deepEqual(createBuildMetadata({...pages, UNRELATED_VALUE: 'must-stay-private'}, '1.3.51', 'https://www.dutying.ai'), {
        version: '1.3.51',
        commit: 'a'.repeat(40),
        branch: 'main',
        provider: 'cloudflare-pages',
        environment: 'production',
        siteUrl: 'https://www.dutying.ai',
        deploymentUrl: pages.CF_PAGES_URL,
    });
});

test('identifies develop as a preview and removes URL query or fragment data', () => {
    const metadata = createBuildMetadata(
        {...pages, CF_PAGES_BRANCH: 'develop', CF_PAGES_URL: `${pages.CF_PAGES_URL}/?ignored=value#fragment`},
        '1.3.51',
        'https://dev.dutying.ai/',
    );

    assert.equal(metadata.environment, 'preview');
    assert.equal(metadata.siteUrl, 'https://dev.dutying.ai');
    assert.equal(metadata.deploymentUrl, pages.CF_PAGES_URL);
});

test('refuses missing or invalid Pages evidence instead of publishing a misleading release', () => {
    for (const change of [
        {CF_PAGES_COMMIT_SHA: ''},
        {CF_PAGES_COMMIT_SHA: 'invalid'},
        {CF_PAGES_BRANCH: ''},
        {CF_PAGES_URL: 'https://unrelated.example.com'},
        {CF_PAGES_URL: 'https://user:password@example.pages.dev'},
    ]) {
        assert.throws(() => createBuildMetadata({...pages, ...change}, '1.3.51', 'https://www.dutying.ai'));
    }
});

test('local builds do not claim an unknown commit or provider deployment', () => {
    const metadata = createBuildMetadata({}, '1.3.51', 'https://www.dutying.ai');

    assert.equal(metadata.commit, null);
    assert.equal(metadata.provider, 'local');
    assert.equal(metadata.deploymentUrl, null);
});
