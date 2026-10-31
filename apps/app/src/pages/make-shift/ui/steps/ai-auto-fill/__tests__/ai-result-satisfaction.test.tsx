import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
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
it('stays small and optional; a click immediately records the rating', async () => {
    render(<AiResultSatisfaction observation={observation} />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(sendScheduleResultFeedback).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: '마음에 들어요'}));
    await waitFor(() => expect(screen.getByRole('button', {name: '마음에 들어요'})).toHaveAttribute('aria-pressed', 'true'));
    expect(sendScheduleResultFeedback).toHaveBeenCalledWith(
        observation,
        expect.objectContaining({satisfaction: 'LIKED', feedbackNote: ''}),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('opens reasons only on request; cancelling retains the already saved rating', async () => {
    render(<AiResultSatisfaction observation={observation} />);
    fireEvent.click(screen.getByRole('button', {name: '아쉬워요'}));
    fireEvent.click(await screen.findByRole('button', {name: '이유 남기기'}));
    expect(screen.getByRole('dialog')).toBeVisible();
    fireEvent.change(screen.getByRole('textbox'), {target: {value: ' 야간이 몰려 있어요 '}});
    fireEvent.click(screen.getAllByRole('button', {name: '닫기'})[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(sendScheduleResultFeedback).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', {name: '아쉬워요'})).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', {name: '이유 남기기'}));
    expect(screen.getByRole('textbox')).toHaveValue(' 야간이 몰려 있어요 ');
    fireEvent.click(screen.getByRole('button', {name: '의견 보내기'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(sendScheduleResultFeedback).toHaveBeenLastCalledWith(
        observation,
        expect.objectContaining({satisfaction: 'NEEDS_WORK', feedbackNote: '야간이 몰려 있어요'}),
    );
});
it('retries the exact failed event and prevents duplicate in-flight clicks', async () => {
    vi.mocked(sendScheduleResultFeedback).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce();
    render(<AiResultSatisfaction observation={observation} />);
    fireEvent.click(screen.getByRole('button', {name: '아쉬워요'}));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', {name: '아쉬워요'}));
    await screen.findByRole('status');
    expect(vi.mocked(sendScheduleResultFeedback).mock.calls[0]).toEqual(vi.mocked(sendScheduleResultFeedback).mock.calls[1]);
});
it('locks while sending and resets when a different applied result is mounted', async () => {
    let done!: () => void;

    vi.mocked(sendScheduleResultFeedback).mockImplementationOnce(
        () =>
            new Promise<void>((resolve) => {
                done = resolve;
            }),
    );

    const {rerender} = render(<AiResultSatisfaction key="a" observation={observation} />);
    const button = screen.getByRole('button', {name: '마음에 들어요'});

    fireEvent.click(button);
    fireEvent.click(button);
    expect(sendScheduleResultFeedback).toHaveBeenCalledOnce();
    await act(async () => done());
    rerender(<AiResultSatisfaction key="b" observation={{...observation, serverEventId: 'next'}} />);
    expect(screen.getByRole('button', {name: '마음에 들어요'})).toHaveAttribute('aria-pressed', 'false');
});
it('uses translated labels and stable API values', async () => {
    await i18n.changeLanguage('en');
    render(<AiResultSatisfaction observation={observation} />);
    fireEvent.click(screen.getByRole('button', {name: 'Needs improvement'}));
    await screen.findByRole('status');
    expect(sendScheduleResultFeedback).toHaveBeenCalledWith(observation, expect.objectContaining({satisfaction: 'NEEDS_WORK'}));
});
