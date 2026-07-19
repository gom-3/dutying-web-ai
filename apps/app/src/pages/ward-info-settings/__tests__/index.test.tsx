import {beforeEach, describe, expect, it, vi} from 'vitest';
import {wardQueryKeys} from '@/entities/ward';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import WardInfoSettingsPage from '..';

const {mockEditWard, mockInvalidateQueries, mockSetQueryData, mockToastSuccess, mockToastError, mockQuitWard, mockUseQuery, mockAuthState} =
    vi.hoisted(() => ({
        mockEditWard: vi.fn(),
        mockInvalidateQueries: vi.fn(),
        mockSetQueryData: vi.fn(),
        mockToastSuccess: vi.fn(),
        mockToastError: vi.fn(),
        mockQuitWard: vi.fn(),
        mockUseQuery: vi.fn(),
        mockAuthState: {accessToken: null as string | null, wardId: 1},
    }));

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query');

    return {
        ...actual,
        useQuery: (...args: unknown[]) => mockUseQuery(...args),
        useQueryClient: () => ({
            invalidateQueries: mockInvalidateQueries,
            setQueryData: mockSetQueryData,
        }),
    };
});

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: mockAuthState,
    }),
}));

vi.mock('@/features/auth/model/admin-token', () => ({
    isWardAdminAccessToken: (accessToken?: string | null) => accessToken === 'ward-admin-token',
}));

vi.mock('@/features/account/model', () => ({
    useEditAccount: () => ({
        quitWard: mockQuitWard,
    }),
}));

vi.mock('@/shared/api', () => ({
    WardAPI: {
        editWard: mockEditWard,
    },
}));

vi.mock('@/pages/ward-admins', () => ({
    default: () => <div>ward admins panel</div>,
}));

vi.mock('@/widgets/notifications/notification-bell', () => ({
    NotificationBell: () => (
        <button type="button" aria-label="notification bell">
            bell
        </button>
    ),
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: mockToastSuccess,
        error: mockToastError,
    },
}));

const ward = {
    wardId: 1,
    name: '중환자실',
    hospitalName: '듀팅병원',
    code: 'ABC123',
    wardShiftTypes: [],
    shiftTeams: [],
};

describe('WardInfoSettingsPage', () => {
    beforeEach(() => {
        mockEditWard.mockReset();
        mockInvalidateQueries.mockReset();
        mockSetQueryData.mockReset();
        mockToastSuccess.mockReset();
        mockToastError.mockReset();
        mockQuitWard.mockReset();
        mockUseQuery.mockReset();
        mockAuthState.accessToken = null;
        mockUseQuery.mockReturnValue({
            data: ward,
            isPending: false,
            isError: false,
            refetch: vi.fn(),
        });
    });

    it('anchors the notification bell to the same 480px frame as the save button', () => {
        mockAuthState.accessToken = 'ward-admin-token';

        render(<WardInfoSettingsPage />);

        const notificationBell = screen.getByRole('button', {name: 'notification bell'});
        const notificationWrapper = notificationBell.parentElement;
        const headerFrame = notificationWrapper?.parentElement;
        const saveButton = screen.getByRole('button', {name: '변경사항 저장'});

        expect(notificationWrapper).toHaveClass('pointer-events-none', 'absolute', 'top-0', 'right-0', 'z-[1002]');
        expect(headerFrame).toHaveClass('relative', 'max-w-[480px]');
        expect(saveButton.parentElement).toHaveClass('max-w-[480px]');
    });

    it('renders the current ward identity in the editable form', () => {
        render(<WardInfoSettingsPage />);

        expect(screen.getByRole('heading', {name: '병동 설정'})).toBeInTheDocument();
        expect(screen.getByText('병동 코드')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '병동코드 ABC123 안내 보기'})).toBeInTheDocument();
        expect(screen.getByLabelText('병원명')).toHaveValue('듀팅병원');
        expect(screen.getByLabelText('병동명')).toHaveValue('중환자실');
        expect(screen.queryByText('현재 병동')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '관리자'})).not.toBeInTheDocument();
        expect(screen.getByText('ward admins panel')).toBeInTheDocument();

        const quitWardButton = screen.getByRole('button', {name: '병동 나가기'});
        const saveButton = screen.getByRole('button', {name: '변경사항 저장'});

        expect(quitWardButton).toBeInTheDocument();
        expect(quitWardButton.parentElement).toHaveClass('justify-end', 'px-1');
        expect(quitWardButton.compareDocumentPosition(saveButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(saveButton).toBeDisabled();
    });

    it('opens the ward code guide from the ward code badge', async () => {
        render(<WardInfoSettingsPage />);

        await userEvent.click(screen.getByRole('button', {name: '병동코드 ABC123 안내 보기'}));

        expect(screen.getByRole('dialog', {name: '소속 간호사에게 병동코드를 알려주세요'})).toBeInTheDocument();
        expect(screen.getByText('듀팅병원 중환자실 병동코드')).toBeInTheDocument();
    });

    it('saves changed ward identity through the ward edit API', async () => {
        mockEditWard.mockResolvedValue({
            ...ward,
            hospitalName: '새듀팅병원',
            name: '응급병동',
        });

        render(<WardInfoSettingsPage />);

        await userEvent.clear(screen.getByLabelText('병원명'));
        await userEvent.type(screen.getByLabelText('병원명'), '새듀팅병원');
        await userEvent.clear(screen.getByLabelText('병동명'));
        await userEvent.type(screen.getByLabelText('병동명'), '응급병동');
        await userEvent.click(screen.getByRole('button', {name: '변경사항 저장'}));

        await waitFor(() => {
            expect(mockEditWard).toHaveBeenCalledWith(1, {
                hospitalName: '새듀팅병원',
                name: '응급병동',
            });
        });
        expect(mockSetQueryData).toHaveBeenCalledWith(wardQueryKeys.id(1), {
            ...ward,
            hospitalName: '새듀팅병원',
            name: '응급병동',
        });
        expect(mockInvalidateQueries).toHaveBeenCalledWith({queryKey: wardQueryKeys.id(1)});
        expect(mockToastSuccess).toHaveBeenCalledWith('병동 정보를 저장했어요.');
    });

    it('calls the existing quit ward flow from the bottom action area', async () => {
        render(<WardInfoSettingsPage />);

        await userEvent.click(screen.getByRole('button', {name: '병동 나가기'}));

        expect(mockQuitWard).toHaveBeenCalledTimes(1);
    });
});
