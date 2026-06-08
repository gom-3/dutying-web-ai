import {act} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {wardQueryKeys} from '@/entities/ward/model/queries';
import {renderHook} from '@/shared/util/test-utils';
import useEditWard from '..';

const {
    mockInvalidateQueries,
    mockApproveWaitingNurses,
    mockConnectWaitingNurses,
    mockDeleteWaitingNurseRequest,
    mockToastSuccess,
    mockToastError,
} = vi.hoisted(() => ({
    mockInvalidateQueries: vi.fn(),
    mockApproveWaitingNurses: vi.fn(),
    mockConnectWaitingNurses: vi.fn(),
    mockDeleteWaitingNurseRequest: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
}));

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query');

    return {
        ...actual,
        useQuery: vi.fn(() => ({data: undefined})),
        useQueryClient: vi.fn(() => ({
            invalidateQueries: mockInvalidateQueries,
        })),
    };
});

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {
            wardId: 1,
        },
    }),
}));

vi.mock('@/shared/api', () => ({
    WardAPI: {
        approveWaitingNurses: mockApproveWaitingNurses,
        connectWaitingNurses: mockConnectWaitingNurses,
        deleteWaitingNurseRequest: mockDeleteWaitingNurseRequest,
    },
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: mockToastSuccess,
        error: mockToastError,
    },
}));

describe('useEditWard', () => {
    beforeEach(() => {
        mockInvalidateQueries.mockReset();
        mockApproveWaitingNurses.mockReset();
        mockConnectWaitingNurses.mockReset();
        mockDeleteWaitingNurseRequest.mockReset();
        mockToastSuccess.mockReset();
        mockToastError.mockReset();
    });

    it('returns true and invalidates ward queries after approving a waiting nurse', async () => {
        mockApproveWaitingNurses.mockResolvedValue(undefined);

        const {result} = renderHook(() => useEditWard());

        let isSuccess: boolean | undefined;

        await act(async () => {
            isSuccess = await result.current.actions.approveWaitingNurses(7, 20);
        });

        expect(isSuccess).toBe(true);
        expect(mockApproveWaitingNurses).toHaveBeenCalledWith(1, 7, 20);
        expect(mockInvalidateQueries).toHaveBeenNthCalledWith(1, {queryKey: wardQueryKeys.id(1)});
        expect(mockInvalidateQueries).toHaveBeenNthCalledWith(2, {queryKey: wardQueryKeys.shiftTeams(1)});
        expect(mockInvalidateQueries).toHaveBeenNthCalledWith(3, {queryKey: wardQueryKeys.waitingNurses(1)});
        expect(mockToastSuccess).toHaveBeenCalledWith('선택한 팀에 간호사를 추가했어요.');
        expect(mockToastError).not.toHaveBeenCalled();
    });

    it('invalidates shift teams after connecting a waiting nurse to an existing nurse', async () => {
        mockConnectWaitingNurses.mockResolvedValue(undefined);

        const {result} = renderHook(() => useEditWard());

        let isSuccess: boolean | undefined;

        await act(async () => {
            isSuccess = await result.current.actions.connectWaitingNurses(7, 99);
        });

        expect(isSuccess).toBe(true);
        expect(mockConnectWaitingNurses).toHaveBeenCalledWith(1, 7, 99);
        expect(mockInvalidateQueries).toHaveBeenNthCalledWith(1, {queryKey: wardQueryKeys.id(1)});
        expect(mockInvalidateQueries).toHaveBeenNthCalledWith(2, {queryKey: wardQueryKeys.shiftTeams(1)});
        expect(mockInvalidateQueries).toHaveBeenNthCalledWith(3, {queryKey: wardQueryKeys.waitingNurses(1)});
        expect(mockToastSuccess).toHaveBeenCalledWith('기존 간호사 계정과 연결했어요.');
        expect(mockToastError).not.toHaveBeenCalled();
    });

    it('returns false without showing an error toast when approveWaitingNurses rejects with a handled API code', async () => {
        mockApproveWaitingNurses.mockRejectedValue({code: 400});

        const {result} = renderHook(() => useEditWard());

        let isSuccess: boolean | undefined;

        await act(async () => {
            isSuccess = await result.current.actions.approveWaitingNurses(7, 20);
        });

        expect(isSuccess).toBe(false);
        expect(mockInvalidateQueries).not.toHaveBeenCalled();
        expect(mockToastSuccess).not.toHaveBeenCalled();
        expect(mockToastError).not.toHaveBeenCalled();
    });

    it('returns false and surfaces a generic feedback toast when connectWaitingNurses rejects with an unknown error shape', async () => {
        mockConnectWaitingNurses.mockRejectedValue({response: {status: 500}});

        const {result} = renderHook(() => useEditWard());

        let isSuccess: boolean | undefined;

        await act(async () => {
            isSuccess = await result.current.actions.connectWaitingNurses(7, 99);
        });

        expect(isSuccess).toBe(false);
        expect(mockConnectWaitingNurses).toHaveBeenCalledWith(1, 7, 99);
        expect(mockInvalidateQueries).not.toHaveBeenCalled();
        expect(mockToastSuccess).not.toHaveBeenCalled();
        expect(mockToastError).toHaveBeenCalledWith('기존 간호사 계정에 연결하지 못했어요.');
    });

    it('deletes a waiting nurse request by waitingNurseId and refreshes the waiting list', async () => {
        mockDeleteWaitingNurseRequest.mockResolvedValue(undefined);

        const {result} = renderHook(() => useEditWard());

        let isSuccess: boolean | undefined;

        await act(async () => {
            isSuccess = await result.current.actions.cancelWaiting(7);
        });

        expect(isSuccess).toBe(true);
        expect(mockDeleteWaitingNurseRequest).toHaveBeenCalledWith(1, 7);
        expect(mockInvalidateQueries).toHaveBeenNthCalledWith(1, {queryKey: wardQueryKeys.id(1)});
        expect(mockInvalidateQueries).toHaveBeenNthCalledWith(2, {queryKey: wardQueryKeys.waitingNurses(1)});
        expect(mockToastSuccess).toHaveBeenCalledWith('연동 요청을 거절했어요.');
        expect(mockToastError).not.toHaveBeenCalled();
    });

    it('returns false and shows feedback when waiting nurse request deletion fails', async () => {
        mockDeleteWaitingNurseRequest.mockRejectedValue({response: {status: 500}});

        const {result} = renderHook(() => useEditWard());

        let isSuccess: boolean | undefined;

        await act(async () => {
            isSuccess = await result.current.actions.cancelWaiting(7);
        });

        expect(isSuccess).toBe(false);
        expect(mockDeleteWaitingNurseRequest).toHaveBeenCalledWith(1, 7);
        expect(mockInvalidateQueries).not.toHaveBeenCalled();
        expect(mockToastSuccess).not.toHaveBeenCalled();
        expect(mockToastError).toHaveBeenCalledWith('연동 요청을 거절하지 못했어요.');
    });
});
