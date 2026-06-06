import {MemoryRouter, useLocation} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent, waitFor, within} from '@/shared/util/test-utils';
import MemberPage from '..';

const mockUseEditWard = vi.fn();
const mockUseEditShiftTeam = vi.fn();
const {mockNurseDetailDiscard, mockNurseDetailSave} = vi.hoisted(() => ({
    mockNurseDetailDiscard: vi.fn(),
    mockNurseDetailSave: vi.fn(),
}));

vi.mock('@/analytics', () => ({
    events: {memberPage: {createShiftTeam: 'createShiftTeam', focusNurse: 'focusNurse'}},
    sendEvent: vi.fn(),
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string) =>
            ({
                'page.member.title': '근무자 관리',
                'page.member.skillSettings': '숙련도 설정',
                'page.member.addTeam': '팀 추가',
                'page.member.deleteTeam': '팀 삭제',
                'page.member.addNurse': '간호사 추가',
                'page.member.addingNurse': '추가 중',
                'page.member.emptyTeamTitle': '간호사가 없어요',
                'page.member.emptyTeamDescription': '간호사를 추가해주세요',
                'page.member.table.name': '이름',
                'page.member.table.level': '숙련도',
                'page.member.table.shiftTypes': '근무',
                'page.member.table.isWorker': '근무자',
                'page.member.table.connection': '연동',
            })[key] ?? key,
    }),
}));

vi.mock('@/features/edit-ward', () => ({
    default: () => mockUseEditWard(),
}));

vi.mock('@/features/edit-shift-team', () => ({
    default: () => mockUseEditShiftTeam(),
}));

vi.mock('../ui/connection-manage', () => ({
    default: () => null,
}));

vi.mock('../ui/member-skill-level-modal', () => ({
    default: () => null,
}));

vi.mock('../ui/nurse-detail-panel', () => ({
    default: ({onRegisterDraftActions}: {onRegisterDraftActions?: (actions: {save: () => Promise<boolean>; discard: () => void}) => void}) => {
        onRegisterDraftActions?.({
            save: mockNurseDetailSave,
            discard: mockNurseDetailDiscard,
        });

        return null;
    },
}));

const LocationProbe = () => {
    const location = useLocation();

    return <span data-testid="location-search">{location.search}</span>;
};
const createMemberTestNurse = () => ({
    nurseId: 101,
    accountId: null,
    shiftTeamId: 10,
    wardId: 1,
    name: 'Nurse One',
    phoneNum: null,
    isConnected: false,
    nurseShiftTypes: [],
    isWorker: true,
    isDutyManager: false,
    isWardManager: false,
    gender: '',
    employmentDate: '',
    memo: '',
    isDeleted: false,
    divisionNum: 1,
    priority: 100,
});
const mockDirtySelectedNurseState = () => {
    const nurse = createMemberTestNurse();
    const shiftTeams = [
        {shiftTeamId: 10, name: 'Team A', nurseCnt: 1, nurses: [nurse]},
        {shiftTeamId: 20, name: 'Team B', nurseCnt: 0, nurses: []},
    ];

    mockUseEditShiftTeam.mockReturnValue({
        state: {
            ward: {
                wardId: 1,
                hospitalName: 'Hospital',
                name: 'Ward',
                code: 'ABC123',
                nurseCnt: 1,
                wardShiftTypes: [],
                shiftTeams,
            },
            shiftTeams,
            selectedNurse: nurse,
            selectedNurseDrawerMode: 'edit',
            isNurseDraftDirty: true,
            isAddingNurse: false,
            nurseSaveStatus: 'idle',
            isDeletingNurse: false,
        },
        actions: {
            selectNurse: vi.fn(() => true),
            setNurseDraftDirty: vi.fn(),
            createShiftTeam: vi.fn(),
            addNurse: vi.fn(),
            deleteNurse: vi.fn(),
            deleteShiftTeam: vi.fn(),
            updateShiftTeam: vi.fn(),
            updateNurse: vi.fn(),
            updateNurseShift: vi.fn(),
            disconnectNurse: vi.fn(),
        },
    });
};

describe('MemberPage', () => {
    beforeEach(() => {
        mockUseEditWard.mockReset();
        mockUseEditShiftTeam.mockReset();
        mockNurseDetailDiscard.mockReset();
        mockNurseDetailSave.mockReset();
        mockNurseDetailSave.mockResolvedValue(true);
        mockUseEditWard.mockReturnValue({
            state: {
                watingNurses: [],
            },
        });
        mockUseEditShiftTeam.mockReturnValue({
            state: {
                ward: {
                    wardId: 1,
                    hospitalName: '듀팅병원',
                    name: '중환자실',
                    code: 'ABC123',
                    nurseCnt: 0,
                    wardShiftTypes: [],
                    shiftTeams: [],
                },
                shiftTeams: [],
                selectedNurse: null,
                selectedNurseDrawerMode: null,
                isNurseDraftDirty: false,
                isAddingNurse: false,
                nurseSaveStatus: 'idle',
                isDeletingNurse: false,
            },
            actions: {
                selectNurse: vi.fn(() => true),
                setNurseDraftDirty: vi.fn(),
                createShiftTeam: vi.fn(),
                addNurse: vi.fn(),
                deleteNurse: vi.fn(),
                deleteShiftTeam: vi.fn(),
                updateShiftTeam: vi.fn(),
                updateNurse: vi.fn(),
                updateNurseShift: vi.fn(),
                disconnectNurse: vi.fn(),
            },
        });
    });

    it('병동코드 박스를 클릭하면 병동코드 안내 모달을 연다', async () => {
        render(
            <MemoryRouter>
                <MemberPage />
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByRole('button', {name: '병동코드 ABC123 안내 보기'}));

        const dialog = screen.getByRole('dialog', {name: '소속 간호사에게 병동코드를 알려주세요'});

        expect(dialog).toBeInTheDocument();
        expect(within(dialog).getByText('듀팅병원 중환자실 병동코드')).toBeInTheDocument();
        expect(within(dialog).getByText('ABC123')).toBeInTheDocument();
    });

    it('미연동 간호사 아이콘을 클릭하면 공용 병동코드 안내 모달을 연다', async () => {
        const selectNurse = vi.fn(() => true);
        const nurse = {
            nurseId: 101,
            accountId: null,
            shiftTeamId: 10,
            wardId: 1,
            name: '신규간호사1',
            phoneNum: null,
            isConnected: false,
            nurseShiftTypes: [],
            isWorker: true,
            isDutyManager: false,
            isWardManager: false,
            gender: '',
            employmentDate: '',
            memo: '',
            isDeleted: false,
            divisionNum: 1,
            priority: 100,
        };

        mockUseEditShiftTeam.mockReturnValue({
            state: {
                ward: {
                    wardId: 1,
                    hospitalName: '대학교병원',
                    name: '중환자실',
                    code: 'ABC123',
                    nurseCnt: 1,
                    wardShiftTypes: [],
                    shiftTeams: [{shiftTeamId: 10, name: 'A팀', nurseCnt: 1, nurses: [nurse]}],
                },
                shiftTeams: [{shiftTeamId: 10, name: 'A팀', nurseCnt: 1, nurses: [nurse]}],
                selectedNurse: null,
                selectedNurseDrawerMode: null,
                isNurseDraftDirty: false,
                isAddingNurse: false,
                nurseSaveStatus: 'idle',
                isDeletingNurse: false,
            },
            actions: {
                selectNurse,
                setNurseDraftDirty: vi.fn(),
                createShiftTeam: vi.fn(),
                addNurse: vi.fn(),
                deleteNurse: vi.fn(),
                deleteShiftTeam: vi.fn(),
                updateShiftTeam: vi.fn(),
                updateNurse: vi.fn(),
                updateNurseShift: vi.fn(),
                disconnectNurse: vi.fn(),
            },
        });

        render(
            <MemoryRouter>
                <MemberPage />
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByRole('button', {name: '신규간호사1 연동 상태 안내'}));

        const dialog = screen.getByRole('dialog', {name: '소속 간호사에게 병동코드를 알려주세요'});

        expect(selectNurse).toHaveBeenCalledWith(nurse.nurseId);
        expect(within(dialog).getByText('대학교병원 중환자실 병동코드')).toBeInTheDocument();
        expect(within(dialog).getByText('ABC123')).toBeInTheDocument();
        expect(screen.queryByRole('heading', {name: '병동코드 안내'})).not.toBeInTheDocument();
    });

    it('URL의 shiftTeamId와 같은 팀을 근무자 관리 토글에서 선택한다', async () => {
        mockUseEditShiftTeam.mockReturnValue({
            state: {
                ward: {
                    wardId: 1,
                    hospitalName: '듀팅병원',
                    name: '중환자실',
                    code: 'ABC123',
                    nurseCnt: 0,
                    wardShiftTypes: [],
                    shiftTeams: [
                        {shiftTeamId: 10, name: 'A팀', nurseCnt: 0, nurses: []},
                        {shiftTeamId: 20, name: 'B팀', nurseCnt: 0, nurses: []},
                    ],
                },
                shiftTeams: [
                    {shiftTeamId: 10, name: 'A팀', nurseCnt: 0, nurses: []},
                    {shiftTeamId: 20, name: 'B팀', nurseCnt: 0, nurses: []},
                ],
                selectedNurse: null,
                selectedNurseDrawerMode: null,
                isNurseDraftDirty: false,
                isAddingNurse: false,
                nurseSaveStatus: 'idle',
                isDeletingNurse: false,
            },
            actions: {
                selectNurse: vi.fn(() => true),
                setNurseDraftDirty: vi.fn(),
                createShiftTeam: vi.fn(),
                addNurse: vi.fn(),
                deleteNurse: vi.fn(),
                deleteShiftTeam: vi.fn(),
                updateShiftTeam: vi.fn(),
                updateNurse: vi.fn(),
                updateNurseShift: vi.fn(),
                disconnectNurse: vi.fn(),
            },
        });

        render(
            <MemoryRouter initialEntries={['/member?shiftTeamId=20']}>
                <MemberPage />
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /B팀/})).toHaveAttribute('aria-pressed', 'true');
        });

        await userEvent.click(screen.getByRole('button', {name: /A팀/}));

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /A팀/})).toHaveAttribute('aria-pressed', 'true');
        });
    });

    it('선택한 팀에 간호사가 없으면 빈 팀 안내 박스 안에 간호사 추가 버튼을 보여준다', async () => {
        const addNurse = vi.fn();

        mockUseEditShiftTeam.mockReturnValue({
            state: {
                ward: {
                    wardId: 1,
                    hospitalName: '듀팅병원',
                    name: '중환자실',
                    code: 'ABC123',
                    nurseCnt: 0,
                    wardShiftTypes: [],
                    shiftTeams: [{shiftTeamId: 10, name: 'A팀', nurseCnt: 0, nurses: []}],
                },
                shiftTeams: [{shiftTeamId: 10, name: 'A팀', nurseCnt: 0, nurses: []}],
                selectedNurse: null,
                selectedNurseDrawerMode: null,
                isNurseDraftDirty: false,
                isAddingNurse: false,
                nurseSaveStatus: 'idle',
                isDeletingNurse: false,
            },
            actions: {
                selectNurse: vi.fn(() => true),
                setNurseDraftDirty: vi.fn(),
                createShiftTeam: vi.fn(),
                addNurse,
                deleteNurse: vi.fn(),
                deleteShiftTeam: vi.fn(),
                updateShiftTeam: vi.fn(),
                updateNurse: vi.fn(),
                updateNurseShift: vi.fn(),
                disconnectNurse: vi.fn(),
            },
        });

        render(
            <MemoryRouter>
                <MemberPage />
            </MemoryRouter>,
        );

        expect(screen.getByText('간호사가 없어요')).toBeInTheDocument();
        expect(screen.getByText('간호사를 추가해주세요')).toBeInTheDocument();

        const addButtons = screen.getAllByRole('button', {name: '간호사 추가'});

        expect(addButtons).toHaveLength(1);

        await userEvent.click(addButtons[0]!);

        expect(addNurse).toHaveBeenCalledWith(10);
    });

    it('팀을 추가하면 새로 생성한 팀으로 이동한다', async () => {
        const createShiftTeam = vi.fn().mockResolvedValue({shiftTeamId: 30, name: 'C팀', nurseCnt: 0, nurses: []});

        mockUseEditShiftTeam.mockReturnValue({
            state: {
                ward: {
                    wardId: 1,
                    hospitalName: '듀팅병원',
                    name: '중환자실',
                    code: 'ABC123',
                    nurseCnt: 0,
                    wardShiftTypes: [],
                    shiftTeams: [
                        {shiftTeamId: 10, name: 'A팀', nurseCnt: 0, nurses: []},
                        {shiftTeamId: 20, name: 'B팀', nurseCnt: 0, nurses: []},
                    ],
                },
                shiftTeams: [
                    {shiftTeamId: 10, name: 'A팀', nurseCnt: 0, nurses: []},
                    {shiftTeamId: 20, name: 'B팀', nurseCnt: 0, nurses: []},
                ],
                selectedNurse: null,
                selectedNurseDrawerMode: null,
                isNurseDraftDirty: false,
                isAddingNurse: false,
                nurseSaveStatus: 'idle',
                isDeletingNurse: false,
            },
            actions: {
                selectNurse: vi.fn(() => true),
                setNurseDraftDirty: vi.fn(),
                createShiftTeam,
                addNurse: vi.fn(),
                deleteNurse: vi.fn(),
                deleteShiftTeam: vi.fn(),
                updateShiftTeam: vi.fn(),
                updateNurse: vi.fn(),
                updateNurseShift: vi.fn(),
                disconnectNurse: vi.fn(),
            },
        });

        render(
            <MemoryRouter initialEntries={['/member?shiftTeamId=10']}>
                <MemberPage />
                <LocationProbe />
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByRole('button', {name: '팀 추가'}));

        await waitFor(() => {
            expect(screen.getByTestId('location-search')).toHaveTextContent('shiftTeamId=30');
        });
        expect(createShiftTeam).toHaveBeenCalledTimes(1);
    });

    it('수정 중 팀 탭을 눌러 뜬 확인 모달에서 취소하면 원래 팀에 머문다', async () => {
        mockDirtySelectedNurseState();

        render(
            <MemoryRouter>
                <MemberPage />
                <LocationProbe />
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByRole('button', {name: /Team B/}));
        await userEvent.click(screen.getByRole('button', {name: '취소'}));

        expect(screen.getByTestId('location-search')).toHaveTextContent('');
        expect(mockNurseDetailDiscard).not.toHaveBeenCalled();
        expect(mockNurseDetailSave).not.toHaveBeenCalled();
    });

    it('수정 중 팀 탭을 눌러 뜬 확인 모달에서 저장 안 함을 누르면 저장 없이 원래 팀 이동을 실행한다', async () => {
        mockDirtySelectedNurseState();

        render(
            <MemoryRouter>
                <MemberPage />
                <LocationProbe />
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByRole('button', {name: /Team B/}));
        await userEvent.click(screen.getByRole('button', {name: '저장 안 함'}));

        await waitFor(() => {
            expect(screen.getByTestId('location-search')).toHaveTextContent('shiftTeamId=20');
        });
        expect(mockNurseDetailDiscard).toHaveBeenCalledTimes(1);
        expect(mockNurseDetailSave).not.toHaveBeenCalled();
    });

    it('수정 중 팀 탭을 눌러 뜬 확인 모달에서 저장 후 나가기를 누르면 저장 후 원래 팀 이동을 실행한다', async () => {
        mockDirtySelectedNurseState();

        render(
            <MemoryRouter>
                <MemberPage />
                <LocationProbe />
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByRole('button', {name: /Team B/}));
        await userEvent.click(screen.getByRole('button', {name: '저장 후 나가기'}));

        await waitFor(() => {
            expect(screen.getByTestId('location-search')).toHaveTextContent('shiftTeamId=20');
        });
        expect(mockNurseDetailSave).toHaveBeenCalledTimes(1);
        expect(mockNurseDetailDiscard).not.toHaveBeenCalled();
    });
});
