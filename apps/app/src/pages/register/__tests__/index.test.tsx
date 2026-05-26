import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import RegisterPage from '../index';

const mockHandleGetAccountMe = vi.fn();
const mockNavigate = vi.fn();

let mockLocationState: unknown = null;
let mockAuthState: {
    accountMe: {status: 'INITIAL' | 'NURSE_INFO_PENDING' | 'WARD_SELECT_PENDING' | 'WARD_ENTRY_PENDING' | 'LINKED'} | null;
    accountMeStatus: 'idle' | 'loading' | 'success' | 'error';
    _loaded: boolean;
} = {
    accountMe: null,
    accountMeStatus: 'loading',
    _loaded: false,
};

vi.mock('react-router', () => ({
    Navigate: ({to}: {to: string}) => <div>navigate:{to}</div>,
    useLocation: () => ({state: mockLocationState}),
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
    default: () => <div>register-nurse</div>,
}));

vi.mock('../ui/select-enter-or-create', () => ({
    default: ({onBack}: {onBack?: () => void}) => (
        <div>
            <div>select-enter-or-create</div>
            {onBack ? (
                <button type="button" onClick={onBack}>
                    계정 정보로
                </button>
            ) : null}
        </div>
    ),
}));

vi.mock('../ui/pending-enter', () => ({
    default: () => <div>pending-enter</div>,
}));

describe('RegisterPage', () => {
    beforeEach(() => {
        mockHandleGetAccountMe.mockReset();
        mockHandleGetAccountMe.mockResolvedValue(undefined);
        mockNavigate.mockReset();
        mockLocationState = null;
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

    it('renders the matching registration step when account status is available', () => {
        mockAuthState = {
            accountMe: {status: 'WARD_SELECT_PENDING'},
            accountMeStatus: 'success',
            _loaded: true,
        };

        render(<RegisterPage />);

        expect(screen.getByText('select-enter-or-create')).toBeInTheDocument();
    });

    it('shows the nurse info step when going back from ward selection', async () => {
        const user = userEvent.setup();

        mockAuthState = {
            accountMe: {status: 'WARD_SELECT_PENDING'},
            accountMeStatus: 'success',
            _loaded: true,
        };

        render(<RegisterPage />);

        await user.click(screen.getByRole('button', {name: '계정 정보로'}));

        expect(screen.getByText('register-nurse')).toBeInTheDocument();
    });

    it('hides the back action when the user arrived after quitting a ward', () => {
        mockLocationState = {fromQuitWard: true};
        mockAuthState = {
            accountMe: {status: 'WARD_SELECT_PENDING'},
            accountMeStatus: 'success',
            _loaded: true,
        };

        render(<RegisterPage />);

        expect(screen.getByText('select-enter-or-create')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '계정 정보로'})).not.toBeInTheDocument();
    });
});
