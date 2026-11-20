import assert from 'node:assert/strict';
import test from 'node:test';
import {assertCloudflareCheckSuccessOrPending, waitForPagesDeployment, WAIT_TIMEOUT_MS} from './wait-for-pages-deployment.mjs';

const options = {publicUrl: 'https://dev.dutying.ai', commit: 'a'.repeat(40), branch: 'develop', project: 'dutying-web-ai-dev'};
const origin = 'https://abcdef12.dutying-web-ai-dev.pages.dev';
const metadata = {...options, provider: 'cloudflare-pages', deploymentUrl: origin};
const stale = {...metadata, commit: 'b'.repeat(40)};
function clock(fetchJson, extra = {}) {
    let time = 0;
    return {fetchJson, now: () => time, sleep: async ms => {time += ms;}, log: () => {}, ...extra};
}

test('waits through a ten minute Git deployment delay instead of failing after three minutes', async () => {
    let polls = 0;
    const result = await waitForPagesDeployment(options, clock(async url => {
        if (url.startsWith(options.publicUrl) && ++polls <= 40) return stale;
        return metadata;
    }));
    assert.equal(result, origin);
    assert.equal(polls, 41);
});

test('requires the immutable Pages response as well as the public response to match', async () => {
    let pagesPolls = 0;
    const result = await waitForPagesDeployment(options, clock(async url => {
        if (url.startsWith(origin) && ++pagesPolls < 3) return stale;
        return metadata;
    }));
    assert.equal(result, origin);
    assert.equal(pagesPolls, 3);
});

test('a provider success or absence of check runs cannot turn a stale public site green', async () => {
    let checked = false;
    await assert.rejects(waitForPagesDeployment(options, clock(async () => stale, {
        timeoutMs: 60000,
        providerCheck: async () => {checked = true;},
    })), /not verified within 1 minutes/);
    assert.equal(checked, true);
    assert.equal(WAIT_TIMEOUT_MS, 25 * 60000);
});

test('wrong branch, project, or metadata provider never passes verification', async () => {
    for (const patch of [
        {branch: 'main'}, {provider: 'github-actions'},
        {deploymentUrl: 'https://abcdef12.dutying-web-ai.pages.dev'},
        {deploymentUrl: 'https://example.com'},
    ]) {
        await assert.rejects(waitForPagesDeployment(options, clock(async () => ({...metadata, ...patch}))));
    }
});

test('an explicit direct upload URL supports a GitHub-built artifact and validates both responses', async () => {
    const result = await waitForPagesDeployment({...options, deploymentUrl: origin}, clock(async () => ({...metadata, provider: 'github-actions'})));
    assert.equal(result, origin);
    await assert.rejects(waitForPagesDeployment({...options, deploymentUrl: 'https://example.com'}, clock(async () => metadata)));
});

test('refuses to fetch arbitrary hosts or deploy the development build to production', async () => {
    let fetched = false;
    for (const patch of [{publicUrl: 'https://example.com'}, {project: 'dutying-web-ai'}, {branch: 'main'}, {commit: 'HEAD'}]) {
        await assert.rejects(waitForPagesDeployment({...options, ...patch}, clock(async () => {fetched = true;return metadata;})));
    }
    assert.equal(fetched, false);
});

test('stops waiting when the matching Cloudflare provider reports failure', async () => {
    const run = {head_sha: options.commit, app: {slug: 'cloudflare-workers-and-pages'}, name: `Cloudflare Pages: ${options.project}`, status: 'completed', conclusion: 'failure'};
    assertCloudflareCheckSuccessOrPending([], options);
    assertCloudflareCheckSuccessOrPending([{...run, head_sha: stale.commit}, {...run, name: 'Cloudflare Pages: another-project'}, {...run, app: {slug: 'github-actions'}}], options);
    assertCloudflareCheckSuccessOrPending([{...run, conclusion: 'success'}], options);
    assertCloudflareCheckSuccessOrPending([{...run, status: 'in_progress', conclusion: null}], options);
    await assert.rejects(waitForPagesDeployment(options, clock(async () => stale, {
        providerCheck: async () => assertCloudflareCheckSuccessOrPending([run], options),
    })), /Cloudflare reported failure/);
});
