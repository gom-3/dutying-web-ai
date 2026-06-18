import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const sourceRoot = fileURLToPath(new URL('../src', import.meta.url));
const cjkPattern = /[가-힣ぁ-ゟ゠-ヿ一-龯]/;
const failOnFindings = process.env.I18N_SCAN_FAIL_ON_FINDINGS === '1';
const maxFindings = Number.parseInt(process.env.I18N_SCAN_MAX ?? '200', 10);

const ignoredPathParts = new Set(['__tests__', '__mocks__']);
const ignoredPathFragments = [
    '/shared/i18n/resources.generated.ts',
    '/shared/locales/',
    '/shared/assets/',
    '/pages/ui-preview/',
];
const ignoredFilePatterns = [
    /\.test\.[cm]?[tj]sx?$/,
    /\.spec\.[cm]?[tj]sx?$/,
    /\.d\.ts$/,
];
const includedFilePatterns = [/\.[cm]?tsx?$/, /\.css$/];
const ignoredLinePatterns = [
    /^\s*\/\//,
    /^\s*\/\*/,
    /^\s*\*/,
    /^\s*\{\s*\/\*/,
    /^\s*\*\//,
    /\/\*.*\*\//,
    /[A-Z0-9_]*REGEXP/,
    /\.matches\(/,
    /\.replace\(\//,
    /\.match\(\//,
    /\/\[[^\n]+[가-힣ぁ-ゟ゠-ヿ一-龯][^\n]+\/[a-z]*/,
];

function shouldScanFile(filePath) {
    const relativePath = `/${relative(sourceRoot, filePath).replaceAll('\\', '/')}`;
    const parts = relativePath.split('/').filter(Boolean);

    if (!includedFilePatterns.some((pattern) => pattern.test(filePath))) return false;
    if (parts.some((part) => ignoredPathParts.has(part))) return false;
    if (ignoredPathFragments.some((fragment) => relativePath.includes(fragment))) return false;
    if (ignoredFilePatterns.some((pattern) => pattern.test(filePath))) return false;

    return true;
}

function walk(dirPath, files = []) {
    for (const entry of readdirSync(dirPath)) {
        const filePath = join(dirPath, entry);
        const stat = statSync(filePath);

        if (stat.isDirectory()) {
            walk(filePath, files);
        } else if (stat.isFile() && shouldScanFile(filePath)) {
            files.push(filePath);
        }
    }

    return files;
}

const findings = [];

for (const filePath of walk(sourceRoot)) {
    const lines = readFileSync(filePath, 'utf8').split('\n');

    lines.forEach((line, index) => {
        if (!cjkPattern.test(line)) return;
        if (ignoredLinePatterns.some((pattern) => pattern.test(line))) return;

        findings.push({
            file: relative(process.cwd(), filePath),
            line: index + 1,
            text: line.trim().slice(0, 220),
        });
    });
}

const countsByFile = findings.reduce((acc, finding) => {
    acc[finding.file] = (acc[finding.file] ?? 0) + 1;
    return acc;
}, {});
const sortedCounts = Object.entries(countsByFile)
    .sort(([, a], [, b]) => b - a)
    .map(([file, count]) => ({file, count}));

console.log(
    JSON.stringify(
        {
            totalFindings: findings.length,
            files: sortedCounts,
            sampleFindings: findings.slice(0, Number.isFinite(maxFindings) ? maxFindings : 200),
            mode: failOnFindings ? 'fail-on-findings' : 'report-only',
        },
        null,
        2,
    ),
);

if (failOnFindings && findings.length > 0) {
    console.error(`Found ${findings.length} CJK literal(s) outside locale resources.`);
    process.exit(1);
}
