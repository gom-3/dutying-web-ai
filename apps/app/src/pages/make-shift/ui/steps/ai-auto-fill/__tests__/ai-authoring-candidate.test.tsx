import {describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {authoringMessageKey} from '../../../../model/intent-first-authoring';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {candidate, outcome, response} from '../../../../model/__tests__/fixtures/intent-first';
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
            expect(
                screen.getByText(
                    i18n.t(`aiConversationSidebar.authoring.${requestState === 'NEEDS_REVIEW' ? 'selectedReview' : requestState}`),
                ),
            ).toBeVisible();
            expect(screen.queryByRole('img', {name: /adjustmentSucceeded|수정 완료|수정 성공/})).toBeNull();
        },
    );
});

describe('plain candidate copy', () => {
    it.each([
        {
            locale: 'ko',
            title: '이렇게 바꿔볼까요?',
            prompt: '변경 내용을 보고 원하신 배치인지 확인해 주세요.',
            applied: '변경을 표에 반영했어요. 결과를 확인해 주세요.',
        },
        {
            locale: 'en',
            title: 'How about these changes?',
            prompt: 'Check the changes to see whether this is the arrangement you wanted.',
            applied: 'Applied the changes to the schedule. Review the result.',
        },
        {
            locale: 'ja',
            title: 'このように変えてみませんか？',
            prompt: '変更内容を見て、ご希望の配置になっているかご確認ください。',
            applied: '変更を勤務表に反映しました。結果をご確認ください。',
        },
    ])('uses a single natural prompt in $locale without a technical review claim', async ({locale, title, prompt, applied}) => {
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
            expect(container.querySelector('details')).toBeNull();
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
            expect(container.querySelector('svg[aria-label="success"]')).toBeNull();
        } finally {
            await i18n.changeLanguage('ko');
        }
    });
});

describe('material consent title', () => {
    it.each([
        {locale: 'ko', title: '일부 조건을 지키지 못해요. 이대로 반영할까요?', impact: '11월 1일 휴무가 1명 줄어들어요.'},
        {locale: 'ja', title: '一部の条件を満たせません。このまま反映しますか？', impact: '11月1日の休みが1人減ります。'},
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
