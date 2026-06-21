import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
    appRoot,
    catalogPath,
    getNamespace,
    readCatalogRows,
    writeCsvRows,
} from './i18n-catalog-utils.mjs';

const serverMessagesDir = process.env.I18N_SERVER_MESSAGES_DIR
    ? resolve(process.env.I18N_SERVER_MESSAGES_DIR)
    : resolve(appRoot, '../../../dutying-server/src/main/resources');
const updatedAt = '2026-06-10';

function readHeaders() {
    return readFileSync(catalogPath, 'utf8').split(/\r?\n/, 1)[0].split(',');
}

function joinContinuationLines(text) {
    const joinedLines = [];
    let currentLine = '';

    for (const line of text.split(/\r?\n/)) {
        const trailingSlashes = line.match(/\\+$/)?.[0].length ?? 0;
        const continues = trailingSlashes % 2 === 1;

        if (continues) {
            currentLine += line.slice(0, -1);
        } else {
            joinedLines.push(`${currentLine}${line}`);
            currentLine = '';
        }
    }

    if (currentLine) {
        joinedLines.push(currentLine);
    }

    return joinedLines;
}

function findSeparatorIndex(line) {
    let escaped = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if (char === ':' || char === '=') {
            return index;
        }
    }

    return -1;
}

function decodePropertiesEscapes(value) {
    return value.replace(/\\u([0-9a-fA-F]{4})|\\(.)/g, (_, unicode, escaped) => {
        if (unicode) {
            return String.fromCharCode(Number.parseInt(unicode, 16));
        }

        switch (escaped) {
            case 'f':
                return '\f';
            case 'n':
                return '\n';
            case 'r':
                return '\r';
            case 't':
                return '\t';
            default:
                return escaped;
        }
    });
}

function parseProperties(path) {
    if (!existsSync(path)) {
        throw new Error(`Missing server messages file: ${path}`);
    }

    return Object.fromEntries(
        joinContinuationLines(readFileSync(path, 'utf8'))
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'))
            .map((line) => {
                const separatorIndex = findSeparatorIndex(line);
                if (separatorIndex < 0) return [decodePropertiesEscapes(line), ''];

                return [
                    decodePropertiesEscapes(line.slice(0, separatorIndex).trim()),
                    decodePropertiesEscapes(line.slice(separatorIndex + 1).trim()),
                ];
            }),
    );
}

function parseOptionalProperties(path) {
    if (!existsSync(path)) {
        return {};
    }

    return parseProperties(path);
}

const messages = {
    ko: parseProperties(resolve(serverMessagesDir, 'messages_ko.properties')),
    en: parseProperties(resolve(serverMessagesDir, 'messages_en.properties')),
    ja: parseProperties(resolve(serverMessagesDir, 'messages_ja.properties')),
    zh: parseOptionalProperties(resolve(serverMessagesDir, 'messages_zh.properties')),
    th: parseOptionalProperties(resolve(serverMessagesDir, 'messages_th.properties')),
    vi: parseOptionalProperties(resolve(serverMessagesDir, 'messages_vi.properties')),
};

const serverKeys = Array.from(
    new Set(Object.values(messages).flatMap((localeMessages) => Object.keys(localeMessages))),
).sort((left, right) => left.localeCompare(right));

const headers = readHeaders();
const existingRows = readCatalogRows().filter((row) => row.platform !== 'server');
const serverRows = serverKeys.map((runtimeKey) => ({
    messageId: runtimeKey,
    platform: 'server',
    runtimeKey,
    namespace: getNamespace(runtimeKey),
    owner: 'server',
    surface: 'feedback',
    status: 'imported',
    displayPolicy: 'CLIENT_TRANSLATE',
    maxLength: '',
    emptyLocales: '',
    termIds: '',
    context: 'Spring ErrorCode response message',
    route: '',
    component: 'dutying-server',
    screenshotRef: '',
    ko: messages.ko[runtimeKey] ?? '',
    en: messages.en[runtimeKey] ?? '',
    ja: messages.ja[runtimeKey] ?? '',
    zh: messages.zh[runtimeKey] ?? '',
    th: messages.th[runtimeKey] ?? '',
    vi: messages.vi[runtimeKey] ?? '',
    serverMessageKey: runtimeKey,
    updatedAt,
}));

writeFileSync(catalogPath, `${writeCsvRows(headers, [...existingRows, ...serverRows])}\n`);

console.log(
    JSON.stringify(
        {
            catalogPath,
            serverMessagesDir,
            serverMessages: serverRows.length,
        },
        null,
        2,
    ),
);
