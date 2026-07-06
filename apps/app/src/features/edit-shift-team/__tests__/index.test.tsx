/* eslint-disable @typescript-eslint/no-explicit-any */
import {act} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {renderHook} from '@/shared/util/test-utils';
import useEditShiftTeam from '..';
import useEditNurseStore from '../model/store';

const ward = {
    shiftTeams: [
        {
            shiftTeamId: 10,
            name: 'A팀',
            nurses: [{nurseId: 11, name: '김하나', divisionNum: 1, priority: 1000}],
        },
    ],
} as any;
const {
    mockInvalidateQueries,
    mockCancelQueries,
    mockGetQueryData,
    mockSetQueryData,
    mockUpdateNurse,
    mockAddNurseIntoShiftTeam,
    mockRemoveNurseFromShiftTeam,
    mockToastSuccess,
    mockToastError,
} = vi.hoisted(() => ({
    mockInvalidateQueries: vi.fn(),
    mockCancelQueries: vi.fn(),
    mockGetQueryData: vi.fn(),
    mockSetQueryData: vi.fn(),
    mockUpdateNurse: vi.fn(),
    mockAddNurseIntoShiftTeam: vi.fn(),
    mockRemoveNurseFromShiftTeam: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
}));

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query');

    return {
        ...actual,
        useQuery: vi.fn(() => ({data: ward})),
        useQueryClient: vi.fn(() => ({
            invalidateQueries: mockInvalidateQueries,
            cancelQueries: mockCancelQueries,
            getQueryData: mockGetQueryData,
            setQueryData: mockSetQueryData,
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

vi.mock('@/features/request-shift', () => ({
    default: () => ({
        queryKey: {
            requestShiftQueryKey: ['ward', 'requestShift'],
        },
    }),
}));

vi.mock('@/shared/api', () => ({
    NurseAPI: {
        updateNurse: mockUpdateNurse,
    },
    WardAPI: {
        addNurseIntoShiftTeam: mockAddNurseIntoShiftTeam,
        removeNurseFromShiftTeam: mockRemoveNurseFromShiftTeam,
    },
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: mockToastSuccess,
        error: mockToastError,
    },
}));

describe('useEditShiftTeam', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('ko');
        useEditNurseStore.getState().reset();
        mockInvalidateQueries.mockReset();
        mockCancelQueries.mockReset();
        mockGetQueryData.mockReset();
        mockSetQueryData.mockReset();
        mockUpdateNurse.mockReset();
        mockAddNurseIntoShiftTeam.mockReset();
        mockRemoveNurseFromShiftTeam.mockReset();
        mockToastSuccess.mockReset();
        mockToastError.mockReset();
    });

    it('keeps the draft dirty and exposes an error save status when updateNurse fails with an unknown error shape', async () => {
        useEditNurseStore.getState().selectNurse(11, 'create');
        useEditNurseStore.getState().setNurseDraftDirty(true);
        mockUpdateNurse.mockRejectedValue({response: {status: 500}});

        const {result} = renderHook(() => useEditShiftTeam());

        let isSuccess: boolean | undefined;

        await act(async () => {
            isSuccess = await result.current.actions.updateNurse(11, {name: '김하나'} as any);
        });

        expect(isSuccess).toBe(false);
        expect(result.current.state.nurseSaveStatus).toBe('error');
        expect(result.current.state.isNurseDraftDirty).toBe(true);
        expect(result.current.state.selectedNurseDrawerMode).toBe('create');
        expect(mockToastError).toHaveBeenCalledWith('간호사 정보를 수정하지 못했어요.');
        expect(mockInvalidateQueries).not.toHaveBeenCalled();
    });

    it('patches an existing nurse with null blank phone and without retired nurse fields', async () => {
        const {result} = renderHook(() => useEditShiftTeam());

        let isSuccess: boolean | undefined;

        await act(async () => {
            isSuccess = await result.current.actions.updateNurse(11, {
                name: '김하나',
                phoneNum: '',
                gender: '남',
                employmentDate: '2025-01-01',
                isDutyManager: true,
            } as any);
        });

        expect(isSuccess).toBe(true);
        expect(mockUpdateNurse).toHaveBeenCalledWith(11, {
            phoneNum: null,
            name: '김하나',
        });
    });

    it('clears an existing nurse dummy phone when saving', async () => {
        const {result} = renderHook(() => useEditShiftTeam());

        await act(async () => {
            await result.current.actions.updateNurse(11, {
                name: '김하나',
                phoneNum: '01000000000',
            });
        });

        expect(mockUpdateNurse).toHaveBeenCalledWith(11, {
            name: '김하나',
            phoneNum: null,
        });
    });

    it('creates a nurse immediately with the nurse create request contract', async () => {
        mockGetQueryData.mockReturnValue(ward);
        mockAddNurseIntoShiftTeam.mockResolvedValue({
            nurseId: 22,
            shiftTeamId: 10,
            wardId: 1,
            name: '신규간호사1',
            gender: '여',
            isWorker: true,
            employmentDate: '',
            isDutyManager: false,
            isWardManager: false,
            memo: '',
        });

        const {result} = renderHook(() => useEditShiftTeam());

        await act(async () => {
            await result.current.actions.addNurse(10);
        });

        expect(mockAddNurseIntoShiftTeam).toHaveBeenCalledWith(
            1,
            10,
            {
                name: '신규간호사1',
                isWorker: true,
                isWardManager: false,
                isPreceptor: false,
                isPreceptee: false,
                memo: '',
            },
        );
        expect(result.current.state.isAddingNurse).toBe(false);
        expect(useEditNurseStore.getState().selectedNurseId).toBe(22);
        expect(result.current.state.selectedNurseDrawerMode).toBe('create');
        expect(mockSetQueryData).toHaveBeenCalled();
        expect(mockToastSuccess).toHaveBeenCalledWith('신규간호사1를 추가했어요.', {
            position: 'bottom-center',
        });
    });

    it('posts the local draft without blank phone or retired nurse fields', async () => {
        const tempWard = {
            ...ward,
            shiftTeams: [
                {
                    ...ward.shiftTeams[0],
                    nurses: [
                        ...ward.shiftTeams[0].nurses,
                        {
                            nurseId: -1000000,
                            shiftTeamId: 10,
                            wardId: 1,
                            name: '',
                            phoneNum: '',
                            isWorker: true,
                            employmentDate: '',
                            isDutyManager: false,
                            isWardManager: false,
                            memo: '',
                        },
                    ],
                },
            ],
        } as any;

        mockGetQueryData.mockReturnValue(tempWard);
        mockAddNurseIntoShiftTeam.mockResolvedValue({
            nurseId: 22,
            shiftTeamId: 10,
            wardId: 1,
            name: '김신규',
            phoneNum: '01012345678',
        });

        const {result} = renderHook(() => useEditShiftTeam());

        await act(async () => {
            await result.current.actions.updateNurse(-1000000, {
                ...tempWard.shiftTeams[0].nurses[1],
                name: '김신규',
                phoneNum: '',
            });
        });

        expect(mockAddNurseIntoShiftTeam).toHaveBeenCalledWith(
            1,
            10,
            {
                name: '김신규',
                isWorker: true,
                isWardManager: false,
                memo: '',
            },
        );
        expect(useEditNurseStore.getState().selectedNurseId).toBe(22);
    });

    it('resets the deleting flag and preserves the current selection after deleteNurse fails', async () => {
        useEditNurseStore.getState().selectNurse(11);
        mockRemoveNurseFromShiftTeam.mockRejectedValue({message: 'server error'});

        const {result} = renderHook(() => useEditShiftTeam());

        await act(async () => {
            await result.current.actions.deleteNurse(10, 11);
        });

        expect(result.current.state.isDeletingNurse).toBe(false);
        expect(result.current.state.selectedNurse?.nurseId).toBe(11);
        expect(mockToastError).toHaveBeenCalledWith('간호사를 삭제하지 못했어요.');
        expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it('keeps the deleting flag on until ward invalidation finishes after deleteNurse succeeds', async () => {
        let resolveInvalidate: (() => void) | undefined;

        useEditNurseStore.getState().selectNurse(11);
        mockRemoveNurseFromShiftTeam.mockResolvedValue(undefined);
        mockInvalidateQueries.mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    resolveInvalidate = resolve;
                }),
        );

        const {result} = renderHook(() => useEditShiftTeam());

        let actionPromise: Promise<void> | undefined;

        await act(async () => {
            actionPromise = result.current.actions.deleteNurse(10, 11);
            await Promise.resolve();
        });

        expect(result.current.state.isDeletingNurse).toBe(true);
        expect(result.current.state.selectedNurse).toBeUndefined();

        await act(async () => {
            resolveInvalidate?.();
            await actionPromise;
        });

        expect(result.current.state.isDeletingNurse).toBe(false);
        expect(mockToastSuccess).toHaveBeenCalledWith('간호사를 삭제했어요.');
    });
});
