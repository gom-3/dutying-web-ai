import {useQuery} from '@tanstack/react-query';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent, within} from '@/shared/util/test-utils';
import {ConfirmedShifts} from '../confirmed-shifts';

const editConfirmedMock = vi.fn();

type TMakeShiftStoreState = {
    year: number;
    month: number;
    shiftTeams: {shiftTeamId: number; name: string}[];
    currentShiftTeamId: number | null;
    confirmedShiftSnapshot: null;
};

const makeShiftStoreState: TMakeShiftStoreState = {
    year: 2026,
    month: 7,
    shiftTeams: [{shiftTeamId: 10, name: 'A팀'}],
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

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string, values?: Record<string, string | number>) => {
            const translations: Record<string, string> = {
                'page.makeShift.confirmedShifts.title': `${values?.teamName}의 ${values?.month}월 근무표예요`,
                'page.makeShift.confirmedShifts.hint': '병동과 연동한 간호사는 앱에서 확정 근무표를 바로 볼 수 있어요!',
                'page.makeShift.confirmedShifts.wardCodeGuideAction': '병동코드 안내 보기',
                'page.makeShift.confirmedShifts.imageAction': '이미지 다운로드',
                'page.makeShift.confirmedShifts.imageActionLoading': '이미지 다운로드 중',
                'page.makeShift.confirmedShifts.editAction': '수정하기',
                'page.makeShift.confirmedShifts.empty': '확정된 근무표가 아직 없어요',
                'page.makeShift.confirmedShifts.fallbackTeamName': '선택한 팀',
                'page.state.emptyDescription': '화면 안내에 따라 진행해 주세요.',
            };

            return translations[key] ?? key;
        },
    }),
}));

vi.mock('../../../model/make-shift-store', () => ({
    useMakeShiftStore: (selector: (state: TMakeShiftStoreState) => unknown) => selector(makeShiftStoreState),
}));

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
});
