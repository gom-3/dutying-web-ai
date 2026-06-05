import type {TCreateWardDTO} from '@dutying/api/ward';
import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import useRegister from '..';

const {
    mockNavigate,
    mockHandleGetAccountMe,
    mockApplyAccountMe,
    mockSetLoading,
    mockInitTutorial,
    mockCreateWard,
    mockCreateWorkspace,
    mockJoinWardByCode,
    mockUpdateAdminMe,
    mockEditAccount,
    mockInitAccount,
    mockEditAccountStatus,
    mockGetWard,
    mockGetShiftTeams,
    mockCreateShiftTeam,
    mockUpdateShiftTeam,
    mockCreateShiftType,
    mockDeleteShiftType,
    mockAddNurseIntoShiftTeam,
    mockUpdateNurseShiftType,
    mockAccountMe,
    mockSetQueryData,
    mockInvalidateQueries,
} = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockHandleGetAccountMe: vi.fn(),
    mockApplyAccountMe: vi.fn(),
    mockSetLoading: vi.fn(),
    mockInitTutorial: vi.fn(),
    mockCreateWard: vi.fn(),
    mockCreateWorkspace: vi.fn(),
    mockJoinWardByCode: vi.fn(),
    mockUpdateAdminMe: vi.fn(),
    mockEditAccount: vi.fn(),
    mockInitAccount: vi.fn(),
    mockEditAccountStatus: vi.fn(),
    mockGetWard: vi.fn(),
    mockGetShiftTeams: vi.fn(),
    mockCreateShiftTeam: vi.fn(),
    mockUpdateShiftTeam: vi.fn(),
    mockCreateShiftType: vi.fn(),
    mockDeleteShiftType: vi.fn(),
    mockAddNurseIntoShiftTeam: vi.fn(),
    mockUpdateNurseShiftType: vi.fn(),
    mockSetQueryData: vi.fn(),
    mockInvalidateQueries: vi.fn(),
    mockAccountMe: {
        current: {
            accountId: 1,
            status: 'WARD_SELECT_PENDING',
        },
    } as {current: Record<string, unknown>},
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
        useQueryClient: vi.fn(() => ({
            setQueryData: mockSetQueryData,
            invalidateQueries: mockInvalidateQueries,
        })),
    };
});

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {
            accountMe: mockAccountMe.current,
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
        editAccount: mockEditAccount,
        initAccount: mockInitAccount,
        editAccountStatus: mockEditAccountStatus,
    },
    AdminAPI: {
        createWorkspace: mockCreateWorkspace,
        joinWardByCode: mockJoinWardByCode,
        updateMe: mockUpdateAdminMe,
    },
    NurseAPI: {
        updateNurseShiftType: mockUpdateNurseShiftType,
    },
    WardAPI: {
        createWard: mockCreateWard,
        getWard: mockGetWard,
        getShiftTeams: mockGetShiftTeams,
        createShiftTeam: mockCreateShiftTeam,
        updateShiftTeam: mockUpdateShiftTeam,
        createShiftType: mockCreateShiftType,
        deleteShiftType: mockDeleteShiftType,
        addNurseIntoShiftTeam: mockAddNurseIntoShiftTeam,
        addMeToWaitingNurses: vi.fn(),
        deleteWaitingNurses: vi.fn(),
    },
}));

describe('useRegister', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHandleGetAccountMe.mockResolvedValue(undefined);
        mockGetWard.mockResolvedValue({wardId: 10, wardShiftTypes: [], shiftTeams: []});
        mockGetShiftTeams.mockResolvedValue([{shiftTeamId: 1, name: '기본팀', nurseCnt: 0, nurses: []}]);
        mockCreateShiftTeam.mockResolvedValue({shiftTeamId: 2, name: '추가팀', nurseCnt: 0, nurses: []});
        mockUpdateShiftTeam.mockResolvedValue({shiftTeamId: 1, name: 'A팀', nurseCnt: 0, nurses: []});
        mockCreateShiftType.mockResolvedValue(undefined);
        mockDeleteShiftType.mockResolvedValue(undefined);
        mockAddNurseIntoShiftTeam.mockResolvedValue({
            nurseId: 99,
            name: '홍길동',
            nurseShiftTypes: [
                {nurseShiftTypeId: 1, name: '데이', shortName: 'D', isPossible: true, isPreferred: false},
                {nurseShiftTypeId: 2, name: '이브닝', shortName: 'E', isPossible: true, isPreferred: false},
            ],
        });
        mockUpdateNurseShiftType.mockResolvedValue(undefined);
        mockSetQueryData.mockReset();
        mockInvalidateQueries.mockReset();
        mockAccountMe.current = {
            accountId: 1,
            status: 'WARD_SELECT_PENDING',
        };
    });

    it('creates a legacy ward with the full ward payload and applies the linked account immediately', async () => {
        const createdWard = {
            wardId: 10,
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            code: 'A7K29Q',
            nurseCnt: 1,
            wardShiftTypes: [],
            shiftTeams: [{shiftTeamId: 1, name: '기본팀', nurseCnt: 1, nurses: [{nurseId: 99, name: '홍길동'}]}],
        };

        mockAccountMe.current = {
            accountId: 1,
            nurseId: null,
            wardId: null,
            shiftTeamId: null,
            email: 'nurse@example.com',
            name: 'Kim',
            profileImgUrl: '',
            isManager: true,
            status: 'WARD_SELECT_PENDING',
        };

        mockCreateWard.mockResolvedValue(createdWard);
        mockGetWard.mockResolvedValue(createdWard);
        mockGetShiftTeams.mockResolvedValue(createdWard.shiftTeams);
        mockHandleGetAccountMe.mockImplementation(() => new Promise(() => undefined));

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await expect(
                result.current.actions.createWard(
                    {
                        name: 'ICU',
                        hospitalName: 'Dutying Hospital',
                        shiftTeams: [{nurseNames: ['홍길동']}],
                        wardShiftTypes: [],
                    },
                    {navigateOnLinked: false},
                ),
            ).resolves.toEqual(createdWard);
        });

        expect(mockCreateWard).toHaveBeenCalledWith({
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            shiftTeams: [{nurseNames: ['홍길동']}],
            wardShiftTypes: [],
        });
        expect(mockCreateWorkspace).not.toHaveBeenCalled();
        expect(mockAddNurseIntoShiftTeam).not.toHaveBeenCalled();
        expect(mockApplyAccountMe).toHaveBeenCalledWith({
            ...mockAccountMe.current,
            wardId: 10,
            status: 'LINKED',
        });
        expect(mockSetQueryData).toHaveBeenCalled();
        expect(mockHandleGetAccountMe).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('creates a setup-pending admin ward through POST /wards with onboarding data', async () => {
        const latestWard = {
            wardId: 10,
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            code: 'A7K29Q',
            nurseCnt: 1,
            wardShiftTypes: [
                {
                    wardShiftTypeId: 1,
                    name: '데이',
                    shortName: 'D',
                    startTime: '07:00',
                    endTime: '15:00',
                    color: '#4DC2AD',
                    isOff: false,
                    isDefault: true,
                    isCounted: true,
                    classification: 'DAY',
                },
            ],
            shiftTeams: [
                {
                    shiftTeamId: 1,
                    name: 'A팀',
                    nurseCnt: 1,
                    nurses: [
                        {
                            nurseId: 99,
                            name: '홍길동',
                            nurseShiftTypes: [
                                {nurseShiftTypeId: 1, name: '데이', shortName: 'D', isPossible: true, isPreferred: false},
                                {nurseShiftTypeId: 2, name: '이브닝', shortName: 'E', isPossible: false, isPreferred: false},
                            ],
                        },
                    ],
                },
            ],
        };
        const payload: TCreateWardDTO = {
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            wardShiftTypes: [
                {
                    name: '데이',
                    shortName: 'D',
                    startTime: '07:00',
                    endTime: '15:00',
                    color: '#4DC2AD',
                    isOff: false,
                    isDefault: true,
                    isCounted: true,
                    classification: 'DAY',
                },
                {
                    name: '이브닝',
                    shortName: 'E',
                    startTime: '15:00',
                    endTime: '23:00',
                    color: '#FF8BA5',
                    isOff: false,
                    isDefault: true,
                    isCounted: true,
                    classification: 'EVENING',
                },
            ],
            shiftTeams: [
                {
                    name: 'A팀',
                    nurseNames: ['홍길동'],
                    nurses: [
                        {
                            name: '홍길동',
                            memo: '프리셉터',
                            isWorker: false,
                            employmentDate: '2025-01-01',
                            level: 2,
                            possibleShiftShortNames: ['D'],
                        },
                    ],
                },
            ],
        };

        mockAccountMe.current = {
            accountId: 1,
            nurseId: null,
            wardId: null,
            shiftTeamId: null,
            email: 'admin@example.com',
            name: 'Kim',
            profileImgUrl: '',
            phoneNum: '01012341234',
            isManager: true,
            status: 'WORKSPACE_SETUP_PENDING',
        };
        mockCreateWard.mockResolvedValue(latestWard);

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await expect(result.current.actions.createWard(payload, {navigateOnLinked: false})).resolves.toEqual(latestWard);
        });

        expect(mockCreateWard).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'ICU',
                hospitalName: 'Dutying Hospital',
                wardShiftTypes: expect.arrayContaining([
                    expect.objectContaining({shortName: 'D'}),
                    expect.objectContaining({shortName: 'E'}),
                ]),
                shiftTeams: expect.arrayContaining([
                    expect.objectContaining({
                        nurseNames: expect.arrayContaining([expect.any(String)]),
                        nurses: expect.arrayContaining([expect.objectContaining({employmentDate: '2025-01-01', level: 2})]),
                    }),
                ]),
            }),
        );
        expect(mockCreateWorkspace).not.toHaveBeenCalled();
        expect(mockGetWard).not.toHaveBeenCalled();
        expect(mockGetShiftTeams).not.toHaveBeenCalled();
        expect(mockCreateShiftType).not.toHaveBeenCalled();
        expect(mockUpdateShiftTeam).not.toHaveBeenCalled();
        expect(mockAddNurseIntoShiftTeam).not.toHaveBeenCalled();
        expect(mockUpdateNurseShiftType).not.toHaveBeenCalled();
        expect(mockApplyAccountMe).toHaveBeenCalledWith({
            ...mockAccountMe.current,
            wardId: 10,
            status: 'LINKED',
        });
    });

    it('does not run legacy seed APIs after POST /wards succeeds', async () => {
        const createdWard = {
            wardId: 10,
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            code: 'A7K29Q',
            nurseCnt: 0,
            wardShiftTypes: [],
            shiftTeams: [],
        };

        mockAccountMe.current = {
            accountId: 1,
            nurseId: null,
            wardId: null,
            shiftTeamId: null,
            email: 'admin@example.com',
            name: 'Kim',
            profileImgUrl: '',
            phoneNum: '01012341234',
            isManager: true,
            status: 'WORKSPACE_SETUP_PENDING',
        };
        mockCreateWard.mockResolvedValue(createdWard);

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await expect(
                result.current.actions.createWard(
                    {
                        name: 'ICU',
                        hospitalName: 'Dutying Hospital',
                        wardShiftTypes: [],
                        shiftTeams: [{name: 'A팀', nurseNames: ['김간호사']}],
                    },
                    {navigateOnLinked: false},
                ),
            ).resolves.toMatchObject({wardId: 10});
        });

        expect(mockCreateWard).toHaveBeenCalledTimes(1);
        expect(mockCreateWorkspace).not.toHaveBeenCalled();
        expect(mockApplyAccountMe).toHaveBeenCalledWith({
            ...mockAccountMe.current,
            wardId: 10,
            status: 'LINKED',
        });
        expect(mockAddNurseIntoShiftTeam).not.toHaveBeenCalled();
        expect(mockCreateShiftType).not.toHaveBeenCalled();
        expect(mockUpdateShiftTeam).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not mutate created ward data through legacy seed APIs', async () => {
        const createdWard = {
            wardId: 288,
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            code: 'A7K29Q',
            nurseCnt: 0,
            wardShiftTypes: [
                {
                    wardShiftTypeId: 1267,
                    name: '기본',
                    shortName: 'D',
                    startTime: '07:00',
                    endTime: '15:00',
                    color: '#4DC2AD',
                    isOff: false,
                    isDefault: true,
                    isCounted: true,
                    classification: 'DAY',
                },
            ],
            shiftTeams: [],
        };

        mockAccountMe.current = {
            accountId: 1,
            nurseId: null,
            wardId: null,
            shiftTeamId: null,
            email: 'admin@example.com',
            name: 'Kim',
            profileImgUrl: '',
            phoneNum: '01012341234',
            isManager: true,
            status: 'WORKSPACE_SETUP_PENDING',
        };
        mockCreateWard.mockResolvedValue(createdWard);

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await expect(
                result.current.actions.createWard(
                    {
                        name: 'ICU',
                        hospitalName: 'Dutying Hospital',
                        wardShiftTypes: [
                            {
                                name: '데이',
                                shortName: 'D',
                                startTime: '07:00',
                                endTime: '15:00',
                                color: '#4DC2AD',
                                isOff: false,
                                isDefault: true,
                                isCounted: true,
                                classification: 'DAY',
                            },
                        ],
                        shiftTeams: [{name: '기본팀', nurseNames: ['김간호사']}],
                    },
                    {navigateOnLinked: false},
                ),
            ).resolves.toMatchObject({wardId: 288});
        });

        expect(mockCreateWard).toHaveBeenCalledTimes(1);
        expect(mockCreateWorkspace).not.toHaveBeenCalled();
        expect(mockGetWard).not.toHaveBeenCalled();
        expect(mockGetShiftTeams).not.toHaveBeenCalled();
        expect(mockDeleteShiftType).not.toHaveBeenCalled();
        expect(mockCreateShiftType).not.toHaveBeenCalled();
        expect(mockAddNurseIntoShiftTeam).not.toHaveBeenCalled();
    });

    it('returns an already linked ward without creating or seeding another ward', async () => {
        const existingWard = {
            wardId: 288,
            name: 'ICU',
            hospitalName: 'Dutying Hospital',
            code: 'A7K29Q',
            nurseCnt: 0,
            wardShiftTypes: [],
            shiftTeams: [],
        };

        mockAccountMe.current = {
            accountId: 1,
            nurseId: null,
            wardId: 288,
            shiftTeamId: null,
            email: 'admin@example.com',
            name: 'Kim',
            profileImgUrl: '',
            phoneNum: '01012341234',
            isManager: true,
            status: 'LINKED',
        };
        mockGetWard.mockResolvedValue(existingWard);

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await expect(
                result.current.actions.createWard(
                    {
                        name: 'ICU',
                        hospitalName: 'Dutying Hospital',
                        wardShiftTypes: [],
                        shiftTeams: [{name: '기본팀', nurseNames: ['김간호사']}],
                    },
                    {navigateOnLinked: false},
                ),
            ).resolves.toEqual(existingWard);
        });

        expect(mockCreateWorkspace).not.toHaveBeenCalled();
        expect(mockCreateWard).not.toHaveBeenCalled();
        expect(mockGetWard).toHaveBeenCalledWith(288);
        expect(mockGetShiftTeams).not.toHaveBeenCalled();
        expect(mockAddNurseIntoShiftTeam).not.toHaveBeenCalled();
        expect(mockCreateShiftType).not.toHaveBeenCalled();
        expect(mockUpdateShiftTeam).not.toHaveBeenCalled();
    });

    it('does not let a stale account refetch overwrite the linked account after ward creation', async () => {
        const createdWard = {wardId: 271, name: 'ICU'};

        mockAccountMe.current = {
            accountId: 1,
            nurseId: null,
            wardId: null,
            shiftTeamId: null,
            email: 'admin@example.com',
            name: 'Kim',
            profileImgUrl: '',
            phoneNum: '01012341234',
            isManager: true,
            status: 'WORKSPACE_SETUP_PENDING',
        };
        mockHandleGetAccountMe.mockResolvedValue({
            ...mockAccountMe.current,
            status: 'WORKSPACE_SETUP_PENDING',
            wardId: null,
        });
        mockCreateWard.mockResolvedValue(createdWard);

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await result.current.actions.createWard(
                {
                    name: 'ICU',
                    hospitalName: 'Dutying Hospital',
                    wardShiftTypes: [],
                    shiftTeams: [{name: '기본팀', nurseNames: ['김간호사']}],
                },
                {navigateOnLinked: false},
            );
        });

        expect(mockApplyAccountMe).toHaveBeenCalledTimes(1);
        expect(mockApplyAccountMe).toHaveBeenCalledWith({
            ...mockAccountMe.current,
            wardId: 271,
            status: 'LINKED',
        });
        expect(mockHandleGetAccountMe).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('navigates after creating a setup-pending admin ward through POST /wards', async () => {
        const createdWard = {wardId: 271, name: 'ICU'};

        mockAccountMe.current = {
            accountId: 1,
            nurseId: null,
            wardId: null,
            shiftTeamId: null,
            email: 'admin@example.com',
            name: 'Kim',
            profileImgUrl: '',
            phoneNum: '01012341234',
            isManager: true,
            status: 'WORKSPACE_SETUP_PENDING',
        };
        mockCreateWard.mockResolvedValue(createdWard);

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await expect(
                result.current.actions.createWard({
                    name: 'ICU',
                    hospitalName: 'Dutying Hospital',
                    shiftTeams: [],
                    wardShiftTypes: [],
                }),
            ).resolves.toBe(createdWard);
        });

        expect(mockCreateWard).toHaveBeenCalledTimes(1);
        expect(mockCreateWorkspace).not.toHaveBeenCalled();
        expect(mockApplyAccountMe).toHaveBeenCalledWith({
            ...mockAccountMe.current,
            wardId: 271,
            status: 'LINKED',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/make');
    });

    it('joins a ward through the admin code endpoint', async () => {
        const joinedAccount = {
            accountId: 1,
            nurseId: null,
            wardId: 10,
            shiftTeamId: null,
            email: 'admin@example.com',
            name: 'Kim',
            profileImgUrl: '',
            isManager: true,
            status: 'LINKED',
            adminAccountId: 1,
            role: 'EDITOR',
            permissions: [],
            memberships: [],
        };

        mockJoinWardByCode.mockResolvedValue({account: joinedAccount});

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await expect(result.current.actions.joinWardByCode({code: 'A7K29Q'})).resolves.toEqual({account: joinedAccount});
        });

        expect(mockJoinWardByCode).toHaveBeenCalledWith({code: 'A7K29Q'});
        expect(mockApplyAccountMe).toHaveBeenCalledWith({
            ...joinedAccount,
            status: 'LINKED',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/make');
    });

    it('saves name and profile with editAccount for initial accounts', async () => {
        mockAccountMe.current = {
            accountId: 1,
            status: 'INITIAL',
        };

        const updatedAccount = {
            accountId: 1,
            nurseId: null,
            wardId: null,
            shiftTeamId: null,
            email: 'nurse@example.com',
            name: '홍길동',
            profileImgUrl: '',
            isManager: false,
            status: 'WARD_SELECT_PENDING',
        };

        mockEditAccount.mockResolvedValue(updatedAccount);
        mockEditAccountStatus.mockResolvedValue(updatedAccount);
        mockHandleGetAccountMe.mockImplementation(() => new Promise(() => undefined));

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await result.current.actions.registerAccountProfile({
                name: '홍길동',
                phoneNum: '01012345678',
                profileImg: {defaultProfileImgId: 1},
            });
        });

        expect(mockEditAccount).toHaveBeenCalledWith({
            accountId: 1,
            name: '홍길동',
            phoneNum: '01012345678',
            defaultProfileImgId: 1,
        });
        expect(mockInitAccount).not.toHaveBeenCalled();
        expect(mockEditAccountStatus).toHaveBeenCalledWith(1, 'WARD_SELECT_PENDING');
    });

    it('saves contact information for workspace setup accounts without changing legacy account status', async () => {
        mockAccountMe.current = {
            accountId: 1,
            status: 'WORKSPACE_SETUP_PENDING',
        };

        mockUpdateAdminMe.mockResolvedValue({
            accountId: 1,
            status: 'WORKSPACE_SETUP_PENDING',
            phoneNum: '01012345678',
        });

        const {result} = renderHook(() => useRegister());

        await act(async () => {
            await result.current.actions.registerAccountProfile({
                name: '종문',
                phoneNum: '01012345678',
                profileImg: {defaultProfileImgId: 1},
            });
        });

        expect(mockUpdateAdminMe).toHaveBeenCalledWith({
            name: '종문',
            phoneNum: '01012345678',
            defaultProfileImgId: 1,
        });
        expect(mockEditAccount).not.toHaveBeenCalled();
        expect(mockEditAccountStatus).not.toHaveBeenCalled();
        expect(mockHandleGetAccountMe).toHaveBeenCalledTimes(1);
        expect(mockApplyAccountMe).toHaveBeenCalledWith({
            accountId: 1,
            status: 'WORKSPACE_SETUP_PENDING',
            phoneNum: '01012345678',
        });
    });
});
