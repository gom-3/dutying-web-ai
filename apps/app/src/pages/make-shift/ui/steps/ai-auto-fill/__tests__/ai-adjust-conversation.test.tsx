import type {TScheduleAdjustInterpretRes, TScheduleMonthRequestRes} from '@dutying/api/ward';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import type {TAdjustApplyResult} from '../../../../model/ai-adjust-conversation';
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
            screen.queryByRole('button', {name: 'aiAdjust.chat.confirmProposal'}) ??
            screen.queryByRole('button', {name: 'aiAdjust.savedRequests.lifetime.MONTH'}) ??
            screen.queryByRole('button', {name: 'aiAdjust.chat.preferred'});
        if (!button) break;
        fireEvent.click(button);
    }
}
async function submit(text: string, answer = true) {
    fireEvent.change(textbox(), {target: {value: text}});
    fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
    await waitFor(() => expect(screen.queryByRole('status', {name: 'aiAdjust.reviewing'})).not.toBeInTheDocument());
    if (answer) answerDefaultQuestions();
}

describe('AI adjustment conversation', () => {
    it('ignores an old interpretation after restarting while a new request is pending', async () => {
        let resolveOld!: (value: TScheduleAdjustInterpretRes) => void;
        let resolveNew!: (value: TScheduleAdjustInterpretRes) => void;
        const interpret = vi.fn()
            .mockImplementationOnce(() => new Promise<TScheduleAdjustInterpretRes>((resolve) => { resolveOld = resolve; }))
            .mockImplementationOnce(() => new Promise<TScheduleAdjustInterpretRes>((resolve) => { resolveNew = resolve; }));
        const apply = vi.fn();
        render(<AiAdjustTextInput disabled={false} interpret={interpret} onApply={apply} goalNurses={nurses} />);

        fireEvent.change(textbox(), {target: {value: '이전 요청'}});
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));
        fireEvent.change(textbox(), {target: {value: '새 요청'}});
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
        await act(async () => resolveOld(interpreted));

        expect(screen.queryByText('이전 요청')).not.toBeInTheDocument();
        expect(screen.getByRole('status', {name: 'aiAdjust.reviewing'})).toBeVisible();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.confirmProposal'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'aiAdjust.send'})).toBeDisabled();

        await act(async () => resolveNew(interpreted));
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.confirmProposal'})).toBeVisible();
        expect(interpret).toHaveBeenCalledTimes(2);
        expect(apply).not.toHaveBeenCalled();
    });

    it('does not restore a canceled apply error or unlock a newer request after restarting', async () => {
        let rejectApply!: (reason: Error) => void;
        const apply = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectApply = reject; }));
        const interpret = vi.fn().mockResolvedValueOnce(interpreted).mockImplementationOnce(() => new Promise(() => {}));
        render(<AiAdjustTextInput disabled={false} interpret={interpret} onApply={apply} goalNurses={nurses} />);
        await submit('오프를 공평하게');
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        expect(apply).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));
        fireEvent.change(textbox(), {target: {value: '새 요청'}});
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
        await act(async () => rejectApply(Object.assign(new Error('old preparation'), {requiresReinterpret: true})));

        expect(textbox()).toHaveValue('');
        expect(screen.queryByText('old preparation')).not.toBeInTheDocument();
        expect(screen.getByRole('status', {name: 'aiAdjust.reviewing'})).toBeVisible();
        fireEvent.change(textbox(), {target: {value: '중복 요청'}});
        fireEvent.keyDown(textbox(), {key: 'Enter'});
        expect(interpret).toHaveBeenCalledTimes(2);
    });

    it('accepts a typed period answer without another interpretation and waits for an explicit apply reply', async () => {
        const interpret = vi.fn().mockResolvedValue(interpreted);
        const apply = vi.fn();
        render(<AiAdjustTextInput disabled={false} interpret={interpret} onApply={apply} goalNurses={nurses} />);
        await submit('오프를 공평하게', false);
        expect(textbox()).toBeEnabled();
        expect(screen.queryByRole('group', {name: 'aiAdjust.chat.question.lifetime'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.confirmProposal'})).toBeVisible();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.applyReply'})).not.toBeInTheDocument();
        fireEvent.change(textbox(), {target: {value: '네'}});
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
        expect(apply).not.toHaveBeenCalled();
        expect(interpret).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('group', {name: 'aiAdjust.chat.question.lifetime'})).toBeVisible();

        const month = screen.getByRole('button', {name: 'aiAdjust.savedRequests.lifetime.MONTH'});
        const team = screen.getByRole('button', {name: 'aiAdjust.savedRequests.lifetime.TEAM'});

        expect(month.parentElement).toBe(team.parentElement);
        expect(month.parentElement).toHaveClass('flex-col', 'items-end');
        expect(month.parentElement).not.toHaveClass('bg-main-light');
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

    it.each(['button', 'typed'])('keeps a declined proposal in history and reviews the revised request again (%s)', async (method) => {
        const interpret = vi.fn().mockResolvedValue(interpreted);
        const apply = vi.fn();

        render(<AiAdjustTextInput disabled={false} interpret={interpret} onApply={apply} goalNurses={nurses} />);
        await submit('오프를 공평하게', false);

        if (method === 'button') fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.reviseProposal'}));
        else await submit('아니요', false);

        expect(interpret).toHaveBeenCalledTimes(1);
        expect(apply).not.toHaveBeenCalled();
        expect(textbox()).toHaveValue('');
        expect(screen.getByText('aiAdjust.chat.reviseProposal')).toBeVisible();
        expect(screen.queryByRole('group', {name: 'aiAdjust.chat.question.lifetime'})).not.toBeInTheDocument();
        await submit('오프보다 연속 근무를 줄여줘', false);
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.confirmProposal'})).toBeVisible();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.applyReply'})).not.toBeInTheDocument();
        expect(screen.queryByRole('group', {name: 'aiAdjust.chat.question.lifetime'})).not.toBeInTheDocument();
        expect(interpret).toHaveBeenCalledTimes(2);
        expect(apply).not.toHaveBeenCalled();
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
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.confirmProposal'}));
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.savedRequests.lifetime.MONTH'}));
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.required'}));
        fireEvent.click(screen.getAllByRole('button', {name: 'aiAdjust.chat.changeAnswer'})[1]!);
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.applyReply'})).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.savedRequests.lifetime.TEAM'}));
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.preferred'}));
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
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.confirmProposal'}));
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
        expect(screen.getByText('aiAdjust.chat.askChanges')).toBeVisible();
        expect(screen.getByText('aiAdjust.examples')).toBeVisible();
        expect(apply).not.toHaveBeenCalled();
        expect(textbox()).toHaveValue('');
    });

    it('shows generation guidance once and starts new chats without repeating it', async () => {
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

        expect(screen.queryByText('aiAdjust.generationCompleted')).not.toBeInTheDocument();
        expect(interpret).toHaveBeenCalledExactlyOnceWith('오프를 공평하게');
        expect(screen.getByText('aiAdjust.examples')).toBeVisible();
        expect(screen.queryByRole('log')).not.toBeInTheDocument();
        expect(apply.mock.calls[0]![1]).toBe('오프를 공평하게');
    });

    it('preserves the modification conversation when another full-generation attempt starts', async () => {
        const props = {
            disabled: false,
            interpret: vi.fn().mockResolvedValue(interpreted),
            onApply: vi.fn(),
            goalNurses: nurses,
            onRegenerate: vi.fn(),
        };
        const firstFlow = {id: 1, status: 'running' as const, messages: [{role: 'user' as const, text: '첫 자동채우기 선택'}]};
        const view = render(<AiAdjustTextInput {...props} autofillFlow={firstFlow} generationCompleted />);

        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.modify'}));
        await submit('오프를 공평하게');
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'})).toBeVisible();

        const nextFlow = {id: 2, status: 'preparing' as const, messages: [{role: 'assistant' as const, text: '다음 고정 확인'}]};

        view.rerender(<AiAdjustTextInput {...props} autofillFlow={nextFlow} preparation={<p>준비 선택지</p>} />);

        expect(screen.getByText('첫 자동채우기 선택')).toBeVisible();
        expect(screen.getByText('aiAdjust.chat.modify')).toBeVisible();
        expect(screen.getByText('오프를 공평하게')).toBeVisible();
        expect(screen.getByText('다음 고정 확인')).toBeVisible();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.applyReply'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.changeAnswer'})).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByRole('log').textContent).toMatch(
            /첫 자동채우기 선택[\s\S]*aiAdjust.generationCompleted[\s\S]*aiAdjust.chat.modify[\s\S]*오프를 공평하게[\s\S]*다음 고정 확인/,
        );
        view.rerender(<AiAdjustTextInput {...props} autofillFlow={{...nextFlow, status: 'running'}} generationCompleted />);
        expect(screen.getAllByText('aiAdjust.generationCompleted')).toHaveLength(2);
        expect(screen.getByText('오프를 공평하게')).toBeVisible();
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.regenerate'})).toBeVisible();
        expect(props.interpret).toHaveBeenCalledOnce();
        expect(props.onApply).not.toHaveBeenCalled();
    });

    it('scrolls after preparation messages are added to the same turn and when the sheet reopens', async () => {
        const props = {disabled: false, interpret: vi.fn(), onApply: vi.fn(), goalNurses: nurses};
        const flow = {id: 1, status: 'preparing' as const, messages: [{role: 'assistant' as const, text: '전달 근무 확인'}]};
        const view = render(<AiAdjustTextInput {...props} autofillFlow={flow} preparation={<p>준비 선택지</p>} />);
        const viewport = document.querySelector<HTMLDivElement>('.ai-adjust-chat-scroll')!;
        const scrollTo = vi.fn(({top}: ScrollToOptions) => {
            viewport.scrollTop = top ?? 0;
        });

        Object.defineProperties(viewport, {
            scrollTo: {value: scrollTo},
            scrollHeight: {get: () => (viewport.textContent?.includes('고정할 근무 확인') ? 900 : 500)},
        });
        await waitFor(() => expect(viewport.scrollTop).toBe(500));
        viewport.scrollTop = 0;

        const nextFlow = {...flow, messages: [...flow.messages, {role: 'assistant' as const, text: '고정할 근무 확인'}]};

        view.rerender(<AiAdjustTextInput {...props} autofillFlow={nextFlow} preparation={<p>준비 선택지</p>} />);
        await waitFor(() => expect(viewport.scrollTop).toBe(900));
        expect(screen.getByText('전달 근무 확인')).toBeInTheDocument();

        view.rerender(<AiAdjustTextInput {...props} open={false} autofillFlow={nextFlow} preparation={<p>준비 선택지</p>} />);
        viewport.scrollTop = 0;
        view.rerender(<AiAdjustTextInput {...props} open autofillFlow={nextFlow} preparation={<p>준비 선택지</p>} />);
        await waitFor(() => expect(viewport.scrollTop).toBe(900));
    });

    it('summarizes fixed dates once in one assistant bubble and preserves the confirmed payload', async () => {
        const item = {
            kind: 'CELL_SET' as const,
            nurseIds: [1],
            dates: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
            shiftCode: 'D',
            displayLabel: '김서현 10월 1일, 2일, 3일, 4일 D 고정',
        };

        let finish!: () => void;

        const apply = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));

        render(
            <AiAdjustTextInput
                disabled={false}
                interpret={vi.fn().mockResolvedValue({items: [item], unmapped: [], strength: 'NORMAL'})}
                onApply={apply}
                goalNurses={nurses}
            />,
        );
        await submit('김서현 1일부터 4일까지 데이로');
        expect(screen.getByText('김서현')).toBeVisible();
        expect(screen.queryByText(item.displayLabel)).not.toBeInTheDocument();
        expect(screen.queryByText('aiAdjust.review.details')).not.toBeInTheDocument();
        expect(screen.getAllByText('aiAdjust.assistant')).toHaveLength(1);
        expect(screen.queryByText('aiAdjust.regenerateDescription')).not.toBeInTheDocument();
        expect(apply).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));

        const pending = screen.getByRole('status', {name: 'aiAdjust.applying'});

        expect(pending.textContent).toBe('');
        expect(pending.querySelectorAll('.ai-adjust-review-dot')).toHaveLength(3);
        expect(screen.queryByText('aiAdjust.applying')).not.toBeInTheDocument();
        await waitFor(() =>
            expect(apply).toHaveBeenCalledWith(
                [expect.objectContaining({item})],
                '김서현 1일부터 4일까지 데이로',
                'NORMAL',
                undefined,
                expect.any(String),
            ),
        );
        await act(async () => finish());
    });

    it('fills examples without interpreting or applying and uses real nurse names', () => {
        const interpret = vi.fn();
        const apply = vi.fn();

        render(
            <AiAdjustTextInput disabled={false} interpret={interpret} onApply={apply} goalNurses={nurses} shiftCodes={['D', 'N', 'O']} />,
        );
        expect(screen.queryByText('aiAdjust.intro')).not.toBeInTheDocument();
        expect(screen.queryByText('aiAdjust.introDetail')).not.toBeInTheDocument();
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
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.confirmProposal'}));
        const card = screen.getByRole('region', {name: 'aiAdjust.understood'});
        fireEvent.click(within(card).getByText('aiAdjust.review.details'));
        expect(within(card).getByText('김서현, 박지현')).toBeVisible();
        expect(within(card).getByText('aiAdjust.review.consecutiveDays')).toBeVisible();
        expect(within(card).getByText(/aiAdjust.review.patientCount · 20/)).toBeVisible();
        expect(textbox()).toBeEnabled();
        expect(apply).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.savedRequests.lifetime.TEAM'}));
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.required'}));
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
        expect(screen.getByText('aiAdjust.review.suggestion {"field":"aiAdjust.review.value","value":"1"}')).toBeVisible();
        fireEvent.click(screen.getAllByRole('button', {name: 'aiAdjust.chat.changeAnswer'})[1]!);
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
        expect(textbox()).toHaveValue('');
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
    it('shows only the actionable hint for an entirely unmapped result', async () => {
        render(
            <AiAdjustTextInput
                disabled={false}
                interpret={vi.fn().mockResolvedValue({items: [], unmapped: [{text: '알 수 없는 요구', hint: '대상을 알려 주세요'}]})}
                onApply={vi.fn()}
                goalNurses={nurses}
            />,
        );
        await submit('요구');
        expect(screen.queryByText('알 수 없는 요구')).not.toBeInTheDocument();
        expect(screen.queryByRole('heading')).not.toBeInTheDocument();
        expect(screen.queryByText('aiAdjust.chat.clarify')).not.toBeInTheDocument();
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
        expect(screen.getByText('aiAdjust.issue.excluded')).toBeVisible();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.issue.partialApply'}));
        expect(apply).toHaveBeenCalledWith([], '요청', 'STRONG', '잔여 요청', expect.any(String));
    });
    it('retries the exact request without applying it and keeps the previous chat', async () => {
        const interpret = vi
            .fn()
            .mockResolvedValueOnce({items: [], unmapped: [{text: '요청', reasonCode: 'INTERPRETATION_FAILED'}]})
            .mockResolvedValueOnce(interpreted);
        const apply = vi.fn();

        render(<AiAdjustTextInput disabled={false} interpret={interpret} onApply={apply} goalNurses={nurses} />);
        await submit('김서현의 나이트를 줄여줘');
        expect(screen.getByText('aiAdjust.issue.retry')).toBeVisible();
        expect(screen.queryByText('aiAdjust.understood')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.failure.retry'}));
        await waitFor(() => expect(interpret).toHaveBeenCalledTimes(2));
        expect(interpret).toHaveBeenLastCalledWith('김서현의 나이트를 줄여줘');
        expect(screen.getByText('김서현의 나이트를 줄여줘')).toBeVisible();
        expect(screen.getByText('aiAdjust.issue.retry')).toBeVisible();
        expect(apply).not.toHaveBeenCalled();
    });

    it('opens an empty composer for editing and keeps the original request in chat', async () => {
        const interpret = vi.fn().mockResolvedValue({items: [], unmapped: [{text: '요청', reasonCode: 'UNSUPPORTED_REQUEST'}]});

        render(<AiAdjustTextInput disabled={false} interpret={interpret} onApply={vi.fn()} goalNurses={nurses} />);
        await submit('나이트를 좀 조정해줘');
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.issue.edit'}));
        expect(textbox()).toHaveValue('');
        expect(screen.getByText('나이트를 좀 조정해줘')).toBeVisible();
        expect(textbox()).toHaveFocus();
        expect(screen.getByText('aiAdjust.issue.editHint')).toBeVisible();
        expect(screen.queryByText('aiAdjust.chat.clarify')).not.toBeInTheDocument();
    });

    it('preserves the original request when a nurse name answers the clarification', async () => {
        const interpret = vi
            .fn()
            .mockResolvedValueOnce({items: [], unmapped: [{text: '요청', reasonCode: 'NURSE_NOT_RESOLVED'}]})
            .mockResolvedValueOnce(interpreted);

        render(<AiAdjustTextInput disabled={false} interpret={interpret} onApply={vi.fn()} goalNurses={nurses} />);
        await submit('나이트를 줄여줘');
        await submit('김서현');
        expect(interpret).toHaveBeenLastCalledWith('나이트를 줄여줘\n추가 설명: 김서현');
        expect(screen.getByText('김서현')).toBeVisible();
    });

    it('does not render an empty proposal or offer execution for an empty response', async () => {
        render(
            <AiAdjustTextInput
                disabled={false}
                interpret={vi.fn().mockResolvedValue({items: [], unmapped: []})}
                onApply={vi.fn()}
                goalNurses={nurses}
            />,
        );
        await submit('근무 조정');
        expect(screen.getByText('aiAdjust.issue.clarify')).toBeVisible();
        expect(screen.queryByRole('heading')).not.toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.applyReply'})).not.toBeInTheDocument();
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
    it('keeps reviewed conditions when allowance is exhausted during adjustment', async () => {
        const failure = {message: 'AI 사용 횟수를 모두 썼어요.\n요금제와 남은 횟수를 확인해 주세요.', blocked: true};
        const apply = vi.fn().mockRejectedValue(Object.assign(new Error('quota'), {failure}));

        render(
            <AiAdjustTextInput disabled={false} interpret={vi.fn().mockResolvedValue(interpreted)} onApply={apply} goalNurses={nurses} />,
        );
        await submit('오프 균형');
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('AI 사용 횟수를 모두 썼어요.');
        expect(screen.queryByRole('button', {name: 'aiAdjust.failure.retry'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.applyReply'})).not.toBeInTheDocument();
        expect(screen.getByText('aiAdjust.chat.applyReply')).toBeVisible();
        expect(apply).toHaveBeenCalledOnce();
    });

    it('keeps the original message when permission blocks interpretation', async () => {
        const interpret = vi.fn().mockRejectedValue(Object.assign(new Error('forbidden'), {code: 403}));

        render(<AiAdjustTextInput disabled={false} interpret={interpret} onApply={vi.fn()} goalNurses={nurses} />);
        fireEvent.change(textbox(), {target: {value: '오프 균형'}});
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
        expect(await screen.findByRole('alert')).toHaveTextContent(/권한|access/);
        expect(textbox()).toHaveValue('오프 균형');
        expect(interpret).toHaveBeenCalledOnce();
    });

    it('retains the card and reuses its action key after a network failure', async () => {
        const apply = vi.fn().mockRejectedValueOnce(new Error('서버 연결 실패')).mockResolvedValueOnce(undefined);

        render(
            <AiAdjustTextInput disabled={false} interpret={vi.fn().mockResolvedValue(interpreted)} onApply={apply} goalNurses={nurses} />,
        );
        await submit('오프 균형');
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('aiAdjust.failed');
        expect(screen.getByRole('alert')).not.toHaveTextContent('서버 연결 실패');
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.failure.retry'}));
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
        await screen.findByText('aiAdjust.completed {"count":1}');
        expect(screen.getByText(/D → O/)).not.toBeVisible();
        fireEvent.click(screen.getByText('aiAdjust.changeDetails'));
        expect(screen.getByText(/D → O/)).toBeVisible();
        expect(screen.queryByRole('button', {name: 'aiAdjust.confirmSchedule'})).not.toBeInTheDocument();
        expect(screen.getByText('필수 조건 위반')).not.toBeVisible();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.checkProblems'}));
        expect(screen.getByText('필수 조건 위반')).toBeVisible();
        expect(screen.getByText('주말 요구 미달성')).toBeVisible();
        expect(screen.getByText('월 요청 우선 적용')).toBeVisible();

        const undo = screen.getByRole('button', {name: 'aiAdjust.undo'});

        expect(undo.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
        expect(undo).toHaveClass('bg-transparent');
        fireEvent.click(undo);
        expect(await screen.findByText('aiAdjust.undone')).toBeVisible();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));
        expect(screen.queryByRole('log')).not.toBeInTheDocument();
        expect(screen.queryByText(/D → O/)).not.toBeInTheDocument();
        expect(screen.getByText('aiAdjust.chat.askChanges')).toBeVisible();
        expect(screen.getByText('aiAdjust.examples')).toBeVisible();
        expect(textbox()).toBeEnabled();
        expect(textbox()).toHaveValue('');
    });
    it('offers next actions for a clean result and continues editing without losing history or executing again', async () => {
        const result: TAdjustApplyResult = {
            applied: true,
            response: {
                operationType: 'ADJUST',
                approvable: true,
                draftRevision: 2,
                resultType: 'PATCH',
                changedCells: [],
                sameAsPrevious: false,
                unmetInstructions: [],
                validation: {
                    draftRevision: 2,
                    rulesHash: 'r',
                    summary: {valid: true, hardCount: 0, softCount: 0, totalCount: 0},
                    violations: [],
                },
            },
            changes: [{name: '김서현', date: '2026-10-12', before: 'D', after: 'O'}],
            undoRevision: 2,
        };
        const interpret = vi.fn().mockResolvedValue(interpreted);
        const apply = vi.fn().mockResolvedValue(result);
        const confirm = vi.fn();
        const props = {disabled: false, interpret, onApply: apply, goalNurses: nurses, currentRevision: 2, onUndo: () => true};
        const {rerender} = render(<AiAdjustTextInput {...props} resultActions={{canConfirm: false, onConfirm: confirm}} />);

        await submit('오프를 고르게 해줘');
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        expect(await screen.findByRole('button', {name: 'aiAdjust.confirmSchedule'})).toBeDisabled();
        expect(screen.queryByText('aiAdjust.validation')).not.toBeInTheDocument();
        expect(screen.queryByText('aiAdjust.approvable')).not.toBeInTheDocument();
        expect(screen.queryByText('aiAdjust.resultDetails')).not.toBeInTheDocument();
        expect(screen.getByText(/D → O/)).not.toBeVisible();
        expect(confirm).not.toHaveBeenCalled();
        rerender(<AiAdjustTextInput {...props} resultActions={{canConfirm: true, onConfirm: confirm}} />);
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.confirmSchedule'}));
        expect(confirm).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.modifyMore'}));
        expect(textbox()).toHaveFocus();
        expect(textbox()).toHaveValue('');
        expect(screen.getByText('aiAdjust.chat.askChanges')).toBeVisible();
        expect(screen.getByText('aiAdjust.modifyMore')).toBeVisible();
        expect(screen.getByText('aiAdjust.completed {"count":1}')).toBeVisible();
        expect(screen.queryByRole('button', {name: 'aiAdjust.modifyMore'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'aiAdjust.confirmSchedule'})).not.toBeInTheDocument();
        expect(interpret).toHaveBeenCalledTimes(1);
        expect(apply).toHaveBeenCalledTimes(1);
        await submit('데이 연속 근무를 줄여줘', false);
        expect(interpret).toHaveBeenCalledTimes(2);
        expect(apply).toHaveBeenCalledTimes(1);
        expect(screen.getByText('aiAdjust.completed {"count":1}')).toBeVisible();
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
