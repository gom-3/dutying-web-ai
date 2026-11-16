import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function getExistingPagesDeploymentUrl(metadata, {commit, branch, project}) {
    if (!['dutying-web-ai', 'dutying-web-ai-dev'].includes(project)) throw new Error('Unknown Pages project');
    if (metadata.provider !== 'cloudflare-pages' || metadata.commit !== commit || metadata.branch !== branch) {
        throw new Error('Public domain is not serving the expected Pages commit and branch');
    }

    const url = new URL(metadata.deploymentUrl);
    const suffix = `.${project}.pages.dev`;
    const id = url.hostname.slice(0, -suffix.length);

    if (
        url.protocol !== 'https:' || !url.hostname.endsWith(suffix) || !/^[a-z0-9-]+$/.test(id) ||
        url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash
    ) throw new Error('Unexpected Pages deployment URL');

    return url.origin;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    const [publicUrl, commit, branch, project] = process.argv.slice(2);
    const expectedPublicUrl = project === 'dutying-web-ai' ? 'https://www.dutying.ai' : 'https://dev.dutying.ai';

    if (publicUrl !== expectedPublicUrl) throw new Error('Unexpected public domain');

    const response = await fetch(`${publicUrl}/release.json`, {signal: AbortSignal.timeout(15000)});

    if (!response.ok) throw new Error(`Release metadata returned ${response.status}`);

    process.stdout.write(getExistingPagesDeploymentUrl(await response.json(), {commit, branch, project}));
}
