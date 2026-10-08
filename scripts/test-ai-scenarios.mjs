// Run real UI components against controlled synthetic API/model scenarios.
import {spawnSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
const {values} = parseArgs({options: {'engine-repo': {type: 'string'}, 'live-bridge': {type: 'boolean'}}});
const root = fileURLToPath(new URL('../', import.meta.url));
const app = fileURLToPath(new URL('../apps/app/', import.meta.url));
mkdirSync(`${root}/artifacts`, {recursive: true});
const suites = [
    'tests/integration/ai-ux-review.test.tsx',
    'src/pages/make-shift/model/__tests__/ai-conversation-failure.test.ts',
    'src/pages/make-shift/model/__tests__/ai-schedule-provider.test.ts',
    'src/pages/make-shift/model/__tests__/schedule-conversation-api.test.ts',
    'src/pages/make-shift/ui/steps/ai-auto-fill/__tests__/ai-conversation-sidebar.test.tsx',
    'src/pages/make-shift/ui/steps/ai-auto-fill/__tests__/ai-conversation-snapshot.test.tsx',
    'src/pages/make-shift/ui/steps/ai-auto-fill/__tests__/ai-adjust-conversation.test.tsx',
    'src/pages/make-shift/ui/steps/ai-auto-fill/__tests__/index.adjust.test.tsx',
];
const run = spawnSync(process.execPath, [
    `${app}/node_modules/vitest/vitest.mjs`, 'run', ...suites,
    '--reporter=default', '--reporter=junit', '--outputFile.junit=../../artifacts/ai-scenarios.xml',
], {cwd: app, stdio: 'inherit', env: process.env});
if (run.error) console.error('Could not start the AI scenario runner. Install workspace dependencies first.');
process.exitCode = run.status ?? 1;
if (process.exitCode === 0 && values['engine-repo']) {
    const engine = resolve(values['engine-repo']);
    const check = spawnSync(`${engine}/venv/bin/python`, [
        '-m', 'pytest', '-q', '--tb=short',
        'tests/unit/test_two_shift_solver.py',
        'tests/unit/test_intent_pipeline.py',
        'tests/unit/test_model_normalized_intent.py',
        'tests/unit/test_semantic_clarification.py',
        'tests/unit/test_adjust_scenario_corpus.py',
        `--junitxml=${root}/artifacts/ai-engine-scenarios.xml`,
    ], {cwd: engine, stdio: 'inherit', env: process.env});
    if (check.error) console.error('Could not start engine scenarios. Check the repository path and its Python environment.');
    process.exitCode = check.status ?? 1;
}

// Explicit opt-in: these three model calls use only the fixed synthetic review roster.
if (process.exitCode === 0 && values['live-bridge']) {
    const period = [1, 2, 3, 4, 5].map((day) => `2026-11-0${day}`);
    const condition = (action, nurseIds, dates, shiftCodes) => ({action, nurseIds, dates, shiftCodes});
    const cases = [
        {id: 'LLM-NURSE-UNTIL', text: '간호사 1 5일까지 N 없게 해줘.', status: 'PREVIEW_READY',
            conditions: [condition('FORBID', [1], period, ['N'])]},
        {id: 'LLM-MULTI', text: '신규 간호사 2는 11월 1~5일 N 근무 없이 배정하고, 간호사 3은 12일 O로 배정해줘.', status: 'PREVIEW_READY',
            conditions: [condition('FORBID', [2], period, ['N']), condition('ASSIGN', [3], ['2026-11-12'], ['O'])]},
        {id: 'LLM-CLARIFY', text: '간호사 1에 1~5일 근무를 없애줘.', status: 'NEEDS_CLARIFICATION', conditions: []},
    ];
    const context = {
        year: 2026, month: 11, rosterComplete: true,
        nurses: ['간호사 1', '신규 간호사 2', ...[3,4,5,6,7,8].map((id) => `간호사 ${id}`)].map((name, i) => ({id: i + 1, name})),
        shiftTypes: ['D','E','N','O'].map((code, i) => ({code, classification: ['DAY','EVENING','NIGHT','OFF'][i], isOff: code === 'O'})),
        ruleCatalog: [{code:'STAFF_COUNT_BY_SHIFT', hardSupported:true, softSupported:false},
                      {code:'SHIFT_COUNT_PER_PERIOD', hardSupported:true, softSupported:true}],
    };
    const normalize = (intents) => intents.map(({action,nurseIds,dates,shiftCodes}) => ({
        action, nurseIds:[...nurseIds].sort((a,b)=>a-b), dates:[...dates].sort(), shiftCodes:[...shiftCodes].sort(),
    })).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const results = [];
    for (const scenario of cases) {
        const start = Date.now();
        try {
            const response = await fetch('http://127.0.0.1:38083/semantic-preview', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body:JSON.stringify({text:scenario.text,context}), signal:AbortSignal.timeout(22000),
            });
            if (!response.ok) throw new Error('MODEL_CONNECTION');
            const result = await response.json();
            const equivalent = JSON.stringify(normalize(result.resolvedIntents ?? [])) === JSON.stringify(normalize(scenario.conditions));
            const verified = scenario.status !== 'PREVIEW_READY' || (
                result.verificationReport?.groundingStatus === 'CHECKED' &&
                result.verificationReport?.coverageStatus === 'CHECKED' &&
                result.verificationReport?.compileEquivalenceStatus === 'VERIFIED'
            );
            const passed = result.status === scenario.status && equivalent && verified;
            results.push({id:scenario.id,passed,status:result.status,elapsedMs:Date.now()-start});
        } catch {
            results.push({id:scenario.id,passed:false,status:'CONNECTION_FAILED',elapsedMs:Date.now()-start});
        }
    }
    writeFileSync(`${root}/artifacts/live-ai-scenarios.json`, JSON.stringify(results,null,2)+'\n');
    results.forEach((result) => console.log(`${result.id}: ${result.passed ? 'PASS' : 'FAIL'} (${result.status}, ${result.elapsedMs}ms)`));
    if (results.some((result) => !result.passed)) process.exitCode = 1;
}
