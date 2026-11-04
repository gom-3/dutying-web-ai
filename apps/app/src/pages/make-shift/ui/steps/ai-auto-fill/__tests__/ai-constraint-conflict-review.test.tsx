import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {ConstraintConflictReview} from '../ai-constraint-conflict-review';

afterEach(() => vi.useRealTimers());

const copy = (ko: string) => ko;
const review = {
    token: 'opaque-token',
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    violations: [
        {
            violationId: 'v1',
            ruleId: 9,
            templateCode: 'SHIFT_COUNT_PER_PERIOD',
            severity: 'HARD' as const,
            message: '가상간호사의 야간근무가 월 최대 2회보다 2회 많아요.',
            affectedCells: [],
            fixable: true,
        },
    ],
};

describe('conflicting condition consent', () => {
    it('shows the exact violation and never executes without Yes', () => {
        const proceed = vi.fn(async () => {});
        const revise = vi.fn();

        render(
            <ConstraintConflictReview
                review={review}
                current
                disabled={false}
                onProceed={proceed}
                onRevise={revise}
                onEditSettings={vi.fn()}
                copy={copy}
            />,
        );
        expect(screen.getByText(review.violations[0].message)).toBeInTheDocument();
        expect(proceed).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: '요청 수정하기'}));
        expect(revise).toHaveBeenCalledOnce();
        expect(screen.getByRole('button', {name: '근무 조건 수정하기'})).toBeEnabled();
        expect(screen.getByRole('button', {name: '예, 이번만 허용하고 진행'})).toBeEnabled();
        expect(proceed).not.toHaveBeenCalled();
    });
    it('uses the condition label and familiar counts rather than operator codes', () => {
        render(
            <ConstraintConflictReview
                review={{
                    ...review,
                    ruleLabels: {'9': '가상간호 야간 횟수'},
                    violations: [{...review.violations[0], messageArgs: {operator: 'MAX', expected: 2, actual: 4}}],
                }}
                current
                disabled={false}
                onProceed={vi.fn(async () => {})}
                onRevise={vi.fn()}
                onEditSettings={vi.fn()}
                copy={copy}
            />,
        );
        expect(screen.getByText('가상간호 야간 횟수')).toBeInTheDocument();
        expect(screen.getByText('설정한 횟수: 최대 2회 / 배정된 횟수: 4회')).toBeInTheDocument();
        expect(screen.queryByText(/MAX/)).not.toBeInTheDocument();
    });
    it('keeps dismissed conflict evidence without its old choices', () => {
        render(
            <ConstraintConflictReview
                review={review}
                current
                active={false}
                disabled={false}
                onProceed={vi.fn(async () => {})}
                onRevise={vi.fn()}
                onEditSettings={vi.fn()}
                copy={copy}
            />,
        );
        expect(screen.getByRole('region', {name: i18n.t('aiAutofillUi.conflictReview.title')})).toBeVisible();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('proceeds only after choosing the proposal', async () => {
        const proceed = vi.fn(async () => {});

        render(
            <ConstraintConflictReview
                review={review}
                current
                disabled={false}
                onProceed={proceed}
                onRevise={vi.fn()}
                onEditSettings={vi.fn()}
                copy={copy}
            />,
        );
        fireEvent.click(screen.getByRole('button', {name: '예, 이번만 허용하고 진행'}));
        expect(proceed).toHaveBeenCalledOnce();
        await waitFor(() => expect(screen.getByRole('button', {name: '요청 수정하기'})).toBeEnabled());
    });
    it.each([false, true])('blocks stale or expired candidates (expired=%s)', (expired) => {
        const proceed = vi.fn(async () => {});

        render(
            <ConstraintConflictReview
                review={{...review, expiresAt: expired ? '2000-01-01T00:00:00Z' : review.expiresAt}}
                current={expired}
                disabled={false}
                onProceed={proceed}
                onRevise={vi.fn()}
                onEditSettings={vi.fn()}
                copy={copy}
            />,
        );
        expect(screen.getByRole('button', {name: '예, 이번만 허용하고 진행'})).toBeDisabled();
        expect(screen.getByRole('button', {name: '요청 수정하기'})).toBeEnabled();
        fireEvent.click(screen.getByRole('button', {name: '예, 이번만 허용하고 진행'}));
        expect(proceed).not.toHaveBeenCalled();
    });
    it('shows understood intent and opens settings without applying a proposal', () => {
        const settings = vi.fn();
        const proceed = vi.fn(async () => {});

        render(
            <ConstraintConflictReview
                review={review}
                current
                disabled={false}
                requestSummary="월요일은 3명, 나머지 평일은 4명"
                onProceed={proceed}
                onRevise={vi.fn()}
                onEditSettings={settings}
                copy={copy}
            />,
        );
        expect(screen.getByText('월요일은 3명, 나머지 평일은 4명')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: '근무 조건 수정하기'}));
        expect(settings).toHaveBeenCalledOnce();
        expect(proceed).not.toHaveBeenCalled();
    });

    it.each([
        ['proceed', 'はい、今回だけ許可して進める'],
        ['revise', 'リクエストを変更'],
        ['settings', '設定を直接変更'],
    ] as const)('shows Japanese conflict details and keeps the %s choice explicit', async (choice, label) => {
        await i18n.changeLanguage('ja');

        const proceed = vi.fn(async () => {});
        const revise = vi.fn();
        const settings = vi.fn();

        render(
            <ConstraintConflictReview
                review={{
                    ...review,
                    expiresAt: new Date(Date.now() + 60000).toISOString(),
                    violations: [{...review.violations[0], messageArgs: {operator: 'MAX', expected: 2, actual: 4}}],
                }}
                current
                disabled={false}
                onProceed={proceed}
                onRevise={revise}
                onEditSettings={settings}
                copy={copy}
            />,
        );
        expect(screen.getByRole('region', {name: '条件の競合を確認'})).toBeVisible();
        expect(screen.getByText('設定：2回以下 / 結果：4回')).toBeVisible();
        expect(screen.getByRole('button', {name: 'はい、今回だけ許可して進める'})).toBeEnabled();
        expect(proceed).not.toHaveBeenCalled();
        expect(revise).not.toHaveBeenCalled();
        expect(settings).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: label}));
        await waitFor(() => expect({proceed, revise, settings}[choice]).toHaveBeenCalledOnce());

        if (choice !== 'proceed') expect(proceed).not.toHaveBeenCalled();
    });
});

describe('conflict review recovery', () => {
    const props = () => ({
        review: {...review, expiresAt: new Date(Date.now() + 60000).toISOString()},
        current: true,
        disabled: false,
        onProceed: vi.fn(async () => {}),
        onRevise: vi.fn(),
        onEditSettings: vi.fn(),
        copy,
    });

    it('announces a failed application and lets the user retry', async () => {
        const p = props();

        p.onProceed.mockRejectedValueOnce(new Error('network'));
        render(<ConstraintConflictReview {...p} />);
        fireEvent.click(screen.getByRole('button', {name: '예, 이번만 허용하고 진행'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('현재 근무표를 먼저 확인');
        fireEvent.click(screen.getByRole('button', {name: '예, 이번만 허용하고 진행'}));
        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
        expect(p.onProceed).toHaveBeenCalledTimes(2);
    });
    it('shows Japanese progress and failure recovery without changing retry behavior', async () => {
        await i18n.changeLanguage('ja');

        let fail!: (reason: Error) => void;

        const p = props();

        p.onProceed.mockImplementationOnce(
            () =>
                new Promise<void>((_resolve, reject) => {
                    fail = reject;
                }),
        );
        render(<ConstraintConflictReview {...p} />);
        fireEvent.click(screen.getByRole('button', {name: 'はい、今回だけ許可して進める'}));
        expect(screen.getByRole('region', {name: '条件の競合を確認'})).toHaveAttribute('aria-busy', 'true');

        const pending = screen.getByRole('button', {name: '提案を反映中…'});

        expect(pending).toBeDisabled();
        fireEvent.click(pending);
        expect(p.onProceed).toHaveBeenCalledOnce();
        await act(async () => fail(new Error('network')));
        expect(screen.getByRole('alert')).toHaveTextContent('提案の反映が完了したか確認できませんでした。');
        expect(screen.getByRole('button', {name: 'リクエストを変更'})).toBeEnabled();
        expect(screen.getByRole('button', {name: '設定を直接変更'})).toBeEnabled();
        fireEvent.click(screen.getByRole('button', {name: 'はい、今回だけ許可して進める'}));
        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
        expect(p.onProceed).toHaveBeenCalledTimes(2);
    });
    it('shows progress, blocks duplicate requests and does not submit a parent form', async () => {
        let finish!: () => void;

        const p = props();

        p.onProceed.mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                }),
        );

        const submit = vi.fn((event) => event.preventDefault());

        render(
            <form onSubmit={submit}>
                <ConstraintConflictReview {...p} />
            </form>,
        );
        fireEvent.click(screen.getByRole('button', {name: '요청 수정하기'}));
        fireEvent.click(screen.getByRole('button', {name: '근무 조건 수정하기'}));
        fireEvent.click(screen.getByRole('button', {name: '예, 이번만 허용하고 진행'}));

        const pending = screen.getByRole('button', {name: '제안 반영 중…'});

        expect(pending).toBeDisabled();
        fireEvent.click(pending);
        expect(p.onProceed).toHaveBeenCalledOnce();
        expect(submit).not.toHaveBeenCalled();
        await act(async () => finish());
    });
    it('disables a proposal when its expiry passes without another render', () => {
        vi.useFakeTimers();

        const p = props();

        render(<ConstraintConflictReview {...p} />);
        expect(screen.getByRole('button', {name: '예, 이번만 허용하고 진행'})).toBeEnabled();
        act(() => vi.advanceTimersByTime(60001));
        expect(screen.getByRole('button', {name: '예, 이번만 허용하고 진행'})).toBeDisabled();
        expect(screen.getByRole('button', {name: '요청 수정하기'})).toBeEnabled();
        expect(screen.getByText(/확인 시간이 지났어요/)).toBeVisible();
    });
});

it('separates the server conflict explanation from proposed validation without inventing a baseline comparison', () => {
    render(
        <ConstraintConflictReview
            review={{...review, explanation: '기존 조건에서 6일 연속이 필요해요.'}}
            current
            disabled={false}
            onProceed={vi.fn(async () => {})}
            onRevise={vi.fn()}
            copy={copy}
        />,
    );
    expect(screen.getByRole('heading', {name: '확인이 필요한 이유'})).toBeVisible();
    expect(screen.getByRole('heading', {name: '변경안에서 아직 맞추지 못한 조건'})).toBeVisible();
    expect(screen.getByText('기존 조건에서 6일 연속이 필요해요.')).toBeVisible();
    expect(screen.queryByText('제안한 근무표에서도 아래 조건은 맞추지 못했어요.')).not.toBeInTheDocument();
});
