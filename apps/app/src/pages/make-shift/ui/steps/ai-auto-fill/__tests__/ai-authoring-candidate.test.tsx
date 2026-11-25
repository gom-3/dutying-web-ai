import {describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {candidate, outcome, response} from '../../../../model/__tests__/fixtures/intent-first';
import {authoringMessageKey} from '../../../../model/intent-first-authoring';
import {AiAuthoringCandidate} from '../ai-authoring-candidate';
import {AiConversationResult} from '../ai-conversation-result';
import {AiConversationResultDetails} from '../ai-conversation-result-details';

const props = () => ({
    result: response({
        changedCells: [],
        applicable: false,
        validationTarget: 'CANDIDATE',
        candidate: candidate({selectionReason: 'QUALITATIVE_REVIEW'}),
        authoringOutcome: outcome({draftState: 'PREVIEW_ONLY', requestState: 'NEEDS_REVIEW', candidateDigest: 'digest:1'}),
    }),
    sourceVersionId: 'source:1',
    baseline: [{...candidate().changedCells[0]!, shiftCode: 'O'}],
    nurseName: () => '합성 간호사 A',
    current: true,
    disabled: false,
    onApply: vi.fn(),
});

describe('reviewable authoring candidate', () => {
    it('shows the actual before/after diff and waits for explicit selection', async () => {
        const input = props();

        render(<AiAuthoringCandidate {...input} />);
        expect(screen.getByRole('table')).toHaveTextContent('합성 간호사 A');
        expect(screen.getByRole('cell', {name: 'O'})).toBeVisible();
        expect(screen.getByRole('cell', {name: 'D'})).toBeVisible();
        expect(input.onApply).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: i18n.t('aiConversationSidebar.authoring.apply')}));
        expect(input.onApply).toHaveBeenCalledOnce();
    });
    it('shows original night bounds and actual candidate violations without treating SATISFIED as applied', () => {
        const input = props();

        input.result.authoringOutcome = outcome({draftState: 'CONSENT_REQUIRED', requestState: 'SATISFIED', candidateDigest: 'digest:1'});
        input.result.engineResult = {
            status: 'CONSENT_REQUIRED',
            solver: {
                conflictEvidence: [
                    {
                        type: 'NIGHT_RUN_BOUNDS_CONFLICT',
                        ruleIds: [51, 52],
                        shiftNurseId: 1,
                        nurseName: '합성 간호사 A',
                        minimum: 14,
                        maximum: 3,
                        actual: 1,
                        startDate: '2026-10-31',
                        endDate: '2026-11-01',
                    },
                ],
            },
        };
        input.result.candidate!.selectionReason = 'MATERIAL_TRADEOFF';
        input.result.candidate!.violations = [
            {
                violationId: 'remaining',
                ruleId: 51,
                templateCode: 'CORE_MIN_CONTINUOUS_NIGHT',
                severity: 'HARD',
                message: '후보의 실제 연속 야간 3회 / 원래 최소 14회',
                affectedCells: [],
                fixable: false,
            },
        ];
        expect(authoringMessageKey(input.result)).toBe('CONSENT_REQUIRED');

        const before = structuredClone(input.result);

        render(<AiAuthoringCandidate {...input} />);
        expect(screen.getByRole('list')).toHaveTextContent('최소 14회 / 최대 3회');
        expect(screen.getByRole('list')).toHaveTextContent('2026-10-31');
        expect(screen.getByRole('list')).toHaveTextContent('2026-11-01');
        expect(screen.getByRole('list')).toHaveTextContent('이어진 야간 1회');
        expect(screen.getByRole('list')).toHaveTextContent('후보의 실제 연속 야간 3회');
        expect(input.onApply).not.toHaveBeenCalled();
        expect(input.result).toEqual(before);
        expect(screen.queryByText(i18n.t('aiConversationSidebar.authoring.SATISFIED'))).toBeNull();
    });
    it('shows the raw proposal without actions or an expiration warning', () => {
        const input = props();
        input.result.candidate = candidate({selectionReason: 'INTERPRETATION_RECOVERY_UNVERIFIED', token: null});
        render(<AiAuthoringCandidate {...input} />);
        expect(screen.getByRole('table')).toBeVisible();
        expect(screen.getByRole('status')).toHaveTextContent(i18n.t('aiConversationSidebar.authoring.recoveryPreviewOnly'));
        expect(screen.queryByRole('button', {name: i18n.t('aiConversationSidebar.authoring.apply')})).not.toBeInTheDocument();
        expect(input.onApply).not.toHaveBeenCalled();
    });
    it('retains an expired candidate diff but disables execution', () => {
        const input = props();

        input.result.candidate!.expiresAt = '2000-01-01T00:00:00Z';
        render(<AiAuthoringCandidate {...input} />);
        expect(screen.getByRole('table')).toBeVisible();
        expect(screen.getByRole('button', {name: i18n.t('aiConversationSidebar.authoring.apply')})).toBeDisabled();
        expect(screen.getByRole('status')).toHaveTextContent(i18n.t('aiConversationSidebar.authoring.expired'));
    });
    it('keeps the original table without sending consent', async () => {
        const input = props();

        render(<AiAuthoringCandidate {...input} />);
        await userEvent.click(screen.getByRole('button', {name: i18n.t('aiConversationSidebar.authoring.keep')}));
        expect(input.onApply).not.toHaveBeenCalled();
        expect(screen.getByRole('table')).toBeVisible();
        expect(screen.queryByRole('button', {name: i18n.t('aiConversationSidebar.authoring.apply')})).toBeNull();
    });
    it.each(['PARTIAL', 'NEEDS_REVIEW', 'NO_IMPROVEMENT', 'ALREADY_SATISFIED'] as const)(
        'does not show an adjustment-success icon for %s',
        (requestState) => {
            render(
                <AiConversationResult
                    appliedLocally={requestState === 'PARTIAL' || requestState === 'NEEDS_REVIEW'}
                    operation={{
                        operationId: 'op:1',
                        sequence: 1,
                        operationType: 'ADJUST',
                        sourceVersionId: 'source:1',
                        resultVersionId: 'result:1',
                        interpretationId: null,
                        baseRevision: 0,
                        executionStatus: 'SUCCEEDED',
                        applyStatus: requestState === 'PARTIAL' || requestState === 'NEEDS_REVIEW' ? 'APPLIED' : 'NOT_APPLIED_NO_CHANGE',
                        fillPolicy: null,
                        failureReason: null,
                        createdAt: '',
                        result: response({
                            authoringOutcome: outcome({
                                requestState,
                                draftState:
                                    requestState === 'NO_IMPROVEMENT' || requestState === 'ALREADY_SATISFIED' ? 'NONE' : 'APPLICABLE',
                            }),
                        }),
                    }}
                    attempt={1}
                    copy={(ko) => ko}
                />,
            );

            const applied = requestState === 'PARTIAL' || requestState === 'NEEDS_REVIEW';
            const title = applied
                ? i18n.t('aiAutofillUi.conversationResult.appliedChangeCount', {count: 1})
                : i18n.t(`aiConversationSidebar.authoring.${requestState}`);

            expect(screen.getByText(title)).toBeVisible();
            expect(screen.queryByRole('img', {name: /adjustmentSucceeded|수정 완료|수정 성공/})).toBeNull();
        },
    );
});

describe('plain candidate copy', () => {
    it.each([
        {
            locale: 'ko',
            title: '이렇게 바꿔볼까요?',
            prompt: '바뀐 근무가 원하던 내용과 맞는지 확인해 주세요.',
            applied: '1칸을 바꿨어요.',
            review: '확인할 조건이 남았어요.',
        },
        {
            locale: 'en',
            title: 'How about these changes?',
            prompt: 'Check the changes to see whether this is the arrangement you wanted.',
            applied: 'Updated 1 shift.',
            review: 'Some conditions need a review.',
        },
        {
            locale: 'ja',
            title: 'このように変えてみませんか？',
            prompt: '変更内容を見て、ご希望の配置になっているかご確認ください。',
            applied: '勤務を1件変更しました。',
            review: '確認が必要な条件があります。',
        },
    ])('uses a single natural prompt in $locale without a technical review claim', async ({locale, title, prompt, applied, review}) => {
        await i18n.changeLanguage(locale);

        try {
            const input = props();
            const operation = {
                operationId: 'op:copy',
                sequence: 1,
                operationType: 'ADJUST' as const,
                sourceVersionId: 'source:1',
                resultVersionId: null,
                interpretationId: null,
                baseRevision: 0,
                executionStatus: 'SUCCEEDED' as const,
                applyStatus: 'NOT_APPLIED_REVIEW',
                fillPolicy: null,
                failureReason: null,
                createdAt: '',
                result: input.result,
            };
            const {rerender, container} = render(
                <AiConversationResult operation={operation} attempt={1} copy={(ko) => ko}>
                    <AiConversationResultDetails result={input.result} />
                    <AiAuthoringCandidate {...input} />
                </AiConversationResult>,
            );

            expect(screen.getByText(title)).toBeVisible();
            expect(screen.getAllByText(prompt)).toHaveLength(1);
            expect(container).not.toHaveTextContent(/EXACT|REVIEW|정성|미검증|검사|unverified|qualitative|未検証|定性的/);
            expect(container.querySelector('details')).toHaveAttribute('open');
            expect(container).not.toHaveTextContent(/1회차|attempt 1/i);
            rerender(
                <AiConversationResult
                    appliedLocally
                    operation={{
                        ...operation,
                        applyStatus: 'APPLIED',
                        result: response({authoringOutcome: outcome({requestState: 'NEEDS_REVIEW'})}),
                    }}
                    attempt={1}
                    copy={(ko) => ko}
                />,
            );
            expect(screen.getByText(applied)).toBeVisible();
            expect(screen.getByText(review)).toBeVisible();
            expect(container.querySelector('svg[aria-label="success"]')).toBeNull();
        } finally {
            await i18n.changeLanguage('ko');
        }
    });
});

describe('material consent title', () => {
    it.each([
        {locale: 'ko', title: '요청한 근무 변경안을 확인해 주세요', impact: '11월 1일 휴무가 1명 줄어들어요.'},
        {locale: 'ja', title: '依頼した勤務変更案をご確認ください', impact: '11月1日の休みが1人減ります。'},
    ])('describes unmet conditions rather than editing settings in $locale', async ({locale, title, impact}) => {
        await i18n.changeLanguage(locale);

        try {
            const input = props();

            input.result.authoringOutcome = outcome({draftState: 'CONSENT_REQUIRED', candidateDigest: 'digest:1'});
            input.result.candidate = candidate({
                selectionReason: 'MATERIAL_TRADEOFF',
                violations: [
                    {
                        violationId: 'impact:1',
                        ruleId: 1,
                        templateCode: 'SYNTHETIC',
                        severity: 'HARD',
                        message: impact,
                        affectedCells: [],
                        fixable: true,
                    },
                ],
            });
            render(
                <AiConversationResult
                    operation={{
                        operationId: 'op:material-copy',
                        sequence: 1,
                        operationType: 'ADJUST',
                        fillPolicy: null,
                        sourceVersionId: 'source:1',
                        resultVersionId: null,
                        interpretationId: null,
                        baseRevision: 0,
                        executionStatus: 'SUCCEEDED',
                        applyStatus: 'NOT_APPLIED_REVIEW',
                        failureReason: null,
                        result: input.result,
                        createdAt: '',
                    }}
                    attempt={1}
                    copy={(ko) => ko}
                >
                    <AiAuthoringCandidate {...input} />
                </AiConversationResult>,
            );
            expect(screen.getByText(title)).toBeVisible();
            expect(screen.getByText(impact)).toBeVisible();
            expect(screen.getByRole('table')).toHaveTextContent('O');
            expect(screen.getByRole('table')).toHaveTextContent('D');
            expect(screen.getByRole('button', {name: i18n.t('aiConversationSidebar.authoring.apply')})).toBeEnabled();
            expect(screen.getByRole('button', {name: i18n.t('aiConversationSidebar.authoring.keep')})).toBeEnabled();
            expect(input.onApply).not.toHaveBeenCalled();
        } finally {
            await i18n.changeLanguage('ko');
        }
    });
});

it('shows why an unsuccessful search left the roster unchanged', () => {
    render(
        <AiConversationResult
            operation={{
                operationId: 'op-feedback',
                sequence: 1,
                resultVersionId: null,
                interpretationId: null,
                fillPolicy: null,
                failureReason: null,
                createdAt: '',
                operationType: 'ADJUST',
                baseRevision: 0,
                sourceVersionId: 'source:1',
                executionStatus: 'SUCCEEDED',
                applyStatus: 'NOT_APPLIED_NO_CHANGE',
                result: response({
                    changedCells: [],
                    applicable: false,
                    authoringOutcome: outcome({draftState: 'NONE', requestState: 'NO_IMPROVEMENT'}),
                }),
            }}
            attempt={1}
            copy={(ko) => ko}
        />,
    );
    expect(screen.getByText(i18n.t('aiConversationSidebar.authoring.searchNoImprovement'))).toBeVisible();
});

describe('recorded nurse-facing request-first guidance', () => {
    it('shows the current monthly limit, exact proposal and ward shift name before consent', () => {
        const input = props();
        input.result.authoringOutcome = outcome({
            draftState: 'CONSENT_REQUIRED',
            candidateDigest: 'digest:1',
            requestPriority: {
                version: 'request-first-v2',
                settingChangesRequired: true,
                settingChanges: [
                    {
                        templateCode: 'SHIFT_COUNT_PER_PERIOD',
                        ruleId: 71,
                        currentValue: 21,
                        proposedValue: 22,
                        year: 2026,
                        month: 11,
                        lifetime: 'OPERATION_MONTH',
                        userMessage:
                            '합성 간호사 A님의 이번 변경안은 한 달에 22일 근무하는 배치예요. 현재 월 최대 근무일은 21일이에요. 이번 달 이 변경안에만 22일까지 허용할까요?',
                    },
                ],
                availabilityChanges: [
                    {
                        kind: 'ADD_ALLOWED_SHIFT',
                        shiftNurseId: '1',
                        nurseId: 1,
                        wardShiftTypeId: 3,
                        code: 'X',
                        currentValue: [1],
                        proposedValue: [1, 3],
                        year: 2026,
                        month: 11,
                        lifetime: 'OPERATION_MONTH',
                        dates: ['2026-11-01'],
                        userMessage:
                            '합성 간호사 A님은 현재 긴밤 근무를 하지 않는 것으로 설정되어 있어요. 이번 달 이 변경안에서는 긴밤 근무가 가능하도록 바꿀까요?',
                    },
                ],
            },
        });
        render(<AiAuthoringCandidate {...input} />);
        expect(screen.getByText(/현재 월 최대 근무일은 21일/)).toBeVisible();
        expect(screen.getByText(/긴밤 근무가 가능하도록 바꿀까요/)).toBeVisible();
        expect(document.body.textContent).not.toMatch(/CP-SAT|compiler|schema|fallback|HARD|SOFT|overlay|trace:/);
        expect(input.onApply).not.toHaveBeenCalled();
    });
    it('shows an honest unfinished-search message without technical codes', () => {
        const result = response({
            changedCells: [],
            applicable: false,
            validationTarget: 'BASELINE',
            authoringOutcome: outcome({
                solveState: 'UNKNOWN',
                requestState: 'NO_IMPROVEMENT',
                draftState: 'NONE',
                requestPriority: {
                    version: 'request-first-v2',
                    userSummary: '조건에 맞는 변경안을 아직 찾지 못했어요. 근무표는 그대로예요.',
                },
            }),
        });
        render(
            <AiConversationResult
                operation={{
                    operationId: 'synthetic',
                    sequence: 1,
                    operationType: 'ADJUST',
                    sourceVersionId: 'source:1',
                    resultVersionId: null,
                    interpretationId: null,
                    baseRevision: 0,
                    executionStatus: 'SUCCEEDED',
                    applyStatus: 'NOT_APPLIED_NO_CHANGE',
                    fillPolicy: null,
                    failureReason: null,
                    createdAt: '',
                    result,
                }}
                attempt={1}
                copy={(ko) => ko}
            />,
        );
        expect(screen.getAllByText(/조건에 맞는 변경안을 아직 찾지 못했어요/).length).toBeGreaterThan(0);
        expect(document.body.textContent).not.toMatch(/CP-SAT|infeasible|UNKNOWN|schema|overlay/);
    });
});

it('keeps a measured quality impact visible in the compact applied result', () => {
    const result = response({
        authoringOutcome: outcome({
            requestPriority: {version: 'request-first-v2', userQualityWarnings: ['합성 간호사 A님의 연속근무가 4일에서 6일로 늘었어요.']},
        }),
    });
    render(
        <AiConversationResult
            operation={{
                operationId: 'synthetic',
                sequence: 1,
                operationType: 'ADJUST',
                sourceVersionId: 'source:1',
                resultVersionId: 'result:1',
                interpretationId: null,
                baseRevision: 0,
                executionStatus: 'SUCCEEDED',
                applyStatus: 'APPLIED',
                fillPolicy: null,
                failureReason: null,
                createdAt: '',
                result,
            }}
            appliedLocally
            attempt={1}
            copy={(ko) => ko}
        />,
    );
    expect(screen.getByText('합성 간호사 A님의 연속근무가 4일에서 6일로 늘었어요.')).toBeVisible();
    expect(screen.getByRole('img', {name: i18n.t('aiAutofillUi.conversationResult.scheduleNeedsReview')})).toBeVisible();
});

it('separates named requested shifts, exact monthly permission and measured side effects without retry counts', async () => {
    const input = props();
    const a = {...candidate().changedCells[0]!, date: '2026-10-31', cellKey: '1:2026-10-31', wardShiftTypeId: 3, shiftCode: 'N'};
    const b = {...a, shiftNurseId: 2, cellKey: '2:2026-10-31', wardShiftTypeId: 2, shiftCode: 'E'};
    input.baseline = [
        {...a, wardShiftTypeId: 4, shiftCode: 'O'},
        {...b, wardShiftTypeId: 3, shiftCode: 'N'},
    ];
    input.result.candidate = candidate({changedCells: [a, b], selectionReason: 'MATERIAL_TRADEOFF'});
    input.result.authoringOutcome = outcome({
        draftState: 'CONSENT_REQUIRED',
        candidateDigest: 'digest:1',
        requestPriority: {
            version: 'request-first-v2',
            settingChangesRequired: true,
            candidateImpactsAvailable: true,
            shiftDisplayNames: {'2': '이브닝', '3': '긴밤', '4': '휴무'},
            userQualityWarnings: ['합성 간호사 A님의 연속 야간근무가 0일에서 1일로 늘었어요.'],
            requestedAssignments: [
                {
                    clauseId: 'exact:1',
                    coversWholeClause: true,
                    shiftNurseId: 1,
                    nurseName: '가상하나',
                    date: '2026-10-31',
                    beforeShiftName: '휴무',
                    afterShiftName: '긴밤',
                    beforeWardShiftTypeId: 4,
                    afterWardShiftTypeId: 3,
                    alreadyMatched: false,
                },
                {
                    clauseId: 'exact:2',
                    coversWholeClause: true,
                    shiftNurseId: 3,
                    nurseName: '가상셋',
                    date: '2026-10-31',
                    beforeShiftName: '휴무',
                    afterShiftName: '휴무',
                    beforeWardShiftTypeId: 4,
                    afterWardShiftTypeId: 4,
                    alreadyMatched: true,
                },
            ],
            availabilityChanges: [
                {
                    kind: 'ADD_ALLOWED_SHIFT',
                    shiftNurseId: '1',
                    nurseId: 11,
                    code: 'N',
                    wardShiftTypeId: 3,
                    currentValue: [1, 4],
                    proposedValue: [1, 3, 4],
                    year: 2026,
                    month: 10,
                    lifetime: 'EXACT_CANDIDATE_OPERATION',
                    dates: ['2026-10-31'],
                    userMessage: '가상하나는 현재 긴밤 근무를 하지 않도록 설정돼 있어요. 이번 달 이 변경안에만 긴밤 근무를 허용할까요?',
                },
            ],
            candidateImpacts: [
                {
                    kind: 'recovery',
                    state: 'VERIFIED',
                    message: '가상둘: 10/31 07:00 종료 → 10/31 15:00 시작, 간격 8시간. 기존은 16시간이었어요.',
                    details: {beforeMinutes: 960, afterMinutes: 480},
                },
                {
                    kind: 'assignmentCounts',
                    state: 'VERIFIED',
                    message: '야간 배정 횟수: 가상하나 0회 → 1회 / 가상둘 2회 → 1회.',
                    details: {},
                },
            ],
        },
    });
    const result = input.result;
    const {container} = render(
        <AiConversationResult
            operation={{
                operationId: 'proposal:ux',
                sequence: 1,
                operationType: 'ADJUST',
                fillPolicy: null,
                sourceVersionId: 'source:1',
                resultVersionId: null,
                interpretationId: 'fresh-plan',
                baseRevision: 0,
                executionStatus: 'SUCCEEDED',
                applyStatus: 'NOT_APPLIED_REVIEW',
                failureReason: null,
                result,
                createdAt: '',
            }}
            attempt={4}
            copy={(ko) => ko}
        >
            <AiAuthoringCandidate {...input} />
        </AiConversationResult>,
    );
    expect(screen.getByText('10/31 가상하나: 휴무 → 긴밤')).toBeVisible();
    expect(screen.getByText('10/31 가상셋: 이미 휴무예요')).toBeVisible();
    const request = screen.getByText('요청별 결과');
    const settings = screen.getByText(i18n.t('aiConversationSidebar.authoring.settingChangesTitle'));
    const impacts = screen.getByText('함께 달라지는 근무');
    expect(request.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(settings.compareDocumentPosition(impacts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/가상하나는 현재 긴밤/)).toBeVisible();
    expect(screen.getByText(/간격 8시간/)).toBeVisible();
    expect(screen.getByText(/가상하나 0회 → 1회/)).toBeVisible();
    expect(screen.queryByText(/연속 야간근무가 0일/)).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent(/4회차|조건 2개|조건 1개/);
    expect(screen.getByRole('button', {name: '위 설정을 이번 달만 허용하고 근무 반영'})).toBeEnabled();
    expect(input.onApply).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText('전체 2칸 변경 내역 보기'));
    expect(screen.getByRole('table')).toHaveTextContent('긴밤');
    expect(screen.getByRole('table')).toHaveTextContent('이브닝');
});
