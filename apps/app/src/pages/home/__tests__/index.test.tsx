import type * as ReactQueryModule from '@tanstack/react-query';
import {MemoryRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen} from '@/shared/util/test-utils';
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
});
