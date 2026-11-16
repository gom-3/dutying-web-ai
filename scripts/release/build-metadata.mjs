export function createBuildMetadata(env, version, siteUrl) {
    if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw new Error('Invalid release version');

    const pages = env.CF_PAGES === '1';
    const commit = (pages ? env.CF_PAGES_COMMIT_SHA : env.GITHUB_SHA) || null;
    const branch = (pages ? env.CF_PAGES_BRANCH : env.GITHUB_REF_NAME) || null;

    if ((pages && !commit) || (commit && !/^[a-f0-9]{40}$/i.test(commit))) throw new Error('Invalid build commit');
    if (pages && !branch) throw new Error('Missing Pages branch');

    let deploymentUrl = null;

    if (pages) {
        const url = new URL(env.CF_PAGES_URL);

        if (url.protocol !== 'https:' || !url.hostname.endsWith('.pages.dev') || url.username || url.password) {
            throw new Error('Invalid Pages deployment URL');
        }

        deploymentUrl = url.origin;
    }

    return {
        version,
        commit: commit?.toLowerCase() ?? null,
        branch,
        provider: pages ? 'cloudflare-pages' : env.GITHUB_SHA ? 'github-actions' : 'local',
        environment: pages ? (branch === 'main' ? 'production' : 'preview') : 'build',
        siteUrl: new URL(siteUrl).origin,
        deploymentUrl,
    };
}
