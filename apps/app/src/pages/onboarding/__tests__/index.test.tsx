import {beforeEach, describe, expect, it, vi} from 'vitest';
import useAuth from '@/features/auth';
import ROUTE from '@/shared/constant/path';
import {render, screen} from '@/shared/util/test-utils';
import OnboardingPage from '../index';

vi.mock('react-router', () => ({
    Navigate: ({to}: {to: string}) => <div>navigate:{to}</div>,
    useNavigate: () => vi.fn(),
}));

vi.mock('@/features/auth', () => ({
    default: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const handleGetAccountMe = vi.fn();

describe('OnboardingPage', () => {
    beforeEach(() => {
        handleGetAccountMe.mockReset();
        mockedUseAuth.mockReset();
    });

    it('redirects unlinked accounts to register instead of rendering ward choices', () => {
        mockedUseAuth.mockReturnValue({
            state: {
                accountMe: {status: 'WARD_SELECT_PENDING'},
                accountMeStatus: 'success',
                _loaded: true,
            },
            actions: {
                handleGetAccountMe,
            },
        } as never);

        render(<OnboardingPage />);

        expect(screen.getByText(`navigate:${ROUTE.REGISTER}`)).toBeInTheDocument();
        expect(screen.queryByText('새 병동 만들기')).not.toBeInTheDocument();
        expect(screen.queryByText('기존 병동 입장하기')).not.toBeInTheDocument();
    });

    it('keeps linked accounts headed into the app', () => {
        mockedUseAuth.mockReturnValue({
            state: {
                accountMe: {status: 'LINKED'},
                accountMeStatus: 'success',
                _loaded: true,
            },
            actions: {
                handleGetAccountMe,
            },
        } as never);

        render(<OnboardingPage />);

        expect(screen.getByText(`navigate:${ROUTE.HOME}`)).toBeInTheDocument();
    });
});
