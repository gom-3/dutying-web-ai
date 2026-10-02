import type {TScheduleAdjustInterpretRes, TScheduleMonthRequestRes} from '@dutying/api/ward';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import AiAdjustTextInput from '../ai-adjust-text-input';

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
    }),
}));

const nurses = [
    {nurseId: 1, name: '김서현'},
    {nurseId: 2, name: '박지현'},
];
const interpreted: TScheduleAdjustInterpretRes = {
    items: [{kind: 'KNOB', knob: 'OFF_BALANCE', value: 1, displayLabel: '오프 균형', lifetimeHint: 'TEAM'}],
    unmapped: [],
    strength: 'LIGHT',
};
const textbox = () => screen.getByRole('textbox');

function answerDefaultQuestions() {
    for (let count = 0; count < 20; count++) {
        const button =
            screen.queryByRole('button', {name: 'aiAdjust.savedRequests.lifetime.MONTH'}) ??
            screen.queryByRole('button', {name: 'page.makeShift.aiRefill.adjust.severity.SOFT'});
        if (!button) break;
        fireEvent.click(button);
    }
}
async function submit(text: string, answer = true) {
    fireEvent.change(textbox(), {target: {value: text}});
    fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
    await waitFor(() => expect(screen.queryByText('aiAdjust.reviewing')).not.toBeInTheDocument());
    if (answer) answerDefaultQuestions();
}

describe('AI adjustment conversation', () => {
    it('accepts a typed period answer without another interpretation and waits for an explicit apply reply', async () => {
        const interpret = vi.fn().mockResolvedValue(interpreted);
        const apply = vi.fn();
        render(<AiAdjustTextInput disabled={false} interpret={interpret} onApply={apply} goalNurses={nurses} />);
        await submit('오프를 공평하게', false);
        expect(textbox()).toBeEnabled();
        expect(screen.getByRole('group', {name: 'aiAdjust.chat.question.lifetime'})).toBeVisible();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.applyReply'})).not.toBeInTheDocument();
        fireEvent.change(textbox(), {target: {value: '네'}});
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
        expect(apply).not.toHaveBeenCalled();
        expect(interpret).toHaveBeenCalledTimes(1);
        expect(screen.getByText('aiAdjust.chat.chooseAnswer')).toBeVisible();
        fireEvent.change(textbox(), {target: {value: '이번 달만'}});
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
        expect(screen.getByText('aiAdjust.savedRequests.lifetime.MONTH')).toBeVisible();
        expect(interpret).toHaveBeenCalledTimes(1);
        expect(apply).not.toHaveBeenCalled();
        fireEvent.change(textbox(), {target: {value: '반영해 주세요'}});
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
        await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
        expect(apply.mock.calls[0]![0][0].lifetime).toBe('MONTH');
    });

    it('reopens an earlier answer and clears later answers before allowing application', async () => {
        const apply = vi.fn();
        render(
            <AiAdjustTextInput
                disabled={false}
                interpret={vi.fn().mockResolvedValue({
                    items: [{kind: 'RULE', templateCode: 'MAX_CONSECUTIVE_SHIFT', params: {count: 4}, displayLabel: '데이 4일 제한'}],
                    unmapped: [],
                })}
                onApply={apply}
                goalNurses={nurses}
            />,
        );
        await submit('데이는 4일까지만', false);
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.savedRequests.lifetime.MONTH'}));
        fireEvent.click(screen.getByRole('button', {name: 'page.makeShift.aiRefill.adjust.severity.HARD'}));
        fireEvent.click(screen.getAllByRole('button', {name: 'aiAdjust.chat.changeAnswer'})[0]!);
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.applyReply'})).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.savedRequests.lifetime.TEAM'}));
        fireEvent.click(screen.getByRole('button', {name: 'page.makeShift.aiRefill.adjust.severity.SOFT'}));
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
        expect(apply.mock.calls[0]![0][0]).toMatchObject({lifetime: 'TEAM', severity: 'SOFT'});
    });

    it('collects a goal tolerance and nurse groups in sequence, then starts over without applying', async () => {
        const apply = vi.fn();
        render(
            <AiAdjustTextInput
                disabled={false}
                interpret={vi.fn().mockResolvedValue({
                    items: [{kind: 'GOAL', goalType: 'MINIMIZE_SINGLE_NIGHT_RUNS', displayLabel: '단독 나이트 줄이기'}],
                    unmapped: [],
                })}
                onApply={apply}
                goalNurses={nurses}
            />,
        );
        await submit('단독 나이트를 줄여줘', false);
        fireEvent.change(textbox(), {target: {value: '3일 이내'}});
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
        expect(screen.getByText('aiAdjust.chat.withinDays {"count":3}')).toBeVisible();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.confirmPeople'}));
        const comparison = screen.getByRole('group', {name: 'aiAdjust.chat.question.comparisonNurses'});
        fireEvent.click(within(comparison).getByRole('button', {name: '박지현'}));
        expect(within(comparison).getByRole('button', {name: 'aiAdjust.chat.confirmPeople'})).toBeDisabled();
        fireEvent.click(within(comparison).getByRole('button', {name: '박지현'}));
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.confirmPeople'}));
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'})).toBeEnabled();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.applyReply'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.changeAnswer'})).not.toBeInTheDocument();
        expect(screen.queryByRole('log')).not.toBeInTheDocument();
        expect(screen.getByText('aiAdjust.welcome')).toBeVisible();
        expect(screen.getByText('aiAdjust.examples')).toBeVisible();
        expect(apply).not.toHaveBeenCalled();
        expect(textbox()).toHaveValue('');
    });

    it('keeps generation guidance local and singular through adjustment and new conversations', async () => {
        const interpret = vi.fn().mockResolvedValue(interpreted);
        const apply = vi.fn();
        const {rerender} = render(
            <AiAdjustTextInput generationCompleted disabled={false} interpret={interpret} onApply={apply} goalNurses={nurses} />,
        );
        expect(screen.getAllByText('aiAdjust.generationCompleted')).toHaveLength(1);
        expect(interpret).not.toHaveBeenCalled();
        fireEvent.change(textbox(), {target: {value: '   '}});
        fireEvent.keyDown(textbox(), {key: 'Enter'});
        expect(screen.getByRole('button', {name: 'aiAdjust.send'})).toBeDisabled();
        expect(interpret).not.toHaveBeenCalled();
        expect(apply).not.toHaveBeenCalled();

        await submit('오프를 공평하게');
        expect(screen.queryByText('aiAdjust.examples')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'aiAdjust.offExample'})).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        await screen.findByText('aiAdjust.result');
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));
        rerender(<AiAdjustTextInput generationCompleted disabled={false} interpret={interpret} onApply={apply} goalNurses={nurses} />);

        expect(screen.getAllByText('aiAdjust.generationCompleted')).toHaveLength(1);
        expect(interpret).toHaveBeenCalledExactlyOnceWith('오프를 공평하게');
        expect(screen.getByText('aiAdjust.examples')).toBeVisible();
        expect(screen.queryByRole('log')).not.toBeInTheDocument();
        expect(apply.mock.calls[0]![1]).toBe('오프를 공평하게');
    });

    it('fills examples without interpreting or applying and uses real nurse names', () => {
        const interpret = vi.fn();
        const apply = vi.fn();

        render(
            <AiAdjustTextInput disabled={false} interpret={interpret} onApply={apply} goalNurses={nurses} shiftCodes={['D', 'N', 'O']} />,
        );
        expect(screen.getByText('aiAdjust.intro')).toBeVisible();
        expect(screen.getByText('aiAdjust.introDetail')).toBeVisible();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.offExample'}));
        expect(textbox()).toHaveValue('aiAdjust.offExample');
        expect(interpret).not.toHaveBeenCalled();
        expect(apply).not.toHaveBeenCalled();
        expect(screen.getByRole('button', {name: /aiAdjust.cellExample.*김서현.*박지현/})).toBeVisible();
        expect(
            textbox().compareDocumentPosition(screen.getByRole('button', {name: 'aiAdjust.offExample'})) & Node.DOCUMENT_POSITION_PRECEDING,
        ).toBeTruthy();
    });
    it('shows nurse names for rule targets and preserves the rule when period and priority are changed', async () => {
        const apply = vi.fn();
        const rule = {
            kind: 'RULE' as const,
            templateCode: 'MAX_CONSECUTIVE_SHIFT',
            displayLabel: '데이 연속 근무 제한',
            params: {target: [1, 2], shift: 'D', count: 4},
            condition: {key: 'PATIENT_COUNT', operator: 'GTE' as const, value: 20},
        };
        render(
            <AiAdjustTextInput
                disabled={false}
                interpret={vi.fn().mockResolvedValue({items: [rule], unmapped: [], strength: 'NORMAL'})}
                onApply={apply}
                goalNurses={nurses}
            />,
        );
        await submit('데이 근무를 줄여줘', false);
        const card = screen.getByRole('region', {name: 'aiAdjust.understood'});
        fireEvent.click(within(card).getByText('aiAdjust.review.details'));
        expect(within(card).getByText('김서현, 박지현')).toBeVisible();
        expect(within(card).getByText('aiAdjust.review.consecutiveDays')).toBeVisible();
        expect(within(card).getByText(/PATIENT_COUNT · 20/)).toBeVisible();
        expect(textbox()).toBeEnabled();
        expect(apply).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.savedRequests.lifetime.TEAM'}));
        fireEvent.click(screen.getByRole('button', {name: 'page.makeShift.aiRefill.adjust.severity.HARD'}));
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        await waitFor(() =>
            expect(apply).toHaveBeenCalledWith(
                [{item: rule, lifetime: 'TEAM', severity: 'HARD'}],
                '데이 근무를 줄여줘',
                'NORMAL',
                undefined,
                expect.any(String),
            ),
        );
    });

    it('defaults to MONTH, shows all confirmation metadata, and only applies after explicit acceptance', async () => {
        const apply = vi.fn();

        render(
            <AiAdjustTextInput
                disabled={false}
                interpret={vi.fn().mockResolvedValue({
                    ...interpreted,
                    items: [
                        {
                            ...interpreted.items[0],
                            requiresConfirmation: true,
                            confirmationReasons: ['RECURRING_SCOPE', 'ASSUMED_VALUE'],
                            assumedSlots: ['value'],
                            applyMonths: [{year: 2026, month: 10}],
                        },
                    ],
                })}
                onApply={apply}
                goalNurses={nurses}
            />,
        );
        await submit('오프를 공평하게');
        expect(apply).not.toHaveBeenCalled();
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.getByText('2026.10')).toBeVisible();
        expect(screen.getByText('aiAdjust.RECURRING_SCOPE')).toBeVisible();
        expect(screen.getByText('aiAdjust.assumed · aiAdjust.review.value: 1')).toBeVisible();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.changeAnswer'}));
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.savedRequests.lifetime.TEAM'}));
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        expect(apply).toHaveBeenCalledWith(
            [expect.objectContaining({lifetime: 'TEAM'})],
            '오프를 공평하게',
            'LIGHT',
            undefined,
            expect.any(String),
        );
    });
    it('reinterprets the complete revised intent and never submits superseded items', async () => {
        const apply = vi.fn();
        const interpret = vi
            .fn()
            .mockResolvedValueOnce(interpreted)
            .mockResolvedValueOnce({
                items: [{kind: 'KNOB', knob: 'CLUSTERING', value: -1, displayLabel: '연속 근무 줄이기'}],
                unmapped: [],
                strength: 'NORMAL',
            });

        render(<AiAdjustTextInput disabled={false} interpret={interpret} onApply={apply} goalNurses={nurses} />);
        await submit('오프를 공평하게');
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.reviseReply'}));
        expect(textbox()).toHaveValue('오프를 공평하게');
        expect(apply).not.toHaveBeenCalled();
        await submit('오프 배분은 바꾸지 말고 연속 근무만 줄여줘');
        expect(interpret).toHaveBeenLastCalledWith('오프 배분은 바꾸지 말고 연속 근무만 줄여줘');
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        expect(apply).toHaveBeenCalledTimes(1);
        expect(apply.mock.calls[0]![0]).toEqual([expect.objectContaining({item: expect.objectContaining({knob: 'CLUSTERING'})})]);
    });
    it('asks for a complete request for ambiguous correction fragments', async () => {
        const interpret = vi.fn().mockResolvedValue(interpreted);

        render(<AiAdjustTextInput disabled={false} interpret={interpret} onApply={vi.fn()} goalNurses={nurses} />);
        await submit('D 근무는 최대 4일 연속으로 해줘');
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.reviseReply'}));
        fireEvent.change(textbox(), {target: {value: '3일로'}});
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
        expect(screen.getAllByText('aiAdjust.chat.clarify').length).toBeGreaterThan(0);
        expect(screen.getByText('3일로')).toBeVisible();
        expect(interpret).toHaveBeenCalledTimes(1);
    });
    it('shows both unmapped text and hint, disabling an entirely unmapped result', async () => {
        render(
            <AiAdjustTextInput
                disabled={false}
                interpret={vi.fn().mockResolvedValue({items: [], unmapped: [{text: '알 수 없는 요구', hint: '대상을 알려 주세요'}]})}
                onApply={vi.fn()}
                goalNurses={nurses}
            />,
        );
        await submit('요구');
        expect(screen.getByText('알 수 없는 요구')).toBeVisible();
        expect(screen.getByText('대상을 알려 주세요')).toBeVisible();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.applyReply'})).not.toBeInTheDocument();
    });
    it('allows a residual prompt with no structured items and warns about partial interpretation', async () => {
        const apply = vi.fn();

        render(
            <AiAdjustTextInput
                disabled={false}
                interpret={vi
                    .fn()
                    .mockResolvedValue({items: [], llmPrompt: '잔여 요청', unmapped: [{text: '미해석 요청'}], strength: 'STRONG'})}
                onApply={apply}
                goalNurses={nurses}
            />,
        );
        await submit('요청');
        expect(screen.getByText('aiAdjust.partial')).toBeVisible();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        expect(apply).toHaveBeenCalledWith([], '요청', 'STRONG', '잔여 요청', expect.any(String));
    });
    it('shows existing ACTIVE requests before acceptance and blocks on lookup failure', async () => {
        const requests = [
            {id: 1, status: 'ACTIVE', lifetime: 'MONTH', displayLabel: '기존 연속근무 제한'},
            {id: 2, status: 'DISABLED', displayLabel: '해제된 요청'},
        ] as TScheduleMonthRequestRes[];
        const props = {disabled: false, interpret: vi.fn().mockResolvedValue(interpreted), onApply: vi.fn(), goalNurses: nurses, requests};
        const {rerender} = render(<AiAdjustTextInput {...props} requestsError />);

        await submit('오프 균형');
        expect(screen.getByText(/기존 연속근무 제한/)).toBeVisible();
        expect(screen.queryByText('해제된 요청')).toBeNull();
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'})).toBeDisabled();
        rerender(<AiAdjustTextInput {...props} />);
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'})).toBeEnabled();
    });
    it('retains the card and reuses its action key after a network failure', async () => {
        const apply = vi.fn().mockRejectedValueOnce(new Error('서버 연결 실패')).mockResolvedValueOnce(undefined);

        render(
            <AiAdjustTextInput disabled={false} interpret={vi.fn().mockResolvedValue(interpreted)} onApply={apply} goalNurses={nurses} />,
        );
        await submit('오프 균형');
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('서버 연결 실패');
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        await waitFor(() => expect(apply).toHaveBeenCalledTimes(2));
        expect(apply.mock.calls[1]![4]).toBe(apply.mock.calls[0]![4]);
    });
    it('requires reinterpretation after a draft conflict instead of reapplying a stale card', async () => {
        const apply = vi.fn().mockRejectedValue(Object.assign(new Error('최신 표 확인 필요'), {requiresReinterpret: true}));

        render(
            <AiAdjustTextInput disabled={false} interpret={vi.fn().mockResolvedValue(interpreted)} onApply={apply} goalNurses={nurses} />,
        );
        await submit('오프 균형');
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        await screen.findByRole('alert');
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.applyReply'})).toBeNull();
        expect(textbox()).toHaveValue('오프 균형');
    });
    it('ignores an interpretation that arrives after the schedule scope unmounts', async () => {
        let resolve!: (result: TScheduleAdjustInterpretRes) => void;

        const interpret = vi.fn(
            () =>
                new Promise<TScheduleAdjustInterpretRes>((done) => {
                    resolve = done;
                }),
        );
        const {rerender} = render(
            <AiAdjustTextInput key="oct" disabled={false} interpret={interpret} onApply={vi.fn()} goalNurses={nurses} />,
        );

        fireEvent.change(textbox(), {target: {value: '10월 요청'}});
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
        rerender(<AiAdjustTextInput key="nov" disabled={false} interpret={interpret} onApply={vi.fn()} goalNurses={nurses} />);
        await act(async () => resolve(interpreted));
        expect(screen.queryByRole('region', {name: 'aiAdjust.understood'})).toBeNull();
        expect(textbox()).toHaveValue('');
    });
    it('displays validation and undo, then clears conversation results when starting over', async () => {
        const response = {
            operationType: 'ADJUST',
            approvable: false,
            changedCells: [],
            draftRevision: 1,
            resultType: 'PATCH',
            sameAsPrevious: false,
            validation: {
                draftRevision: 1,
                rulesHash: 'r',
                summary: {valid: false, hardCount: 1, softCount: 0, totalCount: 1},
                violations: [],
            },
            blockingViolations: [{violationId: 'v1', message: '필수 조건 위반'}],
            unmetInstructions: ['주말 요구 미달성'],
            requestRuleResults: [{requestId: 1, displayLabel: 'D 최대 4일', violationCount: 2}],
            adjustmentNotices: [{message: '월 요청 우선 적용'}],
        };
        const apply = vi.fn().mockResolvedValue({
            applied: true,
            response,
            changes: [{name: '김서현', date: '2026-10-12', before: 'D', after: 'O'}],
            undoRevision: 2,
        });

        render(
            <AiAdjustTextInput
                disabled={false}
                interpret={vi.fn().mockResolvedValue(interpreted)}
                onApply={apply}
                goalNurses={nurses}
                currentRevision={2}
                onUndo={() => true}
            />,
        );
        await submit('김서현 쉬게 해줘');
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        await screen.findByText('aiAdjust.result');
        expect(screen.getByText(/D → O/)).toBeVisible();
        expect(screen.getByText('필수 조건 위반')).toBeVisible();
        expect(screen.getByText('주말 요구 미달성')).toBeVisible();
        expect(screen.getByText('월 요청 우선 적용')).toBeVisible();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.undo'}));
        expect(await screen.findByText('aiAdjust.undone')).toBeVisible();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));
        expect(screen.queryByRole('log')).not.toBeInTheDocument();
        expect(screen.queryByText(/D → O/)).not.toBeInTheDocument();
        expect(screen.getByText('aiAdjust.welcome')).toBeVisible();
        expect(screen.getByText('aiAdjust.examples')).toBeVisible();
        expect(textbox()).toBeEnabled();
        expect(textbox()).toHaveValue('');
    });
    it('does not send Enter while composing Korean input or leak editing keys', async () => {
        const user = userEvent.setup();
        const interpret = vi.fn();
        const keydown = vi.fn();

        render(
            <div onKeyDown={keydown}>
                <AiAdjustTextInput disabled={false} interpret={interpret} onApply={vi.fn()} goalNurses={nurses} />
            </div>,
        );
        await user.type(textbox(), '요청');
        fireEvent.keyDown(textbox(), {key: 'Enter', isComposing: true});
        expect(interpret).not.toHaveBeenCalled();
        expect(keydown).not.toHaveBeenCalled();
    });
});
