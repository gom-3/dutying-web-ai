import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import test from 'node:test';
import {verifyBillingBuild} from './verify-billing-build.mjs';

const routes = [
    'billing',
    'billing/billing-return',
    'billing/payment-return',
    'workspace',
    'workspace/billing-return',
    'workspace/payment-return',
    'app-shell',
];
const shell = '<meta name="robots" content="noindex, follow"><div id="root"></div><script type="module" src="/assets/app.js"></script>';

function fixture(t) {
    const directory = mkdtempSync(join(tmpdir(), 'dutying-billing-build-'));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    for (const route of routes) {
        const file = join(directory, `${route}.html`);
        mkdirSync(dirname(file), {recursive: true});
        writeFileSync(file, shell);
    }
    writeFileSync(join(directory, '_redirects'), '/billing/* /app-shell 200\n/workspace/* /app-shell 200\n');
    return directory;
}

test('accepts emitted billing and preserved legacy entry points', (t) => {
    assert.deepEqual(verifyBillingBuild(fixture(t)), {aliases: 6, dynamicRewrites: 2});
});

test('rejects a missing direct entry or provider callback', (t) => {
    for (const route of routes) {
        const directory = fixture(t);
        rmSync(join(directory, `${route}.html`));
        assert.throws(() => verifyBillingBuild(directory), /ENOENT/);
    }
});

test('rejects landing pages and missing app bootstraps', (t) => {
    for (const html of [shell + '<div data-rendered="landing"></div>', '<meta name="robots" content="noindex"><div id="root"></div>']) {
        const directory = fixture(t);
        writeFileSync(join(directory, 'billing.html'), html);
        assert.throws(() => verifyBillingBuild(directory));
    }
});

test('requires dynamic app rewrites for both current and legacy billing links', (t) => {
    for (const redirect of [
        '/billing/* /app-shell 200',
        '/workspace/* /app-shell 200',
        '/billing/* /app-shell 302\n/workspace/* /app-shell 200',
    ]) {
        const directory = fixture(t);
        writeFileSync(join(directory, '_redirects'), redirect);
        assert.throws(() => verifyBillingBuild(directory), /rewrite missing/);
    }
});
