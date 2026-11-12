import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {readCsv} from './i18n-catalog-utils.mjs';

function withCsv(contents, verify) {
    const directory = mkdtempSync(join(tmpdir(), 'dutying-catalog-'));
    const path = join(directory, 'messages.csv');
    try {
        writeFileSync(path, contents);
        verify(path);
    } finally {
        rmSync(directory, {recursive: true, force: true});
    }
}

test('preserves quoted commas, line breaks, quotes and empty trailing locales', () => {
    withCsv('key,ko,en\na,"제목, 부제",Title\nb,"첫줄\n둘째줄 ""인용""",\n\n', (path) => {
        assert.deepEqual(readCsv(path), [
            {key: 'a', ko: '제목, 부제', en: 'Title'},
            {key: 'b', ko: '첫줄\n둘째줄 "인용"', en: ''},
        ]);
    });
});

test('rejects an unquoted comma instead of silently shifting locale columns', () => {
    withCsv('key,ko,en\na,제목, 부제,Title\n', (path) => {
        assert.throws(() => readCsv(path), /record 2 \(a\) has 4 columns; expected 3/);
    });
});

test('rejects missing locale columns and unfinished quoted text', () => {
    withCsv('key,ko,en\na,제목\n', (path) => {
        assert.throws(() => readCsv(path), /has 2 columns; expected 3/);
    });
    withCsv('key,ko,en\na,"제목,Title\n', (path) => {
        assert.throws(() => readCsv(path), /unterminated quoted CSV field/);
    });
});
