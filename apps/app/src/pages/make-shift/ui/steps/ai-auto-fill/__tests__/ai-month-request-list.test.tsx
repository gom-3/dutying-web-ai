import type {TScheduleMonthRequestRes} from '@dutying/api/ward';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {describe, expect, it, vi} from 'vitest';
import AiMonthRequestList from '../ai-month-request-list';

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
    }),
}));

const request: TScheduleMonthRequestRes = {
    id: 1,
    kind: 'KNOB',
    lifetime: 'MONTH',
    status: 'ACTIVE',
    origin: 'TEXT',
    displayLabel: '오프를 공평하게 배치',
    knob: 'OFF_BALANCE',
    value: 1,
};

describe('saved request list', () => {
    it('distinguishes loading and failed requests from an empty list, and lets the user retry', async () => {
        const user = userEvent.setup();
        const onRetry = vi.fn();
        const props = {requests: [], disabled: false, disablingRequestId: null, onDisable: vi.fn(), onRetry};
        const {rerender, container} = render(<AiMonthRequestList {...props} isLoading />);
        expect(screen.getByRole('status')).toHaveTextContent('aiAdjust.savedRequests.loading');
        expect(screen.queryByText('aiAdjust.savedRequests.empty')).not.toBeInTheDocument();

        rerender(<AiMonthRequestList {...props} isError />);
        expect(screen.getByRole('alert')).toHaveTextContent('aiAdjust.savedRequests.error');
        expect(screen.queryByText('aiAdjust.savedRequests.empty')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.savedRequests.retry'}));
        expect(onRetry).toHaveBeenCalledTimes(1);

        rerender(<AiMonthRequestList {...props} />);
        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('dismisses with Escape or outside interaction without closing the sheet or losing input', async () => {
        const user = userEvent.setup();
        const onSheetKeyDown = vi.fn();
        const props = {requests: [request], disabled: false, disablingRequestId: null, onDisable: vi.fn()};
        render(
            <div onKeyDown={onSheetKeyDown}>
                <AiMonthRequestList {...props} />
                <textarea aria-label="요청 입력" defaultValue="작성 중인 요청" />
            </div>,
        );
        const toggle = screen.getByRole('button', {name: 'aiAdjust.savedRequests.titleCount {"count":1}'});
        await user.click(toggle);
        await user.tab();
        expect(screen.getByRole('button', {name: /savedRequests.removeLabel/})).toHaveFocus();
        onSheetKeyDown.mockClear();
        await user.keyboard('{Escape}');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(toggle).toHaveFocus();
        expect(onSheetKeyDown).not.toHaveBeenCalled();

        await user.click(toggle);
        await user.click(screen.getByRole('textbox'));
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByRole('textbox')).toHaveValue('작성 중인 요청');

        await user.click(toggle);
        await user.tab();
        await user.tab();
        expect(screen.getByRole('textbox')).toHaveFocus();
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('counts active requests only and keeps period, conditional status, and removal accessible', async () => {
        const user = userEvent.setup();
        const onDisable = vi.fn();
        const ongoing = {
            ...request,
            id: 2,
            lifetime: 'TEAM' as const,
            origin: 'CARRIED_OVER' as const,
            conditionStatus: 'WAITING_FOR_DATA' as const,
            displayLabel: '연속 근무 줄이기',
        };
        const props = {
            requests: [request, ongoing, {...request, id: 3, status: 'DISABLED' as const, displayLabel: '해제된 요청'}],
            disabled: false,
            disablingRequestId: null,
            onDisable,
        };
        const {rerender, container} = render(<AiMonthRequestList {...props} />);
        const expand = screen.getByRole('button', {name: 'aiAdjust.savedRequests.titleCount {"count":2}'});
        expect(expand).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('해제된 요청')).not.toBeInTheDocument();
        await user.tab();
        expect(expand).toHaveFocus();
        await user.keyboard('{Enter}');
        expect(expand).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('aiAdjust.savedRequests.lifetime.MONTH')).toBeVisible();
        expect(screen.getByText('aiAdjust.savedRequests.lifetime.TEAM')).toBeVisible();
        expect(screen.getByText(/requests.carriedOver/)).toBeVisible();
        expect(screen.getByText('page.makeShift.aiRefill.adjust.conditionStatus.WAITING_FOR_DATA')).toBeVisible();
        await user.click(screen.getByRole('button', {name: 'aiAdjust.savedRequests.removeLabel {"label":"오프를 공평하게 배치"}'}));
        expect(onDisable).toHaveBeenCalledExactlyOnceWith(request);

        rerender(<AiMonthRequestList {...props} disablingRequestId={1} />);
        const removing = screen.getByRole('button', {
            name: 'aiAdjust.savedRequests.removeLabel {"label":"오프를 공평하게 배치"}',
        });
        expect(removing).toBeDisabled();
        expect(removing).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByRole('button', {name: 'aiAdjust.savedRequests.removeLabel {"label":"연속 근무 줄이기"}'})).toBeDisabled();

        rerender(<AiMonthRequestList {...props} requests={[]} />);
        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        rerender(<AiMonthRequestList {...props} requests={[request]} />);
        expect(screen.getByRole('button', {name: /savedRequests.titleCount/})).toHaveAttribute('aria-expanded', 'false');
    });
});
