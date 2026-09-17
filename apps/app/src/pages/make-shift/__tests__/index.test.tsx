import {within} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import ROUTE from '@/shared/constant/path';
import {render, screen, waitFor} from '@/shared/util/test-utils';
import MakeShiftPage from '..';

const mockUseQuery = vi.fn();
const mockUseMakeShiftBootstrap = vi.fn();

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query');

    return {
        ...actual,
        useQuery: (...args: unknown[]) => mockUseQuery(...args),
    };
});

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {
            wardId: 1,
        },
    }),
}));

vi.mock('../model/use-bootstrap', () => ({
    useMakeShiftBootstrap: (...args: unknown[]) => mockUseMakeShiftBootstrap(...args),
}));

vi.mock('../ui', () => ({
    MakeShiftPageView: ({wardCode}: {wardCode: string}) => <div data-testid="make-shift-page-view">{wardCode}</div>,
}));

vi.mock('../ui/make-tutorial', () => ({
    default: () => null,
}));

function LocationProbe() {
    const location = useLocation();

    return <div>{`${location.pathname}${location.search}`}</div>;
}

describe('MakeShiftPage', () => {
    beforeEach(() => {
        mockUseQuery.mockReset();
        mockUseMakeShiftBootstrap.mockReset();
        mockUseQuery.mockReturnValue({
            data: {
                hospitalName: '듀팅병원',
                name: '중환자실',
                code: 'ABC123',
            },
        });
    });

    it('병동 생성 직후 플래그로 들어오면 병동코드 안내 모달을 한 번 연다', async () => {
        render(
            <MemoryRouter initialEntries={[`${ROUTE.MAKE}?onboardingWardCreated=1`]}>
                <Routes>
                    <Route
                        path={ROUTE.MAKE}
                        element={
                            <>
                                <MakeShiftPage />
                                <LocationProbe />
                            </>
                        }
                    />
                </Routes>
            </MemoryRouter>,
        );

        const dialog = await screen.findByRole('dialog', {name: '소속 간호사에게 병동코드를 알려주세요'});

        expect(dialog).toBeInTheDocument();
        expect(screen.getByText('듀팅병원 중환자실 병동코드')).toBeInTheDocument();
        expect(within(dialog).getByText('ABC123')).toBeInTheDocument();
        expect(screen.getByTestId('make-shift-page-view')).toHaveTextContent('ABC123');

        await waitFor(() => {
            expect(screen.getByText(ROUTE.MAKE)).toBeInTheDocument();
        });
    });

    it('온보딩 초기 근무표 플래그는 bootstrap에 전달하고 주소에서는 flag만 제거한다', async () => {
        render(
            <MemoryRouter initialEntries={[`${ROUTE.MAKE}?onboardingWardCreated=1&onboardingSchedule=1&year=2026&month=6&shiftTeamId=77`]}>
                <Routes>
                    <Route
                        path={ROUTE.MAKE}
                        element={
                            <>
                                <MakeShiftPage />
                                <LocationProbe />
                            </>
                        }
                    />
                </Routes>
            </MemoryRouter>,
        );

        expect(mockUseMakeShiftBootstrap).toHaveBeenCalledWith(1, {
            initialScheduleTarget: {
                year: 2026,
                month: 6,
                shiftTeamId: 77,
            },
            initialScheduleTargets: [
                {
                    year: 2026,
                    month: 6,
                    shiftTeamId: 77,
                },
            ],
        });

        await waitFor(() => {
            expect(screen.getByText(`${ROUTE.MAKE}?year=2026&month=6&shiftTeamId=77`)).toBeInTheDocument();
        });
    });
});
