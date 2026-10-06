/** Local visual review only. Every API request is handled in memory; no server or LLM calls. */
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {AxiosAdapter} from 'axios';
import type {TAutofillResponse} from '@dutying/api/ward';
import {useShiftEditorStore} from '../../src/features/shift-editor';
import {buildAutofillDTO} from '../../src/features/shift-editor/model/schedule-authoring';
import {buildConversationSnapshot} from '../../src/pages/make-shift/model/conversation-snapshot';
import type {
    TConversationDetail,
    TConversationOperation,
    TConversationTurn,
    TResultVersion,
    TSemanticPlan,
} from '../../src/pages/make-shift/model/schedule-conversation-api';
import AiConversationSidebar from '../../src/pages/make-shift/ui/steps/ai-auto-fill/ai-conversation-sidebar';
import {MakeShiftCalendar} from '../../src/pages/make-shift/ui/steps/shared/make-shift-calendar';
import client from '../../src/shared/api/client';
import i18n from '../../src/i18n';
import {reviewConditions} from './ai-ux-review-request';
import '../../src/index.css';

void i18n.changeLanguage('ko');
const scene = new URLSearchParams(location.search).get('scene') ?? 'start';
const codes = ['D', 'E', 'N', 'O'];
const names = ['간호사 1', '신규 간호사 2', '간호사 3', '간호사 4', '간호사 5', '간호사 6', '간호사 7', '간호사 8'];
const createdAt = '2026-10-06T22:00:00';
const original = '신규 간호사 2는 11월 1~5일 N 근무 없이 배정하고, 간호사 3은 12일 O로 배정해줘.';
const source: TResultVersion = {
    versionId: 'local-source',
    parentVersionId: null,
    year: 2026,
    month: 11,
    createdAt,
    inputDigest: 'local',
    constraintsJson: JSON.stringify({
        rows: names.map((name, i) => ({shiftNurseId: i + 1, nurseId: i + 1, name, displayOrder: i, priority: i, divisionNum: 0})),
        shiftTypes: codes.map((code, i) => ({
            wardShiftTypeId: i + 1,
            code,
            name: code,
            isOff: i === 3,
            isCounted: true,
            color: ['#44c4b0', '#ff84a5', '#397dff', '#455a7a'][i],
            classification: ['DAY', 'EVENING', 'NIGHT', 'OFF'][i],
        })),
    }),
    cells: names.flatMap((_, i) =>
        Array.from({length: 30}, (_, d) => ({
            shiftNurseId: i + 1,
            date: `2026-11-${String(d + 1).padStart(2, '0')}`,
            wardShiftTypeId: ((Math.floor(d / 2) + i) % 4) + 1,
            shiftCode: codes[(Math.floor(d / 2) + i) % 4],
            fixed: false,
        })),
    ),
    carryOverCells: [],
    rowOrder: names.map((_, i) => ({shiftNurseId: i + 1, nurseId: i + 1, displayOrder: i, priority: i, divisionNum: 0})),
};
const {shift, doc} = buildConversationSnapshot(source);
useShiftEditorStore.getState().reset();
useShiftEditorStore.getState().setDoc(doc);
useShiftEditorStore.getState().setRulesHash('local-rules');
useShiftEditorStore.getState().setAutofillAdjustEnabled(true);
useShiftEditorStore.getState().setSemanticExecutionEnabled(true);
const dto = buildAutofillDTO({year: 2026, month: 11, doc, originalShift: shift, rulesHash: 'local-rules', draftRevision: 0});
source.cells = dto.cells;
source.rowOrder = dto.rowOrder;
source.carryOverCells = dto.carryOverCells ?? [];
let sequence = 1;
const branch: TConversationTurn = {
    eventId: 1,
    sequence: 1,
    actor: 'SYSTEM',
    type: 'BRANCH',
    text: '8cb64676-c3dc-4cc3-8053-953ae349c630에서 이어서 작성',
    interpretationId: null,
    interpretation: null,
    baseRevision: 0,
    contextHash: null,
    createdAt,
};
let detail: TConversationDetail = {
    contextHash: 'local-rules',
    activeConditionLabels: ['D 다음 날 E 근무 제외', 'N 근무 후 최소 2일 휴식'],
    conversation: {
        conversationId: 1,
        year: 2026,
        month: 11,
        revision: 0,
        currentVersionId: source.versionId,
        latestInterpretationId: null,
        createdAt,
    },
    draft: source,
    turns: [branch],
    operations: [],
};
const versions = new Map([[source.versionId, source]]);
type TLiveReview = {
    status: string;
    summary: string;
    resolvedIntents: TSemanticPlan['conditions'];
    verificationReport: {reasonCodes: string[]; groundingStatus?: string; coverageStatus?: string; compileEquivalenceStatus?: string};
};
function propose(text: string, state = 'PREVIEW_READY', live?: TLiveReview) {
    const conditions =
        live?.resolvedIntents ?? (state === 'PREVIEW_READY' ? reviewConditions(text, names, source.year, source.month) : null);
    if (state === 'PREVIEW_READY' && !conditions) state = 'UNSUPPORTED';
    detail.turns.push({
        eventId: ++sequence,
        sequence,
        actor: 'USER',
        type: 'MESSAGE',
        text,
        interpretationId: null,
        interpretation: null,
        baseRevision: detail.conversation.revision,
        contextHash: detail.contextHash,
        createdAt,
    });
    const plan: TSemanticPlan = {
        planId: `local-plan-${sequence}`,
        planHash: 'a'.repeat(64),
        sourceVersionId: detail.draft.versionId,
        state,
        summary:
            live?.summary ??
            (state === 'UNSUPPORTED'
                ? '이 미리보기에서 아직 확인할 수 없는 요청이에요.'
                : '어느 날짜에 적용할까요? 작성 중인 달의 날짜를 알려 주세요.'),
        confirmationAllowed: state === 'PREVIEW_READY',
        reasonCodes:
            live?.verificationReport.reasonCodes ??
            (state === 'FAILED'
                ? ['INVALID_SOURCE_SPAN']
                : state === 'UNSUPPORTED'
                  ? ['UNSUPPORTED_CAPABILITY']
                  : state === 'NEEDS_CLARIFICATION'
                    ? ['TIME_NOT_GROUNDED']
                    : []),
        conditions: conditions ?? [],
    };
    const turn: TConversationTurn = {
        eventId: ++sequence,
        sequence,
        actor: 'ASSISTANT',
        type: 'SEMANTIC_PLAN',
        text: null,
        interpretationId: `local-proposal-${sequence}`,
        interpretation: null,
        semanticPlan: plan,
        baseRevision: detail.conversation.revision,
        contextHash: detail.contextHash,
        createdAt,
    };
    detail.turns.push(turn);
    detail.conversation.latestInterpretationId = turn.interpretationId;
    return turn;
}
if (scene !== 'start')
    propose(
        scene === 'unsupported' ? '오프를 더 공평하게 배치해줘' : original,
        scene === 'unsupported'
            ? 'UNSUPPORTED'
            : scene === 'failure'
              ? 'FAILED'
              : scene === 'clarify'
                ? 'NEEDS_CLARIFICATION'
                : 'PREVIEW_READY',
    );

const adapter: AxiosAdapter = async (config) => {
    const url = config.url ?? '';
    const request = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    let data: unknown;
    if (url.includes('/conversation-preferences')) data = [];
    else if (url.includes('/reports')) data = {incidentId: 'local-admin-only-reference'};
    else if (url.endsWith('/branches')) {
        const selected = versions.get(request.versionId) ?? detail.draft;
        const next = {...selected, versionId: `local-branch-${++sequence}`, parentVersionId: selected.versionId};
        versions.set(next.versionId, next);
        detail = {
            ...detail,
            turns: [{...branch, eventId: ++sequence, sequence}],
            operations: [],
            draft: next,
            conversation: {
                ...detail.conversation,
                conversationId: detail.conversation.conversationId + 1,
                revision: 0,
                currentVersionId: next.versionId,
                latestInterpretationId: null,
            },
        };
        data = detail.conversation;
    } else if (/\/interpretations\/[^/]+$/.test(url) && config.method === 'put') {
        const previous = detail.turns.find((turn) => turn.interpretationId === detail.conversation.latestInterpretationId)!;
        const confirmed = {
            ...previous,
            eventId: ++sequence,
            sequence,
            type: 'SEMANTIC_PLAN_CONFIRMED',
            interpretationId: `local-confirmed-${sequence}`,
            semanticPlan: {...previous.semanticPlan!, state: 'CONFIRMED', confirmationAllowed: false},
        };
        detail.turns.push(confirmed);
        detail.conversation.latestInterpretationId = confirmed.interpretationId;
        data = confirmed;
    } else if (url.endsWith('/interpretations')) {
        {
            try {
                const response = await fetch('/__ai_ux/semantic-preview', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    signal: AbortSignal.timeout(20000),
                    body: JSON.stringify({
                        text: request.text,
                        context: {
                            year: source.year,
                            month: source.month,
                            rosterComplete: true,
                            nurses: names.map((name, index) => ({id: index + 1, name})),
                            shiftTypes: codes.map((code, index) => ({
                                code,
                                classification: ['DAY', 'EVENING', 'NIGHT', 'OFF'][index],
                                isOff: code === 'O',
                            })),
                            ruleCatalog: [
                                {code: 'STAFF_COUNT_BY_SHIFT', hardSupported: true, softSupported: false},
                                {code: 'SHIFT_COUNT_PER_PERIOD', hardSupported: true, softSupported: true},
                            ],
                        },
                    }),
                });
                if (!response.ok) throw new Error('LLM review unavailable');
                const live = (await response.json()) as TLiveReview;
                const report = live.verificationReport;
                if (
                    live.status === 'PREVIEW_READY' &&
                    (report.groundingStatus !== 'CHECKED' ||
                        report.coverageStatus !== 'CHECKED' ||
                        report.compileEquivalenceStatus !== 'VERIFIED' ||
                        report.reasonCodes.length ||
                        !live.resolvedIntents.length)
                )
                    throw new Error('Unverified LLM review');
                data = propose(request.text, live.status, live);
            } catch {
                data = propose(request.text, 'FAILED');
            }
        }
    } else if (url.endsWith('/draft')) {
        detail = {
            ...detail,
            draft: {...detail.draft, ...request},
            conversation: {...detail.conversation, revision: detail.conversation.revision + 1},
        };
        data = detail;
    } else if (url.endsWith('/operations')) {
        const operationType = request.operationType as 'GENERATE' | 'ADJUST';
        const plan = detail.turns.find((turn) => turn.interpretationId === request.interpretationId)?.semanticPlan;
        if (operationType === 'ADJUST' && plan?.conditions.some((condition) => condition.action === 'COUNT')) {
            throw new Error('횟수 조건은 실제 LLM으로 확인했지만, 이 미리보기의 표 변경은 날짜별 배정·제외만 시연할 수 있어요.');
        }
        const changed = detail.draft.cells.flatMap((cell) => {
            if (cell.fixed) return [];
            if (operationType === 'GENERATE') {
                const nextIndex = (codes.indexOf(cell.shiftCode ?? 'O') + 1) % codes.length;
                return [{...cell, wardShiftTypeId: nextIndex + 1, shiftCode: codes[nextIndex]}];
            }
            const condition = plan?.conditions.find(
                (item) =>
                    item.nurseIds.includes(cell.shiftNurseId) &&
                    item.dates.includes(cell.date) &&
                    (item.action === 'ASSIGN' || item.shiftCodes.includes(cell.shiftCode ?? '')),
            );
            if (!condition) return [];
            const code =
                condition.action === 'ASSIGN'
                    ? condition.shiftCodes[0]
                    : codes.find((candidate) => !condition.shiftCodes.includes(candidate))!;
            return code === cell.shiftCode ? [] : [{...cell, shiftCode: code, wardShiftTypeId: codes.indexOf(code) + 1}];
        });
        const resultVersion = {
            ...detail.draft,
            versionId: `local-result-${sequence}`,
            parentVersionId: detail.draft.versionId,
            cells: detail.draft.cells.map(
                (cell) => changed.find((value) => value.shiftNurseId === cell.shiftNurseId && value.date === cell.date) ?? cell,
            ),
        };
        versions.set(resultVersion.versionId, resultVersion);
        const result: TAutofillResponse = {
            operationType,
            applicable: true,
            draftRevision: detail.conversation.revision,
            resultType: 'PATCH',
            changedCells: changed,
            validation: {
                draftRevision: detail.conversation.revision,
                rulesHash: detail.contextHash,
                summary: {valid: true, hardCount: 0, softCount: 0, totalCount: 0},
                violations: [],
            },
            unmetInstructions: [],
            sameAsPrevious: false,
            engineResult: {status: 'ACCEPTED'},
        };
        const operation: TConversationOperation = {
            operationId: `local-operation-${sequence}`,
            sequence: ++sequence,
            operationType,
            fillPolicy: operationType === 'GENERATE' ? request.fillPolicy : null,
            sourceVersionId: detail.draft.versionId,
            resultVersionId: resultVersion.versionId,
            interpretationId: request.interpretationId,
            baseRevision: detail.conversation.revision,
            executionStatus: 'SUCCEEDED',
            applyStatus: 'APPLIED',
            failureReason: null,
            result,
            createdAt,
        };
        detail.operations.push(operation);
        detail.draft = resultVersion;
        detail.conversation = {
            ...detail.conversation,
            revision: detail.conversation.revision + 1,
            currentVersionId: resultVersion.versionId,
        };
        data = operation;
    } else if (url.includes('/result-versions/')) data = versions.get(url.split('/').pop()!);
    else if (/\/conversations\?/.test(url)) data = [detail.conversation];
    else if (/\/conversations\/\d+$/.test(url)) data = detail;
    else throw new Error('미리보기 밖의 요청은 차단됩니다.');
    return {data: structuredClone(data), status: 200, statusText: 'OK', headers: {}, config};
};
client.defaults.adapter = adapter;

export function Review() {
    const [open, setOpen] = useState(true);
    const currentDoc = useShiftEditorStore((state) => state.doc);
    return (
        <main className="min-h-dvh bg-[#F7F8FA] p-6" style={{paddingRight: open ? 430 : 24}}>
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-semibold">2026년 11월 근무표</h1>
                {!open && (
                    <button
                        className="min-h-11 rounded-xl bg-main-light px-4 text-sm font-medium text-main-1 hover:bg-main-1 hover:text-white"
                        onClick={() => setOpen(true)}
                    >
                        AI 자동채우기
                    </button>
                )}
            </header>
            <div className="overflow-auto rounded-xl border border-gray-6 bg-white p-4">
                <div className="min-w-[950px]">
                    <MakeShiftCalendar
                        shift={shift}
                        doc={currentDoc}
                        violationMap={new Map()}
                        showFaults={false}
                        readonly
                        staticPreview
                        showDivisionStatistics
                    />
                </div>
            </div>
            <AiConversationSidebar
                open={open}
                onClose={() => setOpen(false)}
                wardId={1}
                teamId={1}
                year={2026}
                month={11}
                shift={shift}
                adjustEnabled
                generationRequest={0}
                rebuildRequest={0}
                onApplied={() => {}}
            />
        </main>
    );
}
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<Review />);
    if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
}
