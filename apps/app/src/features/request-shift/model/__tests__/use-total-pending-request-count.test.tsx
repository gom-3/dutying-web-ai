import {beforeEach, describe, expect, it, vi} from 'vitest';
import {wardQueryKeys} from '@/entities/ward/model/queries';
import {renderHook} from '@/shared/util/test-utils';
import {useTotalPendingRequestCount} from '../use-total-pending-request-count';

const {mockUseQuery, mockWardId} = vi.hoisted(() => ({
    mockUseQuery: vi.fn(),
    mockWardId: {value: 1 as number | null},
}));

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@tanstack/react-query');

    return {
        ...actual,
        useQuery: mockUseQuery,
    };
});

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {
            wardId: mockWardId.value,
        },
    }),
}));

describe('useTotalPendingRequestCount', () => {
    beforeEach(() => {
        mockWardId.value = 1;
        mockUseQuery.mockReset();
    });

    it('returns the ward pending request count for the navigation badge', () => {
        mockUseQuery.mockReturnValue({data: 12});

        const {result} = renderHook(() => useTotalPendingRequestCount());

        expect(result.current).toBe(12);
        expect(mockUseQuery).toHaveBeenCalledWith({
            queryKey: wardQueryKeys.requestPendingCount(1),
            queryFn: expect.any(Function),
            enabled: true,
            select: expect.any(Function),
        });
    });

    it('returns zero and disables the query when ward id is missing', () => {
        mockWardId.value = null;
        mockUseQuery.mockReturnValue({});

        const {result} = renderHook(() => useTotalPendingRequestCount());

        expect(result.current).toBe(0);
        expect(mockUseQuery).toHaveBeenCalledWith({
            queryKey: wardQueryKeys.requestPendingCount(0),
            queryFn: expect.any(Function),
            enabled: false,
            select: expect.any(Function),
        });
    });
});
