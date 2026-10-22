import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {sendScheduleResultFeedback} from '../../../../model/schedule-result-feedback';
import {AiResultSatisfaction} from '../ai-result-satisfaction';
vi.mock('../../../../model/schedule-result-feedback', () => ({sendScheduleResultFeedback: vi.fn()}));
const observation = {flowId: 'flow', serverEventId: 'result', wardId: 1, shiftTeamId: 2, year: 2026, month: 11};
beforeEach(async () => {
    vi.resetAllMocks();
    await i18n.changeLanguage('ko');
});
it('allows skipping without submitting or changing a schedule', () => {
    render(<AiResultSatisfaction observation={observation} />);
    fireEvent.click(screen.getByRole('button', {name: '나중에'}));
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(sendScheduleResultFeedback).not.toHaveBeenCalled();
});
it('preserves feedback and idempotency key on retry, then acknowledges receipt', async () => {
    vi.mocked(sendScheduleResultFeedback).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce();
    const hotkey = vi.fn();
    render(
        <div onKeyDown={hotkey}>
            <AiResultSatisfaction observation={observation} />
        </div>,
    );
    fireEvent.click(screen.getByRole('button', {name: '아쉬워요'}));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, {target: {value: ' 야간이 몰려 있어요 '}});
    fireEvent.keyDown(input, {key: 'Delete'});
    expect(hotkey).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
    await screen.findByRole('alert');
    expect(input).toHaveValue(' 야간이 몰려 있어요 ');
    fireEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
    await screen.findByRole('status');
    const calls = vi.mocked(sendScheduleResultFeedback).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(calls[1]);
    expect(calls[0]).toEqual([observation, expect.objectContaining({satisfaction: 'NEEDS_WORK', feedbackNote: '야간이 몰려 있어요'})]);
});
it('allows rating without a reason and prevents duplicate in-flight submission', async () => {
    let done!: () => void;
    vi.mocked(sendScheduleResultFeedback).mockImplementation(
        () =>
            new Promise<void>((resolve) => {
                done = resolve;
            }),
    );
    render(<AiResultSatisfaction observation={observation} />);
    fireEvent.click(screen.getByRole('button', {name: '마음에 들어요'}));
    const send = screen.getByRole('button', {name: '의견 보내기'});
    fireEvent.click(send);
    fireEvent.click(send);
    expect(sendScheduleResultFeedback).toHaveBeenCalledOnce();
    expect(sendScheduleResultFeedback).toHaveBeenCalledWith(
        observation,
        expect.objectContaining({feedbackNote: '', satisfaction: 'LIKED'}),
    );
    done();
    await waitFor(() => expect(screen.getByRole('status')).toBeVisible());
});
it('uses English and resets for a different result', async () => {
    await i18n.changeLanguage('en');
    const {rerender} = render(<AiResultSatisfaction key="one" observation={observation} />);
    fireEvent.click(screen.getByRole('button', {name: 'Not now'}));
    rerender(<AiResultSatisfaction key="two" observation={{...observation, serverEventId: 'next'}} />);
    expect(screen.getByRole('heading', {name: 'How do you like the schedule we just made?'})).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
