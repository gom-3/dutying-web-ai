import {MemoryRouter, Route, Routes} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type * as I18nModule from '@/i18n';
import ROUTE from '@/shared/constant/path';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import NavigationBar from '..';
import {useNavigationBarFoldStore} from '../navigation-bar-fold-store';

const mockUseTotalPendingRequestCount = vi.fn(() => 0);

type TMockUseEditWardResult = {
    state: {
        ward?: {
            hospitalName?: string;
            name?: string;
            code?: string;
            shiftTeams?: unknown[];
        };
        watingNurses: unknown[];
    };
};

const mockUseEditWard = vi.fn(
    (): TMockUseEditWardResult => ({
        state: {
            watingNurses: [],
        },
    }),
);

vi.mock('@/shared/hook/use-typed-translation', async () => {
    const {default: i18n} = await vi.importActual<typeof I18nModule>('@/i18n');

    return {
        useTypedTranslation: () => ({
            t: (key: string, values?: Record<string, string | number>) => i18n.t(key, values),
        }),
    };
});

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
        useNavigationBarFoldStore.getState().reset();
    });

    it('홈을 병원/병동명 바로 아래에 두고 근무표 만들기 메뉴를 노출한다', () => {
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

        const wardName = screen.getByText('중환자실');
        const hospitalName = screen.getByText('듀팅병원');
        const homeButton = screen.getByRole('button', {name: '홈'});
        const wardSectionLabel = screen.getByText('병동');

        expect(wardName.compareDocumentPosition(homeButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(homeButton.compareDocumentPosition(wardSectionLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(hospitalName.closest('.px-2')).not.toContainElement(homeButton);
        expect(homeButton).toHaveClass('justify-start', 'gap-3');
        expect(homeButton).not.toHaveClass('border');
        expect(homeButton).not.toHaveClass('bg-white');
        expect(screen.getByText('홈')).toHaveClass('flex-1', 'text-left');
        expect(screen.getAllByRole('button', {name: '근무표 만들기'})).toHaveLength(1);
        expect(screen.queryByRole('button', {name: '근무표'})).not.toBeInTheDocument();
    });

    it('병동 섹션 위에 병원/병동명과 병동코드를 노출한다', () => {
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

    it('마이페이지 메뉴를 내비게이션 하단에 고정하고 하단 프로필 영역은 렌더링하지 않는다', () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <NavigationBar />
            </MemoryRouter>,
        );

        const accountButton = screen.getByRole('button', {name: '마이페이지'});

        expect(accountButton).toBeInTheDocument();
        expect(accountButton.parentElement?.parentElement).toHaveClass('mt-auto');
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('마이페이지 메뉴를 클릭하면 프로필 페이지로 이동한다', async () => {
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

        await userEvent.click(screen.getByRole('button', {name: '마이페이지'}));

        expect(await screen.findByText('profile page')).toBeInTheDocument();
    });

    it('로고를 클릭하면 랜딩 메인 페이지로 이동한다', async () => {
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
                    <Route path={ROUTE.HOME} element={<div>home page</div>} />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByText('make page')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('link', {name: '근무표'}));

        expect(await screen.findByText('home page')).toBeInTheDocument();
    });

    it('설정 메뉴를 클릭하면 병동 설정 페이지로 이동한다', async () => {
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
                        path={ROUTE.WARD_INFO_SETTINGS}
                        element={
                            <div className="flex">
                                <NavigationBar />
                                <div>ward info settings page</div>
                            </div>
                        }
                    />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByText('make page')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: '병동 설정'}));

        expect(await screen.findByText('ward info settings page')).toBeInTheDocument();
    });

    it('병동 관리자 메뉴를 별도로 노출하지 않는다', () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <NavigationBar />
            </MemoryRouter>,
        );

        expect(screen.queryByRole('button', {name: '병동 관리자'})).not.toBeInTheDocument();
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
        expect(screen.queryByText('병동')).not.toBeInTheDocument();
    });

    it('일반 화면에서 접힌 사이드바는 hover해도 펼치지 않는다', async () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <NavigationBar />
            </MemoryRouter>,
        );

        const navigationBar = screen.getByTestId('navigation-bar');

        await userEvent.click(screen.getByRole('button', {name: '사이드바 접기'}));

        expect(navigationBar).toHaveClass('w-[64px]');
        expect(screen.queryByText('병동')).not.toBeInTheDocument();

        await userEvent.hover(navigationBar);

        expect(navigationBar).toHaveClass('w-[64px]');
        expect(screen.queryByText('병동')).not.toBeInTheDocument();

        await userEvent.unhover(navigationBar);

        expect(navigationBar).toHaveClass('w-[64px]');
        expect(screen.queryByText('병동')).not.toBeInTheDocument();
    });

    it('compact mode에서는 접기/펼치기 버튼 없이 hover 동안만 임시로 펼친다', async () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <NavigationBar compactMode />
            </MemoryRouter>,
        );

        const navigationBar = screen.getByTestId('navigation-bar');

        expect(navigationBar).toHaveClass('w-[64px]');
        expect(screen.queryByRole('button', {name: '사이드바 펼치기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '사이드바 접기'})).not.toBeInTheDocument();
        expect(screen.queryByText('병동')).not.toBeInTheDocument();

        await userEvent.hover(navigationBar);

        expect(navigationBar).toHaveClass('w-[216px]');
        expect(screen.getByText('병동')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '사이드바 펼치기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '사이드바 접기'})).not.toBeInTheDocument();

        await userEvent.unhover(navigationBar);

        expect(navigationBar).toHaveClass('w-[64px]');
        expect(screen.queryByText('병동')).not.toBeInTheDocument();
    });

    it('compact mode에서 열린 메뉴를 클릭하면 내비게이션을 다시 접는다', async () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.MAKE]}>
                <div className="flex">
                    <NavigationBar compactMode />
                    <Routes>
                        <Route path={ROUTE.MAKE} element={<div>make page</div>} />
                        <Route path={ROUTE.BOARD} element={<div>board page</div>} />
                    </Routes>
                </div>
            </MemoryRouter>,
        );

        const navigationBar = screen.getByTestId('navigation-bar');

        await userEvent.hover(navigationBar);

        expect(navigationBar).toHaveClass('w-[216px]');
        expect(screen.getByText('병동')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: '게시판'}));

        expect(await screen.findByText('board page')).toBeInTheDocument();
        await waitFor(() => {
            expect(navigationBar).toHaveClass('w-[64px]');
            expect(screen.queryByText('병동')).not.toBeInTheDocument();
        });
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

        expect(screen.getByRole('button', {name: '신청 근무'})).toHaveTextContent('7');
    });
});
