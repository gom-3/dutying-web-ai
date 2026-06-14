import {beforeEach, describe, expect, it, vi} from 'vitest';
import {clearSocialSignupProfile, saveSocialSignupProfile} from '@/features/auth/model/social-signup';
import ROUTE from '@/shared/constant/path';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import RegisterPage from '../index';

const mockHandleGetAccountMe = vi.fn();
const mockNavigate = vi.fn();
let mockLocationSearch = '';

let mockAuthState: {
    accountMe: {
        status:
            | 'INITIAL'
            | 'NURSE_INFO_PENDING'
            | 'WARD_SELECT_PENDING'
            | 'WORKSPACE_SETUP_PENDING'
            | 'WARD_ENTRY_PENDING'
            | 'LINKED'
            | 'DEMO';
        phoneNum?: string | null;
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
    useLocation: () => ({state: null, search: mockLocationSearch}),
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

vi.mock('../ui/register-nurse', () => ({
    default: ({mode, onCompleted}: {mode?: 'default' | 'social'; onCompleted?: () => void}) => (
        <button type="button" onClick={onCompleted}>
            register nurse {mode ?? 'default'}
        </button>
    ),
}));

vi.mock('../ui/select-enter-or-create', () => ({
    default: ({onBack}: {onBack?: () => void}) => (
        <button type="button" onClick={onBack}>
            select enter or create
        </button>
    ),
}));

vi.mock('../ui/pending-enter', () => ({
    default: () => <div>pending enter</div>,
}));

describe('RegisterPage', () => {
    beforeEach(() => {
        mockHandleGetAccountMe.mockReset();
        mockHandleGetAccountMe.mockResolvedValue(undefined);
        mockNavigate.mockReset();
        mockLocationSearch = '';
        mockAuthState = {
            accountMe: null,
            accountMeStatus: 'loading',
            _loaded: false,
        };
        clearSocialSignupProfile();
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

    it('renders the account information step for initial account statuses', () => {
        for (const status of ['INITIAL', 'NURSE_INFO_PENDING'] as const) {
            mockAuthState = {
                accountMe: {status},
                accountMeStatus: 'success',
                _loaded: true,
            };

            const {unmount} = render(<RegisterPage />);

            expect(screen.getByText('register nurse default')).toBeInTheDocument();
            unmount();
        }
    });

    it('renders ward selection for accounts that already completed account information', () => {
        mockAuthState = {
            accountMe: {status: 'WARD_SELECT_PENDING'},
            accountMeStatus: 'success',
            _loaded: true,
        };

        render(<RegisterPage />);

        expect(screen.getByText('select enter or create')).toBeInTheDocument();
    });

    it('renders social contact information for workspace setup accounts without a phone number', () => {
        mockLocationSearch = '?socialSignup=1';
        mockAuthState = {
            accountMe: {status: 'WORKSPACE_SETUP_PENDING', phoneNum: null},
            accountMeStatus: 'success',
            _loaded: true,
        };

        render(<RegisterPage />);

        expect(screen.getByText('register nurse social')).toBeInTheDocument();
        expect(screen.queryByText('select enter or create')).not.toBeInTheDocument();
    });

    it('renders account contact information for password signup workspace accounts without a phone number', () => {
        mockAuthState = {
            accountMe: {status: 'WORKSPACE_SETUP_PENDING', phoneNum: null},
            accountMeStatus: 'success',
            _loaded: true,
        };

        render(<RegisterPage />);

        expect(screen.getByText('register nurse default')).toBeInTheDocument();
        expect(screen.queryByText('select enter or create')).not.toBeInTheDocument();
    });

    it('renders ward selection for workspace setup accounts after contact information is saved', () => {
        mockLocationSearch = '?socialSignup=1';
        mockAuthState = {
            accountMe: {status: 'WORKSPACE_SETUP_PENDING', phoneNum: '01012341234'},
            accountMeStatus: 'success',
            _loaded: true,
        };

        render(<RegisterPage />);

        expect(screen.getByText('select enter or create')).toBeInTheDocument();
    });

    it('renders social contact information for new social signup accounts', () => {
        saveSocialSignupProfile({
            provider: 'KAKAO',
            name: 'Kim',
            capturedAt: new Date().toISOString(),
        });
        mockAuthState = {
            accountMe: {status: 'INITIAL'},
            accountMeStatus: 'success',
            _loaded: true,
        };

        render(<RegisterPage />);

        expect(screen.getByText('register nurse social')).toBeInTheDocument();
        expect(screen.queryByText('select enter or create')).not.toBeInTheDocument();
    });

    it('renders social contact information when the register URL has the social signup marker', () => {
        mockLocationSearch = '?socialSignup=1';
        mockAuthState = {
            accountMe: {status: 'NURSE_INFO_PENDING'},
            accountMeStatus: 'success',
            _loaded: true,
        };

        render(<RegisterPage />);

        expect(screen.getByText('register nurse social')).toBeInTheDocument();
        expect(screen.queryByText('select enter or create')).not.toBeInTheDocument();
    });

    it('renders pending enter for accounts waiting to join a ward', () => {
        mockAuthState = {
            accountMe: {status: 'WARD_ENTRY_PENDING'},
            accountMeStatus: 'success',
            _loaded: true,
        };

        render(<RegisterPage />);

        expect(screen.getByText('pending enter')).toBeInTheDocument();
    });

    it('redirects linked accounts into the app', () => {
        mockAuthState = {
            accountMe: {status: 'LINKED'},
            accountMeStatus: 'success',
            _loaded: true,
        };

        render(<RegisterPage />);

        expect(screen.getByText(`navigate:${ROUTE.HOME}`)).toBeInTheDocument();
    });
});
