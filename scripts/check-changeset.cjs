/* eslint-env node */
const {execFileSync} = require('child_process');
const fs = require('fs');

const configuredBaseRef = process.env.CHANGESET_BASE_REF?.trim();
const ignoredChangesetFiles = new Set(['.changeset/README.md', '.changeset/config.json']);
const releaseRelevantPackageJsonKeys = [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
    'exports',
    'main',
    'module',
    'browser',
    'types',
    'files',
    'bin',
];

function runGit(args) {
    return execFileSync('git', args, {encoding: 'utf8'}).trim();
}

function refExists(ref) {
    try {
        execFileSync('git', ['rev-parse', '--verify', ref], {stdio: 'ignore'});
        return true;
    } catch {
        return false;
    }
}

function resolveOriginHeadRef() {
    try {
        return runGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
    } catch {
        return null;
    }
}

function resolveBaseRef() {
    if (configuredBaseRef) {
        if (refExists(configuredBaseRef)) {
            return configuredBaseRef;
        }

        throw new Error(
            `Configured base ref "${configuredBaseRef}" was not found. Fetch the branch or set CHANGESET_BASE_REF to an existing ref.`,
        );
    }

    const candidates = [resolveOriginHeadRef(), 'origin/develop', 'origin/main'].filter(Boolean);
    const fallbackRef = candidates.find(refExists);

    if (fallbackRef) {
        return fallbackRef;
    }

    throw new Error(
        'Could not determine a base ref for changeset validation. Fetch the default branch or set CHANGESET_BASE_REF explicitly.',
    );
}

function getChangedFiles(baseRef) {
    const committed = runGit(['diff', '--name-only', `${baseRef}...HEAD`]);
    const staged = runGit(['diff', '--name-only', '--cached']);
    const unstaged = runGit(['diff', '--name-only']);

    return Array.from(new Set([committed, staged, unstaged].flatMap((value) => (value ? value.split('\n') : [])).filter(Boolean)));
}

function readPackageJsonAt(filePath, ref) {
    if (ref === 'HEAD') {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }

            if (error instanceof SyntaxError) {
                throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
            }

            throw error;
        }
    }

    try {
        return JSON.parse(runGit(['show', `${ref}:${filePath}`]));
    } catch (error) {
        if (error.status === 128) {
            return null;
        }

        if (error instanceof SyntaxError) {
            throw new Error(`Invalid JSON in ${filePath} at ${ref}: ${error.message}`);
        }

        throw error;
    }
}

function hasReleaseRelevantPackageJsonChange(filePath, baseRef) {
    const current = readPackageJsonAt(filePath, 'HEAD');
    const base = readPackageJsonAt(filePath, baseRef);

    return releaseRelevantPackageJsonKeys.some((key) => JSON.stringify(current?.[key] ?? null) !== JSON.stringify(base?.[key] ?? null));
}

function isTestOnlyFile(filePath) {
    return filePath.includes('/__tests__/') || /\.test\.[cm]?[jt]sx?$/.test(filePath) || /\.spec\.[cm]?[jt]sx?$/.test(filePath);
}

function isReleaseRelevantFile(filePath, baseRef) {
    if (filePath.startsWith('.changeset/')) {
        return false;
    }

    if (
        filePath.startsWith('.github/') ||
        filePath.startsWith('docs/') ||
        filePath.startsWith('scripts/') ||
        filePath.startsWith('apps/docs/') ||
        filePath.startsWith('apps/landing/') ||
        filePath.startsWith('packages/config/') ||
        filePath === 'README.md' ||
        filePath === 'CHANGELOG.md' ||
        filePath === 'pnpm-lock.yaml' ||
        filePath === 'pnpm-workspace.yaml' ||
        filePath === '.gitignore' ||
        filePath === '.prettierignore' ||
        filePath === '.prettierrc' ||
        filePath === 'package.json'
    ) {
        return false;
    }

    if (isTestOnlyFile(filePath)) {
        return false;
    }

    if (
        filePath === 'apps/app/package.json' ||
        filePath === 'packages/api/package.json' ||
        filePath === 'packages/domain/package.json' ||
        filePath === 'packages/utils/package.json'
    ) {
        return hasReleaseRelevantPackageJsonChange(filePath, baseRef);
    }

    return (
        filePath.startsWith('apps/app/src/') ||
        filePath.startsWith('apps/app/public/') ||
        filePath === 'apps/app/index.html' ||
        filePath === 'apps/app/vite.config.ts' ||
        filePath === 'apps/app/vercel.json' ||
        filePath === 'apps/app/tailwind.config.ts' ||
        filePath === 'apps/app/components.json' ||
        filePath.startsWith('packages/api/src/') ||
        filePath.startsWith('packages/domain/src/') ||
        filePath.startsWith('packages/utils/src/')
    );
}

function main() {
    try {
        const baseRef = resolveBaseRef();
        const changedFiles = getChangedFiles(baseRef);

        if (changedFiles.length === 0) {
            console.log(`No changed files compared to ${baseRef}.`);
            return;
        }

        const hasChangeset = changedFiles.some(
            (filePath) => filePath.startsWith('.changeset/') && filePath.endsWith('.md') && !ignoredChangesetFiles.has(filePath),
        );

        const releaseRelevantFiles = changedFiles.filter((filePath) => isReleaseRelevantFile(filePath, baseRef));

        if (releaseRelevantFiles.length === 0) {
            console.log('No release-relevant web changes detected; changeset is optional.');
            return;
        }

        if (hasChangeset) {
            console.log('Changeset detected for release-relevant changes.');
            return;
        }

        console.error('Release-relevant changes were detected without a changeset.');
        console.error('Add a changeset with `pnpm run changeset:add` before opening or merging this PR.');
        console.error('Changed files requiring a changeset:');

        for (const filePath of releaseRelevantFiles) {
            console.error(`- ${filePath}`);
        }

        process.exit(1);
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

main();
