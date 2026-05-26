import {MemoryRouter, Route, Routes} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor} from '@/shared/util/test-utils';
import {MainLayout} from '../main-layout';

const mockUseQuery = vi.fn();

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
            wardId: 10,
        },
    }),
}));

vi.mock('@/widgets/navigation-bar', () => ({
    default: () => <nav>navigation</nav>,
}));

vi.mock('@/widgets/ward-chat', () => ({
    default: () => null,
}));

describe('MainLayout', () => {
    beforeEach(() => {
        mockUseQuery.mockReset();
        mockUseQuery.mockReturnValue({
            data: {
                hospitalName: '듀팅병원',
                name: '중환자실',
                code: 'ABC123',
            },
        });
        window.sessionStorage.clear();
    });

    it('opens the ward code guide immediately from onboarding-created navigation state', async () => {
        render(
            <MemoryRouter
                initialEntries={[
                    {
                        pathname: '/duty',
                        state: {
                            onboardingWardCreated: {
                                wardCode: 'NEW123',
                                wardTitle: '듀팅병원 신규병동',
                            },
                        },
                    },
                ]}
            >
                <Routes>
                    <Route element={<MainLayout />}>
                        <Route path="/duty" element={<div>duty page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('NEW123')).toBeInTheDocument();
        expect(screen.getByText((content) => content.includes('듀팅병원 신규병동'))).toBeInTheDocument();
    });

    it('falls back to the one-time stored onboarding-created signal', async () => {
        window.sessionStorage.setItem('dutying:onboardingWardCreatedGuide', JSON.stringify(true));

        render(
            <MemoryRouter initialEntries={['/duty']}>
                <Routes>
                    <Route element={<MainLayout />}>
                        <Route path="/duty" element={<div>duty page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('ABC123')).toBeInTheDocument();
        expect(window.sessionStorage.getItem('dutying:onboardingWardCreatedGuide')).toBeNull();

        await waitFor(() => {
            expect(screen.getByText('duty page')).toBeInTheDocument();
        });
    });
});
