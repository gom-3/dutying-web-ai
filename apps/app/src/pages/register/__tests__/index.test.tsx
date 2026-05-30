import {beforeEach, describe, expect, it, vi} from 'vitest';
import ROUTE from '@/shared/constant/path';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import RegisterPage from '../index';

const mockHandleGetAccountMe = vi.fn();
const mockNavigate = vi.fn();

let mockAuthState: {
    accountMe: {
        status:
            | 'INITIAL'
            | 'NURSE_INFO_PENDING'
            | 'WARD_SELECT_PENDING'
            | 'WARD_ENTRY_PENDING'
            | 'WORKSPACE_SETUP_PENDING'
            | 'LINKED'
            | 'DEMO';
    } | null;
    accountMeStatus: 'idle' | 'loading' | 'success' | 'error';
    _loaded: boolean;
} = {
    accountMe: null,
    accountMeStatus: 'loading',
    _loaded: false,
};

vi.mock('react-router', () => ({
    Navigate: ({to}: {to: string}) => <div>navigate:{to}</div>,
    useNavigate: () => mockNavigate,
}));

vi.mock('react-loading', () => ({
    __esModule: true,
    default: () => <div>spinner</div>,
}));

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: mockAuthState,
        actions: {
            handleGetAccountMe: mockHandleGetAccountMe,
        },
    }),
}));

describe('RegisterPage', () => {
    beforeEach(() => {
        mockHandleGetAccountMe.mockReset();
        mockHandleGetAccountMe.mockResolvedValue(undefined);
        mockNavigate.mockReset();
        mockAuthState = {
            accountMe: null,
            accountMeStatus: 'loading',
            _loaded: false,
        };
    });

    it('shows a loading spinner while account bootstrap is pending', () => {
        render(<RegisterPage />);

        expect(screen.getByLabelText('loading')).toBeInTheDocument();
    });

    it('shows a retryable error state when account bootstrap fails', async () => {
        const user = userEvent.setup();

        mockAuthState = {
            accountMe: null,
            accountMeStatus: 'error',
            _loaded: true,
        };

        render(<RegisterPage />);

        expect(screen.getByText('계정 정보를 불러오지 못했어요')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '다시 시도'}));

        expect(mockHandleGetAccountMe).toHaveBeenCalledTimes(1);
    });

    it('redirects every incomplete account status to the new ward creation onboarding page', () => {
        for (const status of [
            'INITIAL',
            'NURSE_INFO_PENDING',
            'WARD_SELECT_PENDING',
            'WARD_ENTRY_PENDING',
            'WORKSPACE_SETUP_PENDING',
        ] as const) {
            mockAuthState = {
                accountMe: {status},
                accountMeStatus: 'success',
                _loaded: true,
            };

            const {unmount} = render(<RegisterPage />);

            expect(screen.getByText(`navigate:${ROUTE.ONBOARDING_CREATE_WARD}`)).toBeInTheDocument();
            unmount();
        }
    });

    it('redirects linked accounts into the app', () => {
        mockAuthState = {
            accountMe: {status: 'LINKED'},
            accountMeStatus: 'success',
            _loaded: true,
        };

        render(<RegisterPage />);

        expect(screen.getByText(`navigate:${ROUTE.MAKE}`)).toBeInTheDocument();
    });
});
