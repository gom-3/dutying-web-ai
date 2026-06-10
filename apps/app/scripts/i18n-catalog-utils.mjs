import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);
export const appRoot = resolve(scriptDir, '..');
export const catalogDir = resolve(appRoot, 'i18n/catalog');
export const catalogPath = resolve(catalogDir, 'messages.csv');
export const glossaryPath = resolve(catalogDir, 'terms.csv');
export const generatedResourcesPath = resolve(appRoot, 'src/shared/i18n/resources.generated.ts');

const moduleCache = new Map();

export function ensureDir(path) {
    mkdirSync(path, {recursive: true});
}

export function loadTsModule(filePath) {
    const absolutePath = resolve(filePath);

    if (moduleCache.has(absolutePath)) {
        return moduleCache.get(absolutePath).exports;
    }

    const source = readFileSync(absolutePath, 'utf8');
    const {outputText} = ts.transpileModule(source, {
        compilerOptions: {
            esModuleInterop: true,
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
        },
        fileName: absolutePath,
    });
    const module = {exports: {}};

    moduleCache.set(absolutePath, module);

    const localRequire = (specifier) => {
        if (specifier.startsWith('.')) {
            const modulePath = specifier.endsWith('.ts') ? specifier : `${specifier}.ts`;
            return loadTsModule(resolve(dirname(absolutePath), modulePath));
        }

        return nodeRequire(specifier);
    };

    const execute = new Function('exports', 'module', 'require', outputText);

    execute(module.exports, module, localRequire);

    return module.exports;
}

export function flattenMessages(value, prefix = '', output = {}) {
    if (typeof value === 'string') {
        output[prefix] = value;
        return output;
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return output;
    }

    for (const [key, child] of Object.entries(value)) {
        flattenMessages(child, prefix ? `${prefix}.${key}` : key, output);
    }

    return output;
}

export function unflattenMessages(flatMessages) {
    const root = {};

    for (const [key, value] of Object.entries(flatMessages)) {
        const parts = key.split('.');
        let cursor = root;

        parts.forEach((part, index) => {
            if (index === parts.length - 1) {
                cursor[part] = value;
                return;
            }

            cursor[part] ??= {};
            cursor = cursor[part];
        });
    }

    return root;
}

export function readCsv(path) {
    const text = readFileSync(path, 'utf8');
    const rows = [];
    let field = '';
    let row = [];
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') {
                field += '"';
                index += 1;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            row.push(field);
            field = '';
        } else if (char === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else if (char !== '\r') {
            field += char;
        }
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    const [headers, ...dataRows] = rows;

    return dataRows
        .filter((dataRow) => dataRow.some((cell) => cell !== ''))
        .map((dataRow) =>
            Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ''])),
        );
}

export function writeCsvRows(headers, rows) {
    return [
        headers.join(','),
        ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? '')).join(',')),
    ].join('\n');
}

export function csvEscape(value) {
    const text = String(value);

    if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
}

export function getNamespace(runtimeKey) {
    const parts = runtimeKey.split('.');
    return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0];
}

export function getOwner(runtimeKey) {
    const parts = runtimeKey.split('.');

    if (parts[0] === 'page' || parts[0] === 'feature' || parts[0] === 'widget' || parts[0] === 'entity') {
        return parts[1] ?? parts[0];
    }

    return parts[0];
}

export function getSurface(runtimeKey) {
    if (/aria|label|alt|title/i.test(runtimeKey)) return 'accessibility';
    if (/toast|success|failed|error/i.test(runtimeKey)) return 'feedback';
    if (/button|action|submit|cancel|close|retry|save|delete/i.test(runtimeKey)) return 'button';
    if (/placeholder/i.test(runtimeKey)) return 'input';
    if (/description|hint|info/i.test(runtimeKey)) return 'description';
    return 'text';
}

export function readCatalogRows() {
    if (!existsSync(catalogPath)) {
        throw new Error(`Missing catalog: ${catalogPath}`);
    }

    return readCsv(catalogPath);
}
