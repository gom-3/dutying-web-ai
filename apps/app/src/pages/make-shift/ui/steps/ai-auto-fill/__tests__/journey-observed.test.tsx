import {act, render} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {JourneyObserved} from '../journey-observed';
const report = vi.hoisted(() => vi.fn());
vi.mock('../../../../model/schedule-journey', () => ({reportScheduleJourney: report}));
const observation = {flowId: 'flow', serverEventId: 'result', wardId: 1, shiftTeamId: 2, year: 2026, month: 10};

beforeEach(() => {
    report.mockReset();
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({top: 10, left: 10, right: 200, bottom: 100} as DOMRect);
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
        configurable: true,
        get() {
            return this.textContent;
        },
    });
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});
it('reports committed UI text, not a server message inferred during fetch', async () => {
    const {rerender} = render(<JourneyObserved observation={observation}>사용자에게 보이는 안내</JourneyObserved>);
    expect(report).not.toHaveBeenCalled();
    await act(async () => {
        vi.runOnlyPendingTimers();
    });
    expect(report).toHaveBeenCalledWith(
        observation,
        expect.objectContaining({type: 'CLIENT_DISPLAYED', displayedText: '사용자에게 보이는 안내'}),
    );
    report.mockClear();
    rerender(<JourneyObserved observation={undefined}>다른 상태</JourneyObserved>);
    await act(async () => {
        vi.runOnlyPendingTimers();
    });
    expect(report).not.toHaveBeenCalled();
});
it('does not report an element hidden by the layout', async () => {
    vi.mocked(HTMLElement.prototype.getClientRects).mockReturnValue([] as unknown as DOMRectList);
    render(<JourneyObserved observation={observation}>숨겨진 안내</JourneyObserved>);
    await act(async () => {
        vi.runOnlyPendingTimers();
    });
    expect(report).not.toHaveBeenCalled();
});
