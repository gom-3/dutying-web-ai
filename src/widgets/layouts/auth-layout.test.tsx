import {MemoryRouter, Route, Routes} from 'react-router';
import {describe, expect, it, vi, beforeEach} from 'vitest';
import useAuth from '@/features/auth/useAuth';
import ROUTE from '@/shared/constant/path';
import {render, screen, waitFor} from '@/shared/util/test-utils';
import {AuthLayout} from './auth-layout';

vi.mock('@/features/auth/useAuth', () => ({
    default: vi.fn(),
}));

vi.mock('@/shared/util/useInterval', () => ({
    default: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

describe('AuthLayout', () => {
    beforeEach(() => {
        mockedUseAuth.mockReturnValue({
            state: {
                isAuth: true,
                accountMe: {
                    status: 'WARD_SELECT_PENDING',
                },
                demoStartDate: null,
            },
            actions: {
                handleLogout: vi.fn(),
            },
        } as never);
    });

    it('allows onboarding ward create preview route for onboarding accounts', async () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.ONBOARDING_WARD_CREATE]}>
                <Routes>
                    <Route element={<AuthLayout />}>
                        <Route path={ROUTE.ONBOARDING_WARD_CREATE} element={<div>preview page</div>} />
                        <Route path={ROUTE.REGISTER} element={<div>register page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByText('preview page')).toBeInTheDocument();
        });
        expect(screen.queryByText('register page')).not.toBeInTheDocument();
    });
});
