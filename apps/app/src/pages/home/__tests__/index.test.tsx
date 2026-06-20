import type * as ReactQueryModule from '@tanstack/react-query';
import {MemoryRouter} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import HomePage from '..';

const mockUseQuery = vi.fn();
const mockUseQueries = vi.fn();

vi.mock('@tanstack/react-query', async (importOriginal) => {
    const actual = await importOriginal<typeof ReactQueryModule>();

    return {
        ...actual,
        useQuery: (...args: unknown[]) => mockUseQuery(...args),
        useQueries: (...args: unknown[]) => mockUseQueries(...args),
    };
});

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {
            wardId: 1,
            accountMe: {
                name: '관리자',
            },
        },
    }),
}));

const createLoadedQuery = (data: unknown) => ({
    isPending: false,
    isError: false,
    data,
    refetch: vi.fn(),
});
const mockLoadedHomeQueries = ({deadlines = [], schedules = []}: {deadlines?: unknown[]; schedules?: unknown[]} = {}) => {
    mockUseQuery.mockImplementation((options?: {queryKey?: readonly unknown[]}) => {
        const queryKey = options?.queryKey ?? [];

        if (queryKey[0] === 'ward' && queryKey[1] === 'id') {
            return createLoadedQuery({
                wardId: 1,
                name: 'A병동',
                code: 'WARD',
                hospitalName: '테스트병원',
                nurseCnt: 0,
                wardShiftTypes: [],
                shiftTeams: [],
            });
        }

        if (queryKey[0] === 'ward' && queryKey[1] === 'shiftTeams') return createLoadedQuery([]);

        if (queryKey[0] === 'ward' && queryKey[1] === 'waitingNurses') return createLoadedQuery([]);

        if (queryKey[0] === 'ward' && queryKey[1] === 'requestPendingCount') return createLoadedQuery({totalPendingCount: 0});

        if (queryKey[0] === 'home' && queryKey[1] === 'ward-chat-unread') return createLoadedQuery({unreadCount: 0});

        if (queryKey[0] === 'home' && queryKey[1] === 'board-deadlines') return createLoadedQuery(deadlines);

        if (queryKey[0] === 'home' && queryKey[1] === 'board-schedules') return createLoadedQuery(schedules);

        return createLoadedQuery(undefined);
    });
    mockUseQueries.mockReturnValue([]);
};

describe('HomePage', () => {
    beforeEach(() => {
        mockUseQuery.mockReset();
        mockUseQueries.mockReset();
        mockUseQuery.mockReturnValue({
            isPending: true,
            isError: false,
            data: undefined,
            refetch: vi.fn(),
        });
        mockUseQueries.mockReturnValue([]);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows a dashboard skeleton while the home bootstrap data is loading', () => {
        render(
            <MemoryRouter>
                <HomePage />
            </MemoryRouter>,
        );

        const skeleton = screen.getByRole('status', {name: '홈을 불러오고 있어요'});

        expect(skeleton).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByTestId('home-page-skeleton')).toBe(skeleton);
        expect(screen.queryByText('병동 정보를 확인하고 있어요.')).not.toBeInTheDocument();
    });

    it('colors Saturday in the header date with the weekend blue tone', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 5, 20, 9));
        mockLoadedHomeQueries();

        render(
            <MemoryRouter>
                <HomePage />
            </MemoryRouter>,
        );

        expect(screen.getByText('토요일')).toHaveClass('text-[#5F8BFF]');
    });

    it('colors Sunday in the header date with the weekend red tone', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 5, 21, 9));
        mockLoadedHomeQueries();

        render(
            <MemoryRouter>
                <HomePage />
            </MemoryRouter>,
        );

        expect(screen.getByText('일요일')).toHaveClass('text-[#FF6384]');
    });

    it('opens the ward schedule modal when a home calendar schedule item is selected', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 5, 20, 9));
        mockLoadedHomeQueries({
            schedules: [
                {
                    scheduleId: 1,
                    title: '교육 일정',
                    content: '신규 교육',
                    scheduleDate: '2026-06-20',
                    startDate: '2026-06-20',
                    endDate: '2026-06-20',
                    allDay: true,
                    sourceType: 'MANUAL',
                },
            ],
        });

        render(
            <MemoryRouter>
                <HomePage />
            </MemoryRouter>,
        );
        vi.useRealTimers();

        const user = userEvent.setup();

        await user.click(screen.getByRole('button', {name: /교육 일정/}));

        expect(screen.getByRole('dialog', {name: '병동 일정 보기'})).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: '교육 일정'})).toBeInTheDocument();
        expect(screen.getByText('신규 교육')).toBeInTheDocument();
    });
});
