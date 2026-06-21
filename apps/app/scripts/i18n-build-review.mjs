import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {appRoot, glossaryPath, readCatalogRows, readCsv} from './i18n-catalog-utils.mjs';

const reviewPath = resolve(appRoot, 'i18n/review/i18n-review-board.html');

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeMultiline(value) {
    return escapeHtml(value).replace(/\n/g, '<br />');
}

function statusClass(status) {
    return `status-${String(status || 'unknown').replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`;
}

const rows = readCatalogRows();
const terms = existsSync(glossaryPath) ? readCsv(glossaryPath) : [];
const generatedAt = new Date().toISOString();

const namespaceCounts = rows.reduce((counts, row) => {
    counts[row.namespace] = (counts[row.namespace] ?? 0) + 1;
    return counts;
}, {});

const statusCounts = rows.reduce((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
}, {});

const html = `<!doctype html>
<html lang="ko">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dutying i18n Review Board</title>
    <style>
        :root {
            color-scheme: light;
            --bg: #f7f8fa;
            --panel: #ffffff;
            --ink: #18202a;
            --muted: #657386;
            --line: #dbe1e8;
            --accent: #0f766e;
            --warn: #b45309;
            --danger: #b91c1c;
            font-family:
                Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            background: var(--bg);
            color: var(--ink);
        }

        header {
            position: sticky;
            top: 0;
            z-index: 3;
            border-bottom: 1px solid var(--line);
            background: rgba(255, 255, 255, 0.96);
            backdrop-filter: blur(12px);
        }

        .header-inner {
            max-width: 1440px;
            margin: 0 auto;
            padding: 20px 24px;
        }

        h1 {
            margin: 0 0 8px;
            font-size: 24px;
            line-height: 1.25;
            letter-spacing: 0;
        }

        .meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 16px;
            color: var(--muted);
            font-size: 13px;
        }

        main {
            max-width: 1440px;
            margin: 0 auto;
            padding: 24px;
        }

        section {
            margin-bottom: 24px;
        }

        h2 {
            margin: 0 0 12px;
            font-size: 18px;
            line-height: 1.35;
            letter-spacing: 0;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
        }

        .stat,
        .term {
            border: 1px solid var(--line);
            border-radius: 8px;
            background: var(--panel);
            padding: 14px;
        }

        .stat strong {
            display: block;
            margin-bottom: 4px;
            font-size: 22px;
            line-height: 1.2;
        }

        .stat span,
        .term p {
            color: var(--muted);
            font-size: 13px;
            line-height: 1.45;
        }

        .terms {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 12px;
        }

        .term h3 {
            margin: 0 0 8px;
            font-size: 15px;
            letter-spacing: 0;
        }

        .term dl {
            display: grid;
            grid-template-columns: 72px 1fr;
            gap: 4px 10px;
            margin: 0;
            font-size: 13px;
        }

        .term dt {
            color: var(--muted);
        }

        .table-wrap {
            overflow: auto;
            border: 1px solid var(--line);
            border-radius: 8px;
            background: var(--panel);
        }

        table {
            width: 100%;
            min-width: 1280px;
            border-collapse: collapse;
            font-size: 13px;
        }

        th,
        td {
            vertical-align: top;
            border-bottom: 1px solid var(--line);
            padding: 10px 12px;
            text-align: left;
        }

        th {
            position: sticky;
            top: 0;
            z-index: 2;
            background: #eef2f6;
            color: #314255;
            font-size: 12px;
            font-weight: 700;
        }

        tbody tr:nth-child(even) {
            background: #fafbfc;
        }

        code {
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
            font-size: 12px;
            word-break: break-all;
        }

        .message {
            min-width: 220px;
            max-width: 340px;
            white-space: normal;
            line-height: 1.45;
        }

        .muted {
            color: var(--muted);
        }

        .pill {
            display: inline-flex;
            align-items: center;
            min-height: 22px;
            border: 1px solid var(--line);
            border-radius: 999px;
            padding: 2px 8px;
            background: #fff;
            font-size: 12px;
            font-weight: 700;
        }

        .status-imported,
        .status-reviewed,
        .status-legal-approved {
            border-color: #99d4cb;
            color: var(--accent);
        }

        .status-machine,
        .status-needs-review,
        .status-draft {
            border-color: #f3c37c;
            color: var(--warn);
        }

        .policy {
            color: var(--danger);
            font-weight: 700;
        }
    </style>
</head>
<body>
    <header>
        <div class="header-inner">
            <h1>Dutying i18n Review Board</h1>
            <div class="meta">
                <span>Generated: ${escapeHtml(generatedAt)}</span>
                <span>Messages: ${rows.length}</span>
                <span>Terms: ${terms.length}</span>
                <span>Source: apps/app/i18n/catalog/messages.csv</span>
            </div>
        </div>
    </header>
    <main>
        <section>
            <h2>Catalog Health</h2>
            <div class="stats">
                <div class="stat"><strong>${rows.length}</strong><span>Total messages</span></div>
                <div class="stat"><strong>${Object.keys(namespaceCounts).length}</strong><span>Namespaces</span></div>
                ${Object.entries(statusCounts)
                    .map(
                        ([status, count]) =>
                            `<div class="stat"><strong>${count}</strong><span>${escapeHtml(status || 'unknown')}</span></div>`,
                    )
                    .join('')}
            </div>
        </section>

        <section>
            <h2>Glossary</h2>
            <div class="terms">
                ${terms
                    .map(
                        (term) => `<article class="term">
                            <h3>${escapeHtml(term.termId)}</h3>
                            <dl>
                                <dt>KO</dt><dd>${escapeHtml(term.ko)}</dd>
                                <dt>EN</dt><dd>${escapeHtml(term.en)}</dd>
                                <dt>JA</dt><dd>${escapeHtml(term.ja)}</dd>
                                <dt>ZH</dt><dd>${escapeHtml(term.zh)}</dd>
                                <dt>TH</dt><dd>${escapeHtml(term.th)}</dd>
                                <dt>VI</dt><dd>${escapeHtml(term.vi)}</dd>
                                <dt>주의</dt><dd>${escapeHtml([term.forbiddenEn, term.forbiddenJa, term.forbiddenZh, term.forbiddenTh, term.forbiddenVi].filter(Boolean).join(' / ') || '-')}</dd>
                            </dl>
                            <p>${escapeHtml(term.description)}</p>
                        </article>`,
                    )
                    .join('')}
            </div>
        </section>

        <section>
            <h2>Messages</h2>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Namespace</th>
                            <th>Runtime Key</th>
                            <th>Owner</th>
                            <th>Surface</th>
                            <th>Status</th>
                            <th>KO</th>
                            <th>EN</th>
                            <th>JA</th>
                            <th>ZH</th>
                            <th>TH</th>
                            <th>VI</th>
                            <th>Empty</th>
                            <th>Context</th>
                            <th>Terms</th>
                            <th>Server Policy</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows
                            .map(
                                (row) => `<tr>
                                    <td><code>${escapeHtml(row.namespace)}</code></td>
                                    <td><code>${escapeHtml(row.runtimeKey)}</code></td>
                                    <td>${escapeHtml(row.owner)}</td>
                                    <td>${escapeHtml(row.surface)}</td>
                                    <td><span class="pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
                                    <td class="message">${normalizeMultiline(row.ko)}</td>
                                    <td class="message">${normalizeMultiline(row.en)}</td>
                                    <td class="message">${normalizeMultiline(row.ja)}</td>
                                    <td class="message">${normalizeMultiline(row.zh)}</td>
                                    <td class="message">${normalizeMultiline(row.th)}</td>
                                    <td class="message">${normalizeMultiline(row.vi)}</td>
                                    <td><code>${escapeHtml(row.emptyLocales)}</code></td>
                                    <td class="muted">${normalizeMultiline(row.context || row.component || row.route)}</td>
                                    <td><code>${escapeHtml(row.termIds)}</code></td>
                                    <td class="policy">${escapeHtml(row.displayPolicy || '')}</td>
                                </tr>`,
                            )
                            .join('')}
                    </tbody>
                </table>
            </div>
        </section>
    </main>
</body>
</html>
`;

mkdirSync(dirname(reviewPath), {recursive: true});
writeFileSync(reviewPath, html);

console.log(JSON.stringify({reviewPath, messages: rows.length, terms: terms.length}, null, 2));
