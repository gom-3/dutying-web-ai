import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const aliases = [
    'billing',
    'billing/billing-return',
    'billing/payment-return',
    'workspace',
    'workspace/billing-return',
    'workspace/payment-return',
];

export function verifyBillingBuild(directory) {
    const read = (file) => readFileSync(resolve(directory, file), 'utf8');
    for (const route of [...aliases, 'app-shell']) {
        const html = read(`${route}.html`);
        assert.match(html, /id=["']root["']/, `${route}: app root missing`);
        assert.match(html, /<script[^>]*type=["']module["']/, `${route}: app entry missing`);
        assert.match(html, /name=["']robots["'][^>]*noindex/, `${route}: app route must remain noindex`);
        assert(!html.includes('data-rendered="landing"'), `${route}: marketing landing cannot replace the app shell`);
    }
    const redirects = read('_redirects')
        .split('\n')
        .map((line) => line.trim().split(/\s+/));
    for (const source of ['/billing/*', '/workspace/*']) {
        assert(
            redirects.some(([from, target, status]) => from === source && target === '/app-shell' && status === '200'),
            `${source}: dynamic billing/legacy callback rewrite missing`,
        );
    }
    return {aliases: aliases.length, dynamicRewrites: 2};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const result = verifyBillingBuild(process.argv[2] ?? 'apps/app/dist');
    console.log(`Billing build verified: ${result.aliases} entry/callback aliases and ${result.dynamicRewrites} dynamic rewrites.`);
}
