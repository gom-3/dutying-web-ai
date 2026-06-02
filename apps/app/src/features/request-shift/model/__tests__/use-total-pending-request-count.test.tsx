import {beforeEach, describe, expect, it, vi} from 'vitest';
import {wardQueryKeys} from '@/entities/ward/model/queries';
import {renderHook} from '@/shared/util/test-utils';
import {useRequestShiftStore} from '../store';
import {useTotalPendingRequestCount} from '../use-total-pending-request-count';

const {mockUseQueries, mockWardId} = vi.hoisted(() => ({
    mockUseQueries: vi.fn(),
    mockWardId: {value: 1 as number | null},
}));

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@tanstack/react-query');

    return {
        ...actual,
        useQueries: mockUseQueries,
    };
});

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {
            wardId: mockWardId.value,
        },
    }),
}));

const createShiftTeam = (shiftTeamId: number) => ({
    shiftTeamId,
    name: `${shiftTeamId}-team`,
    nurseCnt: 0,
    nurses: [],
});

describe('useTotalPendingRequestCount', () => {
    beforeEach(() => {
        mockWardId.value = 1;
        mockUseQueries.mockReset();
        useRequestShiftStore.getState().resetState();
        useRequestShiftStore.setState({year: 2026, month: 6, currentShiftTeamId: null});
    });

    it('sums pending request counts across provided shift teams for the navigation badge', () => {
        mockUseQueries.mockReturnValue([{data: 2}, {data: 1}]);

        const {result} = renderHook(() => useTotalPendingRequestCount([createShiftTeam(10), createShiftTeam(20)]));

        expect(result.current).toBe(3);
        expect(mockUseQueries).toHaveBeenCalledWith({
            queries: [
                expect.objectContaining({
                    queryKey: wardQueryKeys.requestList(1, 10, 2026, 6),
                    enabled: true,
                }),
                expect.objectContaining({
                    queryKey: wardQueryKeys.requestList(1, 20, 2026, 6),
                    enabled: true,
                }),
            ],
        });
    });

    it('returns zero when ward id is missing or shift teams are empty', () => {
        mockWardId.value = null;
        mockUseQueries.mockReturnValue([]);

        const {result} = renderHook(() => useTotalPendingRequestCount(undefined));

        expect(result.current).toBe(0);
        expect(mockUseQueries).toHaveBeenCalledWith({queries: []});
    });
});
