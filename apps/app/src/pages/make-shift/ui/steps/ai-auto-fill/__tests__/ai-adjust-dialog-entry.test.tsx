import type {TScheduleAdjustInterpretRes} from '@dutying/api/ward';
import {createRef, useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import type {TAiConversationFailure} from '../../../../model/ai-conversation-failure';
import AiAdjustDialog from '../ai-adjust-dialog';
import {ConstraintConflictReview} from '../ai-constraint-conflict-review';

vi.mock('@/shared/hook/use-typed-translation', () => ({useTypedTranslation: () => ({t: (key: string) => key})}));

describe('unified AI sidebar entry', () => {
    it.each([false, true])('keeps generation explicit, generated=%s', async (hasGeneratedSchedule) => {
        const user = userEvent.setup();
        const onGenerate = vi.fn();
        const onRegenerate = vi.fn();
        const interpret = vi.fn(() => new Promise<TScheduleAdjustInterpretRes>(() => {}));

        render(
            <AiAdjustDialog
                open
                onClose={vi.fn()}
                onGenerate={onGenerate}
                onRegenerate={onRegenerate}
                hasGeneratedSchedule={hasGeneratedSchedule}
                disabled={false}
                textInputRef={createRef()}
                onPickExample={vi.fn()}
                interpret={interpret}
                onApply={vi.fn()}
                goalNurses={[]}
                requests={[]}
                disablingRequestId={null}
                onDisableRequest={vi.fn()}
            />,
        );

        const restart = screen.getByRole('button', {name: 'aiAdjust.chat.restart'});

        expect(restart.closest('header')).not.toBeNull();
        expect(restart.nextElementSibling).toBe(screen.getByRole('button', {name: 'aiAdjust.close'}));
        expect(onGenerate).not.toHaveBeenCalled();
        expect(onRegenerate).not.toHaveBeenCalled();

        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(document.querySelector('.ai-adjust-chat-scroll')).toHaveAttribute('data-composer-hidden', 'true');

        const generate = screen.getByRole('button', {name: 'aiAdjust.chat.regenerate'});

        await user.click(generate);
        expect(hasGeneratedSchedule ? onRegenerate : onGenerate).toHaveBeenCalledOnce();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.modify'})).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.chat.modify'}));
        expect(screen.getByRole('textbox')).toHaveFocus();
        expect(document.querySelector('.ai-adjust-chat-scroll')).toHaveAttribute('data-composer-hidden', 'false');
        expect(screen.getByText('aiAdjust.chat.askChanges')).toBeInTheDocument();
        await user.type(screen.getByRole('textbox'), '오프 수를 11로 맞춰줘');
        await user.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
        expect(interpret).toHaveBeenCalledOnce();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.regenerate'})).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('aiAdjust.reviewing');
        expect(screen.getByRole('status').querySelectorAll('.ai-adjust-review-dot')).toHaveLength(3);
        expect(screen.getByText('aiAdjust.reviewing')).toBeVisible();
        expect(screen.queryByText(/aiAdjust.elapsed/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.restart'})).toBeEnabled();
        expect(screen.getAllByRole('button', {name: 'aiAdjust.chat.restart'})).toHaveLength(1);
        await user.click(restart);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.modify'})).toBeEnabled();
    });
});

it('keeps legacy conflict evidence and opens request editing without offering confirmation', async () => {
    const generate = vi.fn();
    const apply = vi.fn();
    const confirm = vi.fn();

    function Recovery() {
        const [failure, setFailure] = useState<TAiConversationFailure | null>({
            message: '조건 충돌',
            blocked: false,
            recovery: 'review',
            confirmationRequired: true,
            conflictDetails: {
                explanation: '야간 조건과 필요 인원이 맞지 않아요.',
                violations: [
                    {
                        violationId: 'v1',
                        ruleId: 9,
                        templateCode: 'SHIFT_COUNT_PER_PERIOD',
                        severity: 'HARD',
                        message: '합성 간호사 야간 횟수',
                        messageArgs: {operator: 'MAX', expected: 2, actual: 4},
                        affectedCells: [],
                        fixable: true,
                    },
                ],
            },
        });

        return (
            <AiAdjustDialog
                open
                onClose={vi.fn()}
                onGenerate={generate}
                onRegenerate={generate}
                onDismissFailure={() => setFailure(null)}
                generationFailure={failure}
                renderConflictReview={
                    failure
                        ? (onRevise, onEditSettings) => (
                              <ConstraintConflictReview
                                  review={{...failure.conflictDetails!, token: 'synthetic-token', expiresAt: '2099-01-01T00:00:00Z'}}
                                  current
                                  disabled={false}
                                  onProceed={apply}
                                  onRevise={onRevise}
                                  onEditSettings={onEditSettings}
                                  copy={(ko) => ko}
                              />
                          )
                        : undefined
                }
                disabled={false}
                textInputRef={createRef()}
                onPickExample={vi.fn()}
                interpret={vi.fn()}
                onApply={apply}
                goalNurses={[]}
                requests={[]}
                disablingRequestId={null}
                onDisableRequest={vi.fn()}
                resultActions={{canConfirm: true, onConfirm: confirm}}
            />
        );
    }

    render(<Recovery />);
    expect(screen.getByText('야간 조건과 필요 인원이 맞지 않아요.')).toBeVisible();
    expect(screen.queryByRole('button', {name: 'aiAdjust.chat.confirmSchedule'})).not.toBeInTheDocument();
    expect(generate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', {name: 'aiAutofillUi.conflictReview.revise'}));
    expect(await screen.findByRole('textbox')).toHaveFocus();
    await userEvent.type(screen.getByRole('textbox'), '야간은 4회로 맞춰 주세요');
    expect(screen.getByRole('textbox')).toHaveValue('야간은 4회로 맞춰 주세요');
    expect(screen.queryByRole('button', {name: 'aiAdjust.chat.confirmSchedule'})).not.toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
});
