import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import test from 'node:test';

const run = promisify(execFile);
const source = fileURLToPath(new URL('./sync-root-version.mjs', import.meta.url));

async function workspace(t, packageVersion = '1.3.51') {
    const root = await mkdtemp(path.join(tmpdir(), 'dutying release version '));
    t.after(() => rm(root, {recursive: true, force: true}));
    const script = path.join(root, 'scripts/release/sync-root-version.mjs');
    for (const folder of ['scripts/release', 'apps/app', 'apps/landing/dist', 'packages/api']) {
        await mkdir(path.join(root, folder), {recursive: true});
    }
    await copyFile(source, script);
    for (const [location, name, version] of [
        ['package.json', 'root', '1.3.50'],
        ['apps/app/package.json', '@dutying/app', '1.3.51'],
        ['packages/api/package.json', '@dutying/api', packageVersion],
    ])
        await writeFile(path.join(root, location), JSON.stringify({name, version}));
    return {root, script};
}

test('aligns real workspace manifests and leaves artifact-only app directories alone', async (t) => {
    const {root, script} = await workspace(t);
    await writeFile(path.join(root, 'apps/landing/dist/index.html'), 'existing build');
    await run(process.execPath, [script]);
    assert.equal(JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version, '1.3.51');
    assert.equal(await readFile(path.join(root, 'apps/landing/dist/index.html'), 'utf8'), 'existing build');
});

test('rejects mismatched real packages before changing the root version', async (t) => {
    const {root, script} = await workspace(t, '1.3.50');
    await assert.rejects(run(process.execPath, [script]), /versions are not aligned/);
    assert.equal(JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version, '1.3.50');
});

test('does not skip a malformed package manifest', async (t) => {
    const {root, script} = await workspace(t);
    await writeFile(path.join(root, 'packages/api/package.json'), '{broken');
    await assert.rejects(run(process.execPath, [script]));
    assert.equal(JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version, '1.3.50');
});
