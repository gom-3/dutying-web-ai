import assert from 'node:assert/strict';
import test from 'node:test';
import {getExistingPagesDeploymentUrl, getPagesDeploymentOrigin} from './existing-pages-deployment.mjs';

const expected = {commit: 'a'.repeat(40), branch: 'main', project: 'dutying-web-ai'};
const metadata = {provider: 'cloudflare-pages', commit: expected.commit, branch: 'main', deploymentUrl: 'https://12345678.dutying-web-ai.pages.dev'};

test('exports the immutable origin validator used by delayed deployment verification', () => {
    assert.equal(getPagesDeploymentOrigin(metadata.deploymentUrl, expected.project), metadata.deploymentUrl);
    assert.throws(() => getPagesDeploymentOrigin(metadata.deploymentUrl, 'another-project'));
    assert.throws(() => getPagesDeploymentOrigin('https://example.com', expected.project));
});

test('accepts the matching production and development Git-integrated deployment', () => {
    assert.equal(getExistingPagesDeploymentUrl(metadata, expected), metadata.deploymentUrl);
    assert.equal(getExistingPagesDeploymentUrl({...metadata, branch: 'develop', deploymentUrl: 'https://abcdef12.dutying-web-ai-dev.pages.dev'},
        {...expected, branch: 'develop', project: 'dutying-web-ai-dev'}), 'https://abcdef12.dutying-web-ai-dev.pages.dev');
});

test('rejects stale commits, another branch, and non-provider build metadata', () => {
    for (const patch of [{commit: 'b'.repeat(40)}, {branch: 'develop'}, {provider: 'github-actions'}]) {
        assert.throws(() => getExistingPagesDeploymentUrl({...metadata, ...patch}, expected));
    }
});

test('rejects another project, non-unique URLs, insecure URLs, and embedded credentials', () => {
    for (const deploymentUrl of [
        'https://12345678.dutying-web-ai-dev.pages.dev', 'https://dutying-web-ai.pages.dev',
        'http://12345678.dutying-web-ai.pages.dev', 'https://user:password@12345678.dutying-web-ai.pages.dev',
        'https://12345678.dutying-web-ai.pages.dev/other', 'https://12345678.dutying-web-ai.pages.dev/?secret=value',
    ]) assert.throws(() => getExistingPagesDeploymentUrl({...metadata, deploymentUrl}, expected));
});
