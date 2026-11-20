import {appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {getExistingPagesDeploymentUrl, getPagesDeploymentOrigin} from './existing-pages-deployment.mjs';

export const WAIT_TIMEOUT_MS = 25 * 60 * 1000;
class NotReady extends Error {}

export async function waitForPagesDeployment(options, {
    fetchJson = async url => {
        try {
            const response = await fetch(url, {signal: AbortSignal.timeout(15000), cache: 'no-store'});
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch {
            throw new NotReady('Release metadata is not reachable yet');
        }
    },
    providerCheck = async () => {},
    now = Date.now,
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    log = console.log,
    timeoutMs = WAIT_TIMEOUT_MS,
    intervalMs = 15000,
} = {}) {
    const {publicUrl, commit, branch, project, deploymentUrl} = options;
    const targets = {
        'dutying-web-ai-dev': {branch: 'develop', url: 'https://dev.dutying.ai'},
        'dutying-web-ai': {branch: 'main', url: 'https://www.dutying.ai'},
    };
    if (!targets[project] || targets[project].branch !== branch || targets[project].url !== publicUrl || !/^[a-f0-9]{40}$/.test(commit)) {
        throw new Error('Unexpected deployment target or commit');
    }
    const uploadedOrigin = deploymentUrl ? getPagesDeploymentOrigin(deploymentUrl, project) : null;
    const start = now();
    const deadline = start + timeoutMs;
    let lastState = 'Cloudflare has not reported this deployment';
    let nextProviderCheck = start;
    while (true) {
        try {
            const metadata = await fetchJson(`${publicUrl}/release.json`);
            if (metadata.commit !== commit) throw new NotReady(`Public site still serves ${String(metadata.commit).slice(0, 12)}`);
            if (metadata.branch !== branch) throw new Error('Public site reports the wrong branch');
            const origin = uploadedOrigin || getExistingPagesDeploymentUrl(metadata, {commit, branch, project});
            const immutable = await fetchJson(`${origin}/release.json`);
            if (immutable.commit !== commit || immutable.branch !== branch) throw new NotReady('Pages deployment metadata does not match yet');
            log(`Verified ${commit} on ${publicUrl} and ${origin}`);
            return origin;
        } catch (error) {
            if (!(error instanceof NotReady)) throw error;
            lastState = error.message;
        }
        if (now() >= nextProviderCheck) {
            await providerCheck();
            nextProviderCheck = now() + 60000;
        }
        if (now() >= deadline) {
            throw new Error(`Deployment was not verified within ${timeoutMs / 60000} minutes. ${lastState}. Check the Cloudflare Git deployment for ${project} at ${commit}; missing upload credentials alone do not establish a Git integration failure.`);
        }
        log(`Waiting for ${project}/${branch} ${commit.slice(0, 12)} (${Math.floor((now() - start) / 1000)}s): ${lastState}`);
        await sleep(Math.min(intervalMs, deadline - now()));
    }
}

// Check runs can appear only after a Pages build finishes. Absence is not a
// provider failure or evidence that a provider build has started.
export function assertCloudflareCheckSuccessOrPending(runs, {commit, project}) {
    const failure = runs.find(run => run.head_sha === commit &&
        run.app?.slug === 'cloudflare-workers-and-pages' && run.name === `Cloudflare Pages: ${project}` &&
        run.status === 'completed' && run.conclusion !== 'success');
    if (failure) throw new Error(`Cloudflare reported ${failure.conclusion} for ${project} at ${commit}. Inspect the Cloudflare build details.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    const [publicUrl, commit, branch, project, deploymentUrl] = process.argv.slice(2);
    const options = {publicUrl, commit, branch, project, deploymentUrl};
    const origin = await waitForPagesDeployment(options, {
        providerCheck: async () => {
            const repo = process.env.GITHUB_REPOSITORY;
            if (!repo || !process.env.GITHUB_TOKEN) return;
            let runs;
            try {
                const response = await fetch(`https://api.github.com/repos/${repo}/commits/${commit}/check-runs?per_page=100`, {
                    headers: {Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json'},
                    signal: AbortSignal.timeout(15000),
                });
                if (!response.ok) throw new Error('Check status unavailable');
                runs = (await response.json()).check_runs;
            } catch {
                console.log('Cloudflare check status is unavailable; continuing public deployment verification.');
                return;
            }
            assertCloudflareCheckSuccessOrPending(runs, options);
        },
    });
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `deployment-url=${origin}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `Published ${commit} at ${publicUrl} (Pages: ${origin})\n`);
}
