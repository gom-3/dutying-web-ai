import {beforeEach, describe, expect, it, vi} from 'vitest';
import {wardQueryKeys} from '@/entities/ward';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import WardInfoSettingsPage from '..';

const {mockEditWard, mockInvalidateQueries, mockSetQueryData, mockToastSuccess, mockToastError, mockUseQuery} = vi.hoisted(() => ({
    mockEditWard: vi.fn(),
    mockInvalidateQueries: vi.fn(),
    mockSetQueryData: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockUseQuery: vi.fn(),
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
        state: {
            wardId: 1,
        },
    }),
}));

vi.mock('@/shared/api', () => ({
    WardAPI: {
        editWard: mockEditWard,
    },
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
        mockUseQuery.mockReset();
        mockUseQuery.mockReturnValue({
            data: ward,
            isPending: false,
            isError: false,
            refetch: vi.fn(),
        });
    });

    it('renders the current ward identity in the editable form', () => {
        render(<WardInfoSettingsPage />);

        expect(screen.getByRole('heading', {name: '병동 설정'})).toBeInTheDocument();
        expect(screen.getByLabelText('병원명')).toHaveValue('듀팅병원');
        expect(screen.getByLabelText('병동명')).toHaveValue('중환자실');
        expect(screen.queryByText('현재 병동')).not.toBeInTheDocument();
        expect(screen.queryByText('병동 코드')).not.toBeInTheDocument();
        expect(screen.queryByText('기본 정보')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '변경사항 저장'})).toBeDisabled();
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
});
