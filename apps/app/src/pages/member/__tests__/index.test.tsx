import {MemoryRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent, waitFor, within} from '@/shared/util/test-utils';
import MemberPage from '..';

const mockUseEditWard = vi.fn();
const mockUseEditShiftTeam = vi.fn();

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
                'page.member.deleteTeam': '팀 삭제',
                'page.member.addNurse': '간호사 추가',
                'page.member.addingNurse': '추가 중',
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
    default: () => null,
}));

describe('MemberPage', () => {
    beforeEach(() => {
        mockUseEditWard.mockReset();
        mockUseEditShiftTeam.mockReset();
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
                isAddingNurse: false,
                nurseSaveStatus: 'idle',
                isDeletingNurse: false,
            },
            actions: {
                selectNurse: vi.fn(() => true),
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
                isAddingNurse: false,
                nurseSaveStatus: 'idle',
                isDeletingNurse: false,
            },
            actions: {
                selectNurse: vi.fn(() => true),
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
});
