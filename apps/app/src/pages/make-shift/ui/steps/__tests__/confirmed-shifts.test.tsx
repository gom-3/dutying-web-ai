import {useQuery} from '@tanstack/react-query';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type * as I18nModule from '@/i18n';
import {render, screen, userEvent, within} from '@/shared/util/test-utils';
import type * as MakeShiftStoreModule from '../../../model/make-shift-store';
import {ConfirmedShifts} from '../confirmed-shifts';

const editConfirmedMock = vi.fn();

type TMakeShiftStoreState = {
    wardId: number;
    year: number;
    month: number;
    shiftTeams: {shiftTeamId: number; name: string}[];
    shiftTeamsStatus: 'success';
    currentShiftTeamId: number | null;
    confirmedShiftSnapshot: null;
};

const makeShiftStoreState: TMakeShiftStoreState = {
    wardId: 1,
    year: 2026,
    month: 7,
    shiftTeams: [{shiftTeamId: 10, name: 'A팀'}],
    shiftTeamsStatus: 'success',
    currentShiftTeamId: 10,
    confirmedShiftSnapshot: null,
};

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query');

    return {
        ...actual,
        useQuery: vi.fn(),
    };
});

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {
            wardId: 1,
        },
    }),
}));

vi.mock('@/features/shift-editor', () => ({
    shiftToDoc: vi.fn(),
    useShiftImageExport: () => ({
        isExporting: false,
        downloadImage: vi.fn(),
    }),
}));

vi.mock('@/shared/hook/use-typed-translation', async () => {
    const {default: i18n} = await vi.importActual<typeof I18nModule>('@/i18n');

    return {
        useTypedTranslation: () => ({
            t: (key: string, values?: Record<string, string | number>) => i18n.t(key, values),
        }),
    };
});

vi.mock('../../../model/make-shift-store', async (importOriginal) => {
    const actual = await importOriginal<typeof MakeShiftStoreModule>();

    return {
        ...actual,
        useMakeShiftStore: (selector: (state: TMakeShiftStoreState) => unknown) => selector(makeShiftStoreState),
    };
});

vi.mock('../../../model/make-shift-use-case', () => ({
    useMakeShiftUseCase: () => ({
        editConfirmed: editConfirmedMock,
    }),
}));

const mockedUseQuery = vi.mocked(useQuery);

describe('ConfirmedShifts', () => {
    beforeEach(() => {
        editConfirmedMock.mockReset();
        mockedUseQuery.mockImplementation((options: {queryKey?: readonly unknown[]}) => {
            const key = options.queryKey ?? [];

            if (key.includes('id')) {
                return {
                    data: {
                        hospitalName: '듀팅병원',
                        name: '중환자실',
                        code: 'ABC123',
                    },
                    isLoading: false,
                    isError: false,
                    refetch: vi.fn(),
                } as unknown as ReturnType<typeof useQuery>;
            }

            return {
                data: null,
                isLoading: false,
                isError: false,
                refetch: vi.fn(),
            } as unknown as ReturnType<typeof useQuery>;
        });
    });

    it('병동코드 안내 아이콘을 클릭하면 병동코드 모달을 연다', async () => {
        render(<ConfirmedShifts />);

        expect(screen.getByText('병동과 연동한 간호사는 앱에서 확정 근무표를 바로 볼 수 있어요!')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: '병동코드 안내 보기'}));

        const dialog = screen.getByRole('dialog', {name: '소속 간호사에게 병동코드를 알려주세요'});

        expect(within(dialog).getByText('듀팅병원 중환자실 병동코드')).toBeInTheDocument();
        expect(within(dialog).getByText('ABC123')).toBeInTheDocument();
    });

    it('확정 근무표를 불러오는 동안 캘린더 스켈레톤을 보여준다', () => {
        mockedUseQuery.mockImplementation((options: {queryKey?: readonly unknown[]}) => {
            const key = options.queryKey ?? [];

            if (key.includes('id')) {
                return {
                    data: {
                        hospitalName: '듀팅병원',
                        name: '중환자실',
                        code: 'ABC123',
                    },
                    isLoading: false,
                    isError: false,
                    refetch: vi.fn(),
                } as unknown as ReturnType<typeof useQuery>;
            }

            return {
                data: null,
                isLoading: true,
                isError: false,
                refetch: vi.fn(),
            } as unknown as ReturnType<typeof useQuery>;
        });

        render(<ConfirmedShifts />);

        expect(screen.getByText('병동과 연동한 간호사는 앱에서 확정 근무표를 바로 볼 수 있어요!')).toBeInTheDocument();
        expect(screen.getByRole('status', {name: '확정 근무표를 불러오는 중이에요'})).toHaveAttribute(
            'data-testid',
            'make-shift-calendar-skeleton',
        );
        expect(screen.queryByText('잠시만 기다려 주세요.')).not.toBeInTheDocument();
    });
});
