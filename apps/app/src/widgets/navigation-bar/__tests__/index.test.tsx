import {MemoryRouter, Route, Routes} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import ROUTE from '@/shared/constant/path';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import NavigationBar from '..';

const mockUseTotalPendingRequestCount = vi.fn(() => 0);
const mockUseEditWard = vi.fn(() => ({
    state: {
        watingNurses: [],
    },
}));
const translations = {
    'page.navigationBar.ariaLabel': '주요 메뉴',
    'page.navigationBar.expandAria': '사이드바 펼치기',
    'page.navigationBar.foldAria': '사이드바 접기',
    'page.navigationBar.home': '근무표',
    'page.navigationBar.sections.operations': '근무 운영',
    'page.navigationBar.sections.settings': '근무 설정',
    'page.navigationBar.items.make': '근무표',
    'page.navigationBar.items.request': '신청 근무',
    'page.navigationBar.items.board': '게시판',
    'page.navigationBar.items.member': '근무자',
    'page.navigationBar.items.wardSettings': '근무 설정',
    'page.navigationBar.items.account': '계정',
} as const;

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string) => translations[key as keyof typeof translations] ?? key,
    }),
}));

vi.mock('@/features/edit-ward', () => ({
    default: () => mockUseEditWard(),
}));

vi.mock('@/features/request-shift/model/use-total-pending-request-count', () => ({
    useTotalPendingRequestCount: () => mockUseTotalPendingRequestCount(),
}));

describe('NavigationBar', () => {
    beforeEach(() => {
        mockUseTotalPendingRequestCount.mockReset();
        mockUseTotalPendingRequestCount.mockReturnValue(0);
        mockUseEditWard.mockClear();
    });

    it('상단 근무표 버튼을 제거하고 근무표 메뉴를 하나만 노출한다', () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <NavigationBar />
            </MemoryRouter>,
        );

        expect(screen.getByText('근무 운영')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '근무표 만들기'})).not.toBeInTheDocument();
        expect(screen.getAllByRole('button', {name: '근무표'})).toHaveLength(1);
    });

    it('근무 운영 섹션 위에 병원/병동명과 병동코드를 노출한다', () => {
        mockUseEditWard.mockReturnValueOnce({
            state: {
                ward: {
                    hospitalName: '듀팅병원',
                    name: '중환자실',
                    code: 'ABC123',
                    shiftTeams: [],
                },
                watingNurses: [],
            },
        });

        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <NavigationBar />
            </MemoryRouter>,
        );

        expect(screen.getByText('듀팅병원')).toBeInTheDocument();
        expect(screen.getByText('중환자실')).toBeInTheDocument();
        expect(screen.getByText('ABC123')).toBeInTheDocument();
        expect(screen.queryByText('듀팅병원 / 중환자실')).not.toBeInTheDocument();
        expect(screen.queryByText('#ABC123')).not.toBeInTheDocument();
    });

    it('병동명이 없으면 병원명을 대표 이름으로 노출한다', () => {
        mockUseEditWard.mockReturnValueOnce({
            state: {
                ward: {
                    hospitalName: '듀팅병원',
                    code: 'ABC123',
                    shiftTeams: [],
                },
                watingNurses: [],
            },
        });

        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <NavigationBar />
            </MemoryRouter>,
        );

        expect(screen.getByText('듀팅병원')).toBeInTheDocument();
        expect(screen.getByText('ABC123')).toBeInTheDocument();
    });

    it('사이드바를 접으면 병동정보와 병동코드를 노출하지 않는다', async () => {
        mockUseEditWard.mockReturnValue({
            state: {
                ward: {
                    hospitalName: '듀팅병원',
                    name: '중환자실',
                    code: 'ABC123',
                    shiftTeams: [],
                },
                watingNurses: [],
            },
        });

        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <NavigationBar />
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByRole('button', {name: '사이드바 접기'}));

        expect(screen.queryByText('듀팅병원')).not.toBeInTheDocument();
        expect(screen.queryByText('중환자실')).not.toBeInTheDocument();
        expect(screen.queryByText('ABC123')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '병동코드 ABC123 안내 보기'})).not.toBeInTheDocument();
    });

    it('병동코드를 누르면 간호사 공유 안내 모달을 연다', async () => {
        mockUseEditWard.mockReturnValueOnce({
            state: {
                ward: {
                    hospitalName: '듀팅병원',
                    name: '중환자실',
                    code: 'ABC123',
                    shiftTeams: [],
                },
                watingNurses: [],
            },
        });

        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <NavigationBar />
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByRole('button', {name: '병동코드 ABC123 안내 보기'}));

        const dialog = screen.getByRole('dialog', {name: '소속 간호사에게 병동코드를 알려주세요'});

        expect(dialog).toBeInTheDocument();
        expect(screen.getByText('듀팅병원 중환자실 병동코드')).toBeInTheDocument();
        expect(screen.getByText('간호사가 앱에서 바로 신청해요')).toBeInTheDocument();
        expect(screen.getByText('확정 근무표를 바로 공유해요')).toBeInTheDocument();
        expect(screen.getByText('병동채팅으로 빠르게 맞춰요')).toBeInTheDocument();
        expect(screen.getByText('게시판 공지 확인까지 챙겨요')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '병동코드 안내 닫기'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '듀팅 병동코드 입력 방법 보기'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '닫기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '듀팅 병동코드 복사하기'})).not.toBeInTheDocument();
    });

    it('설정 섹션에 계정 메뉴를 노출하고 하단 프로필 영역은 렌더링하지 않는다', () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <NavigationBar />
            </MemoryRouter>,
        );

        expect(screen.getByRole('button', {name: '계정'})).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('계정 메뉴를 클릭하면 프로필 페이지로 이동한다', async () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <Routes>
                    <Route
                        path={ROUTE.MAKE}
                        element={
                            <div className="flex">
                                <NavigationBar />
                                <div>make page</div>
                            </div>
                        }
                    />
                    <Route
                        path={ROUTE.PROFILE}
                        element={
                            <div className="flex">
                                <NavigationBar />
                                <div>profile page</div>
                            </div>
                        }
                    />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByText('make page')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: '계정'}));

        expect(await screen.findByText('profile page')).toBeInTheDocument();
    });

    it('사이드바를 접어도 주요 메뉴는 아이콘 버튼으로 남는다', async () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <NavigationBar />
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByRole('button', {name: '사이드바 접기'}));

        expect(screen.getByRole('button', {name: '사이드바 펼치기'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '게시판'})).toBeInTheDocument();
        expect(screen.queryByText('근무 운영')).not.toBeInTheDocument();
    });

    it('게시판 메뉴를 클릭하면 게시판 페이지로 이동한다', async () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <Routes>
                    <Route
                        path={ROUTE.MAKE}
                        element={
                            <div className="flex">
                                <NavigationBar />
                                <div>make page</div>
                            </div>
                        }
                    />
                    <Route
                        path={ROUTE.BOARD}
                        element={
                            <div className="flex">
                                <NavigationBar />
                                <div>board page</div>
                            </div>
                        }
                    />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByText('make page')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: '게시판'}));

        expect(await screen.findByText('board page')).toBeInTheDocument();
    });

    it('shows the total pending request badge on the request navigation item', () => {
        mockUseTotalPendingRequestCount.mockReturnValue(7);

        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <NavigationBar />
            </MemoryRouter>,
        );

        expect(screen.getByRole('button', {name: translations['page.navigationBar.items.request']})).toHaveTextContent('7');
    });
});
