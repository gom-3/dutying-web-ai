import {beforeEach, describe, expect, it, vi} from 'vitest';
import useAuth from '@/features/auth';
import useGetWardByCode from '@/features/get-ward-by-code';
import useRegister from '@/features/register';
import {AdminAPI, AdminWardAPI, WardAPI} from '@/shared/api';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import OnboardingJoinWardPage from '../join-ward';

vi.mock('react-router', () => ({
    Navigate: ({to}: {to: string}) => <div>navigate:{to}</div>,
    useNavigate: () => vi.fn(),
}));

vi.mock('@/features/auth', () => ({
    default: vi.fn(),
}));

vi.mock('@/features/register', () => ({
    default: vi.fn(),
}));

vi.mock('@/features/get-ward-by-code', () => ({
    default: vi.fn(),
}));

vi.mock('@/shared/api', () => ({
    AdminAPI: {
        getMe: vi.fn(),
    },
    AdminWardAPI: {
        getWard: vi.fn(),
    },
    WardAPI: {
        getWard: vi.fn(),
    },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseRegister = vi.mocked(useRegister);
const mockedUseGetWardByCode = vi.mocked(useGetWardByCode);
const mockedAdminAPI = vi.mocked(AdminAPI);
const mockedAdminWardAPI = vi.mocked(AdminWardAPI);
const mockedWardAPI = vi.mocked(WardAPI);
const joinWardByCode = vi.fn();
const handleGetAccountMe = vi.fn();
const getWardByCode = vi.fn();
const renderPage = (
    accountMe: Record<string, unknown> = {status: 'WORKSPACE_SETUP_PENDING'},
    latestAdminMe: Record<string, unknown> = accountMe,
) => {
    mockedUseAuth.mockReturnValue({
        state: {
            accountMe,
            accountMeStatus: 'success',
            _loaded: true,
        },
        actions: {
            handleGetAccountMe,
        },
    } as never);
    mockedUseRegister.mockReturnValue({
        actions: {
            joinWardByCode,
        },
    } as never);
    mockedUseGetWardByCode.mockReturnValue({
        getWardByCode,
    } as never);
    mockedAdminAPI.getMe.mockResolvedValue(latestAdminMe as never);

    return render(<OnboardingJoinWardPage />);
};

describe('OnboardingJoinWardPage', () => {
    beforeEach(() => {
        mockedUseAuth.mockReset();
        mockedUseRegister.mockReset();
        mockedUseGetWardByCode.mockReset();
        mockedAdminAPI.getMe.mockReset();
        mockedAdminWardAPI.getWard.mockReset();
        mockedWardAPI.getWard.mockReset();
        joinWardByCode.mockReset();
        handleGetAccountMe.mockReset();
        getWardByCode.mockReset();
    });

    it('waits for explicit submit before requesting ward entry', async () => {
        const user = userEvent.setup();

        renderPage();

        await user.type(screen.getByLabelText(/병동 코드 입력|Ward code input/i), 'a7k29q');

        expect(joinWardByCode).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', {name: /코드로 입장|Enter with code/i}));

        await waitFor(() => {
            expect(joinWardByCode).toHaveBeenCalledWith({code: 'A7K29Q'});
        });
    });

    it('shows unsupported characters instead of silently dropping them', async () => {
        const user = userEvent.setup();
        const inputText = '가나다라마바';

        renderPage();

        const input = screen.getByLabelText(/병동 코드 입력|Ward code input/i);

        await user.type(input, inputText);

        expect(input).toHaveValue(inputText);
        expect(screen.getByText(/영문과 숫자만 사용할 수 있어요|Only letters and numbers are allowed/i)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /코드로 입장|Enter with code/i})).toBeDisabled();
        expect(joinWardByCode).not.toHaveBeenCalled();
    });

    it('hides the registered ward section when there are no registered wards', async () => {
        renderPage();

        await waitFor(() => {
            expect(screen.queryByText('내 이메일로 등록된 병동')).not.toBeInTheDocument();
        });
    });

    it('joins immediately when a registered ward is selected', async () => {
        const user = userEvent.setup();

        mockedAdminWardAPI.getWard.mockResolvedValueOnce({
            wardId: 77,
            hospitalName: '듀팅병원',
            name: '7A',
            code: 'A7K29Q',
            nurseCnt: 3,
            wardShiftTypes: [],
            shiftTeams: [],
        });

        renderPage({
            status: 'WORKSPACE_SETUP_PENDING',
            memberships: [{wardId: 77, role: 'OWNER', status: 'ACTIVE'}],
        });

        expect(await screen.findByText('듀팅병원')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: /듀팅병원 7A/}));

        await waitFor(() => {
            expect(joinWardByCode).toHaveBeenCalledWith({code: 'A7K29Q'});
        });
    });

    it('uses freshly loaded admin memberships for wards registered after login', async () => {
        mockedAdminWardAPI.getWard.mockResolvedValueOnce({
            wardId: 88,
            hospitalName: '새병원',
            name: '응급병동',
            code: 'B8M12Z',
            nurseCnt: 4,
            wardShiftTypes: [],
            shiftTeams: [],
        });

        renderPage(
            {status: 'WORKSPACE_SETUP_PENDING', memberships: []},
            {status: 'WORKSPACE_SETUP_PENDING', memberships: [{wardId: 88, role: 'EDITOR', status: 'ACTIVE'}]},
        );

        expect(await screen.findByText('새병원')).toBeInTheDocument();
        expect(screen.getByText('응급병동')).toBeInTheDocument();
    });
});
