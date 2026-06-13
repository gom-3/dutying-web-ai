import {readCatalogRows} from './i18n-catalog-utils.mjs';

const REQUIRED_COLUMNS = ['messageId', 'platform', 'runtimeKey', 'namespace', 'owner', 'status'];
const STATUSES = new Set(['imported', 'draft', 'machine', 'needs-review', 'reviewed', 'legal-approved']);
const DISPLAY_POLICIES = new Set(['', 'CLIENT_TRANSLATE', 'SERVER_TEXT', 'SERVER_TEXT_WITH_LANGUAGE', 'DEBUG_ONLY']);
const GRAMMAR_PLACEHOLDERS = new Set(['objectParticle', 'subjectParticle', 'topicParticle']);
const LOCALES = ['ko', 'en', 'ja'];

const interpolationPattern = /{{\s*([\w.]+)\s*}}/g;

function extractPlaceholders(value) {
    const placeholders = new Set();
    for (const match of value.matchAll(interpolationPattern)) {
        placeholders.add(match[1]);
    }

    return Array.from(placeholders)
        .filter((placeholder) => !GRAMMAR_PLACEHOLDERS.has(placeholder))
        .sort();
}

function sameList(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function rowId(row, index) {
    return row.messageId || row.runtimeKey || `row:${index + 2}`;
}

function parseEmptyLocales(row) {
    return new Set(
        String(row.emptyLocales ?? '')
            .split(/[|, ]/)
            .map((locale) => locale.trim())
            .filter(Boolean),
    );
}

const rows = readCatalogRows();
const errors = [];
const warnings = [];
const runtimeKeys = new Map();
const messageIds = new Map();

rows.forEach((row, index) => {
    const label = rowId(row, index);

    for (const column of REQUIRED_COLUMNS) {
        if (!row[column]) {
            errors.push(`${label}: missing required column "${column}"`);
        }
    }

    const emptyLocales = parseEmptyLocales(row);
    for (const locale of LOCALES) {
        if (row[locale] === '' && !emptyLocales.has(locale)) {
            warnings.push(`${label}: ${locale} translation is intentionally empty or needs review`);
        }
    }

    if (row.status && !STATUSES.has(row.status)) {
        errors.push(`${label}: unknown status "${row.status}"`);
    }

    if (!DISPLAY_POLICIES.has(row.displayPolicy ?? '')) {
        errors.push(`${label}: unknown displayPolicy "${row.displayPolicy}"`);
    }

    const runtimeKeyScope = `${row.platform}:${row.runtimeKey}`;
    if (runtimeKeys.has(runtimeKeyScope)) {
        errors.push(`${label}: duplicate platform/runtimeKey also used by ${runtimeKeys.get(runtimeKeyScope)}`);
    } else {
        runtimeKeys.set(runtimeKeyScope, label);
    }

    if (messageIds.has(row.messageId)) {
        warnings.push(`${label}: messageId also used by ${messageIds.get(row.messageId)}`);
    } else {
        messageIds.set(row.messageId, label);
    }

    const referencePlaceholders = extractPlaceholders(row.ko ?? '');
    for (const locale of LOCALES.filter((locale) => locale !== 'ko')) {
        const placeholders = extractPlaceholders(row[locale] ?? '');
        if (!sameList(referencePlaceholders, placeholders)) {
            errors.push(
                `${label}: ${locale} placeholders [${placeholders.join(', ')}] differ from ko [${referencePlaceholders.join(', ')}]`,
            );
        }
    }

    if (row.maxLength && Number.isNaN(Number(row.maxLength))) {
        errors.push(`${label}: maxLength must be numeric when provided`);
    }

    if (row.serverMessageKey && !row.displayPolicy) {
        warnings.push(`${label}: serverMessageKey is set without displayPolicy`);
    }
});

const result = {
    totalRows: rows.length,
    errors,
    warnings,
};

console.log(JSON.stringify(result, null, 2));

if (errors.length > 0) {
    process.exitCode = 1;
}
