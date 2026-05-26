import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import useRegister from '..';

const {mockNavigate, mockHandleGetAccountMe, mockApplyAccountMe, mockSetLoading, mockInitTutorial, mockCreateWard, mockEditAccountStatus} =
    vi.hoisted(() => ({
        mockNavigate: vi.fn(),
        mockHandleGetAccountMe: vi.fn(),
        mockApplyAccountMe: vi.fn(),
        mockSetLoading: vi.fn(),
        mockInitTutorial: vi.fn(),
        mockCreateWard: vi.fn(),
        mockEditAccountStatus: vi.fn(),
    }));

vi.mock('react-router', async () => {
    const actual = await vi.importActual('react-router');

    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query');

    return {
        ...actual,
        useQuery: vi.fn(() => ({data: null})),
    };
});

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {
            accountMe: {
                accountId: 1,
                status: 'WARD_SELECT_PENDING',
            },
            accountId: 1,
        },
        actions: {
            handleGetAccountMe: mockHandleGetAccountMe,
            applyAccountMe: mockApplyAccountMe,
        },
    }),
}));

vi.mock('@/features/loading', () => ({
    default: () => ({
        setLoading: mockSetLoading,
    }),
}));

vi.mock('@/features/tutorial', () => ({
    default: () => ({
        initTutorial: mockInitTutorial,
    }),
}));

vi.mock('@/shared/api', () => ({
    AccountAPI: {
        editAccountStatus: mockEditAccountStatus,
    },
    NurseAPI: {},
    WardAPI: {
        createWard: mockCreateWard,
        addMeToWaitingNurses: vi.fn(),
        deleteWaitingNurses: vi.fn(),
    },
}));

describe('useRegister', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('applies the linked account immediately after creating a ward', async () => {
        const createdWard = {wardId: 10, name: 'ICU'};
        const linkedAccount = {
            accountId: 1,
            nurseId: 2,
            wardId: 10,
            shiftTeamId: 20,
            email: 'nurse@example.com',
            name: 'Kim',
            profileImgUrl: '',
            isManager: true,
            status: 'LINKED',
        };

        mockCreateWard.mockResolvedValue(createdWard);
        mockEditAccountStatus.mockResolvedValue(linkedAccount);
        mockHandleGetAccountMe.mockImplementation(() => new Promise(() => undefined));

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await expect(
                result.current.actions.createWard(
                    {
                        name: 'ICU',
                        hospitalName: 'Dutying Hospital',
                        shiftTeams: [],
                        wardShiftTypes: [],
                    },
                    {navigateOnLinked: false},
                ),
            ).resolves.toBe(createdWard);
        });

        expect(mockApplyAccountMe).toHaveBeenCalledWith(linkedAccount);
        expect(mockHandleGetAccountMe).toHaveBeenCalledTimes(1);
        expect(mockApplyAccountMe.mock.invocationCallOrder[0]).toBeLessThan(mockHandleGetAccountMe.mock.invocationCallOrder[0]);
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
