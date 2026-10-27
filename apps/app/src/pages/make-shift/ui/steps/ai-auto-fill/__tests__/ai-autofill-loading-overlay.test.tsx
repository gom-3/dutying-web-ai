import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, fireEvent, render, screen} from '@/shared/util/test-utils';
import {AiAutofillLoadingOverlay} from '../ai-autofill-loading-overlay';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

const progress = () => Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));

describe('autofill loading overlay', () => {
    it('advances even when the execution start time was not supplied', () => {
        render(<AiAutofillLoadingOverlay startedAt={null} sidebarOpen />);

        expect(progress()).toBe(8);
        act(() => vi.advanceTimersByTime(5000));
        expect(progress()).toBeGreaterThan(8);
        expect(progress()).toBeLessThan(100);
        expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'false');
        expect(screen.getByRole('dialog')).toHaveClass('bg-[#121726]/55');
    });

    it('animates to completion and finishes once after the result arrives', () => {
        const onFinish = vi.fn();
        const startedAt = Date.now();
        const view = render(<AiAutofillLoadingOverlay startedAt={startedAt} onFinish={onFinish} />);

        act(() => vi.advanceTimersByTime(5000));

        const before = progress();

        view.rerender(<AiAutofillLoadingOverlay startedAt={startedAt} onFinish={onFinish} isFinishing />);
        act(() => vi.advanceTimersByTime(200));
        expect(progress()).toBeGreaterThan(before);
        expect(onFinish).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1000));
        expect(progress()).toBe(100);
        expect(onFinish).toHaveBeenCalledOnce();
    });

    it('fills quickly at first and keeps slowing down over equal time intervals', () => {
        render(<AiAutofillLoadingOverlay startedAt={Date.now()} />);

        const initial = progress();

        act(() => vi.advanceTimersByTime(5000));

        const early = progress();

        act(() => vi.advanceTimersByTime(5000));

        const middle = progress();

        act(() => vi.advanceTimersByTime(5000));

        const later = progress();

        expect(early).toBeGreaterThan(40);
        expect(middle).toBeGreaterThan(early);
        expect(later).toBeGreaterThan(middle);
        expect(early - initial).toBeGreaterThan(middle - early);
        expect(middle - early).toBeGreaterThan(later - middle);
        expect(later).toBeLessThan(90);
    });

    it('labels estimated progress without claiming completion until the result arrives', () => {
        const startedAt = Date.now();
        const view = render(<AiAutofillLoadingOverlay startedAt={startedAt} />);

        expect(screen.getByRole('dialog')).toHaveAccessibleName('근무표를 채우고 있어요');
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '예상 진행률 8%');
        act(() => vi.advanceTimersByTime(300_000));
        expect(screen.getByRole('dialog')).toHaveAccessibleName('근무표를 채우고 있어요');
        expect(screen.queryByText('근무표가 준비됐어요')).not.toBeInTheDocument();

        view.rerender(<AiAutofillLoadingOverlay startedAt={startedAt} isFinishing />);
        expect(screen.getByRole('dialog')).toHaveAccessibleName('근무표가 준비됐어요');
        act(() => vi.advanceTimersByTime(1000));
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '완료 100%');
    });

    it('waits below 100 until completion and cancels pending animation on unmount', () => {
        const onFinish = vi.fn();
        const startedAt = Date.now();
        const view = render(<AiAutofillLoadingOverlay startedAt={startedAt} onFinish={onFinish} />);

        act(() => vi.advanceTimersByTime(300_000));
        expect(progress()).toBeLessThan(100);
        expect(onFinish).not.toHaveBeenCalled();
        view.rerender(<AiAutofillLoadingOverlay startedAt={startedAt} onFinish={onFinish} isFinishing />);
        view.unmount();
        act(() => vi.advanceTimersByTime(1000));
        expect(onFinish).not.toHaveBeenCalled();
    });
    it('retains the original estimated progress bar and uses only compact background, conversation and cancel actions', () => {
        const onBackground = vi.fn();
        const onCancel = vi.fn();
        const onOpenConversation = vi.fn();

        render(
            <AiAutofillLoadingOverlay
                startedAt={Date.now() - 45000}
                onBackground={onBackground}
                onCancel={onCancel}
                onOpenConversation={onOpenConversation}
            />,
        );
        expect(screen.getByRole('dialog')).toHaveAccessibleName('근무표를 채우고 있어요');
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', expect.stringContaining('예상 진행률'));
        expect(progress()).toBeLessThan(100);
        fireEvent.click(screen.getByRole('button', {name: '닫고 계속 계산'}));
        expect(onBackground).toHaveBeenCalledOnce();
        expect(onCancel).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: '대화 보기'}));
        expect(onOpenConversation).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole('button', {name: '계산 요청 취소'}));
        expect(onCancel).toHaveBeenCalledOnce();
        fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape'});
        expect(onBackground).toHaveBeenCalledTimes(2);
    });
});
