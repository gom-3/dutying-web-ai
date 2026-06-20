import {MemoryRouter, useLocation} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import ROUTE from '@/shared/constant/path';
import {render, screen, waitFor} from '@/shared/util/test-utils';
import {Router} from '../Router';

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {
            accountMe: null,
            accountMeStatus: 'idle',
            accessToken: null,
            isAuth: false,
            wardId: null,
            _loaded: true,
        },
        actions: {
            handleGetAccountMe: () => undefined,
            handleLogout: () => undefined,
        },
    }),
}));

vi.mock('@/pages/landing', () => ({
    default: () => <div>mobile landing route</div>,
}));

const LocationProbe = () => {
    const location = useLocation();

    return <div data-testid="location">{location.pathname}</div>;
};
const setPhoneViewport = (matches: boolean) => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: query === '(max-width: 767px)' ? matches : false,
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
};

describe('Router', () => {
    beforeEach(() => {
        setPhoneViewport(false);
    });

    it('redirects phone visitors away from auth routes to the landing page', async () => {
        setPhoneViewport(true);

        render(
            <MemoryRouter initialEntries={[ROUTE.LOGIN]}>
                <Router />
                <LocationProbe />
            </MemoryRouter>,
        );

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));

        expect(screen.getByText('mobile landing route')).toBeInTheDocument();
    });
});
