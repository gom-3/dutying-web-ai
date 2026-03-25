import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

import {getNextReleaseVersion, readPendingChangesets, readRootVersion} from './changelog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const baseBranch = process.env.RELEASE_BASE_BRANCH?.trim() || 'develop';
const releaseBranch = process.env.RELEASE_BRANCH?.trim() || `changeset-release/${baseBranch}`;
const releasePrTitle = process.env.RELEASE_PR_TITLE?.trim() || '[-]: version packages';
const releaseCommitMessage = process.env.RELEASE_PR_COMMIT_MESSAGE?.trim() || releasePrTitle;
const gitUserName = process.env.RELEASE_GIT_USER_NAME?.trim() || 'github-actions[bot]';
const gitUserEmail = process.env.RELEASE_GIT_USER_EMAIL?.trim() || '41898282+github-actions[bot]@users.noreply.github.com';
const isDryRun = process.env.RELEASE_PR_DRY_RUN === '1';

function commandToString(command, args) {
    return [command, ...args].join(' ');
}

function runCommand(command, args, {captureOutput = false} = {}) {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        const child = spawn(command, args, {
            cwd: rootDir,
            env: process.env,
            stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        });

        if (captureOutput) {
            child.stdout.on('data', (chunk) => {
                stdout += chunk.toString();
            });

            child.stderr.on('data', (chunk) => {
                stderr += chunk.toString();
            });
        }

        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) {
                resolve({
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                });
                return;
            }

            reject(new Error(`Command failed (${code}): ${commandToString(command, args)}${stderr ? `\n${stderr.trim()}` : ''}`));
        });
    });
}

async function hasPendingChangesets() {
    try {
        return await readPendingChangesets(rootDir);
    } catch (error) {
        if (error.message === 'No pending changesets were found in .changeset/.') {
            return [];
        }

        throw error;
    }
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function readLatestReleaseSection(version) {
    const changelogPath = path.join(rootDir, 'CHANGELOG.md');
    const changelogContent = await readFile(changelogPath, 'utf8');
    const sectionPattern = new RegExp(`^## ${escapeRegExp(version)} - .*?(?=^## |\\Z)`, 'ms');
    const match = changelogContent.match(sectionPattern);

    return match?.[0]?.trim() ?? null;
}

async function configureGitUser() {
    await runCommand('git', ['config', 'user.name', gitUserName]);
    await runCommand('git', ['config', 'user.email', gitUserEmail]);
}

async function findOpenReleasePr() {
    const {stdout} = await runCommand(
        'gh',
        ['pr', 'list', '--state', 'open', '--base', baseBranch, '--head', releaseBranch, '--json', 'number,url'],
        {captureOutput: true},
    );

    const pullRequests = JSON.parse(stdout || '[]');

    return pullRequests[0] ?? null;
}

async function closeOpenReleasePrIfNeeded(reason) {
    const existingPr = await findOpenReleasePr();

    if (!existingPr) {
        console.log(reason);
        return;
    }

    if (isDryRun) {
        console.log(`[dry-run] Would close release PR #${existingPr.number}: ${reason}`);
        return;
    }

    await runCommand('gh', ['pr', 'close', String(existingPr.number), '--comment', reason]);
}

async function writeReleasePrBody(version) {
    const changelogSection = await readLatestReleaseSection(version);
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'dutying-release-pr-'));
    const bodyPath = path.join(tempDir, 'body.md');
    const lines = [
        '## Summary',
        `- pending changesets on \`${baseBranch}\`를 기준으로 release PR을 자동 생성했습니다.`,
        `- 다음 릴리즈 버전은 \`${version}\`입니다.`,
        '- workspace 버전, 루트 `package.json`, 루트 `CHANGELOG.md`를 함께 동기화했습니다.',
        '',
        '## Validation',
        '- `pnpm run release:test`',
        '- `pnpm run release:version`',
    ];

    if (changelogSection) {
        lines.push('', '## Root CHANGELOG Entry', changelogSection);
    }

    await writeFile(bodyPath, `${lines.join('\n')}\n`);

    return {
        bodyPath,
        cleanup: () => rm(tempDir, {recursive: true, force: true}),
    };
}

async function main() {
    await runCommand('git', ['fetch', 'origin', baseBranch]);

    const pendingChangesets = await hasPendingChangesets();

    if (pendingChangesets.length === 0) {
        await closeOpenReleasePrIfNeeded('Pending changesets가 없어 release PR을 닫습니다.');
        return;
    }

    const currentVersion = await readRootVersion(rootDir);
    const plannedVersion = getNextReleaseVersion(currentVersion, pendingChangesets);

    await configureGitUser();
    await runCommand('git', ['checkout', '-B', releaseBranch, `origin/${baseBranch}`]);
    await runCommand('pnpm', ['run', 'release:version']);

    const {stdout: statusOutput} = await runCommand('git', ['status', '--porcelain'], {captureOutput: true});

    if (statusOutput.trim() === '') {
        await closeOpenReleasePrIfNeeded('릴리즈로 반영할 변경이 없어 release PR을 닫습니다.');
        return;
    }

    await runCommand('git', ['add', '-A']);
    await runCommand('git', ['commit', '-m', releaseCommitMessage]);

    if (isDryRun) {
        console.log(`[dry-run] Prepared release commit for ${plannedVersion} on ${releaseBranch}.`);
        return;
    }

    await runCommand('git', ['push', '--force-with-lease', 'origin', `${releaseBranch}:${releaseBranch}`]);

    const {bodyPath, cleanup} = await writeReleasePrBody(plannedVersion);

    try {
        const existingPr = await findOpenReleasePr();

        if (existingPr) {
            await runCommand('gh', ['pr', 'edit', String(existingPr.number), '--title', releasePrTitle, '--body-file', bodyPath]);
            console.log(`Updated release PR #${existingPr.number} for ${plannedVersion}.`);
            return;
        }

        await runCommand('gh', [
            'pr',
            'create',
            '--base',
            baseBranch,
            '--head',
            releaseBranch,
            '--title',
            releasePrTitle,
            '--body-file',
            bodyPath,
        ]);
        console.log(`Created release PR for ${plannedVersion}.`);
    } finally {
        await cleanup();
    }
}

await main();
