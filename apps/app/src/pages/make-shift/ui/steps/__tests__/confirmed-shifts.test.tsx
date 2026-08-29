import {useQuery} from '@tanstack/react-query';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {TShift} from '@/entities';
import {shiftToDoc, type TDutyDoc} from '@/features/shift-editor';
import type * as I18nModule from '@/i18n';
import {render, screen, userEvent, within} from '@/shared/util/test-utils';
import type * as MakeShiftStoreModule from '../../../model/make-shift-store';
import {ConfirmedShifts} from '../confirmed-shifts';

const editConfirmedMock = vi.fn();
const confirmedCalendarMock = vi.hoisted(() => ({
    props: null as {
        showDivisionHeaders?: boolean;
        divisionLabelByNum?: ReadonlyMap<number, string | null | undefined>;
    } | null,
}));

type TMakeShiftStoreState = {
    wardId: number;
    year: number;
    month: number;
    shiftTeams: {
        shiftTeamId: number;
        name: string;
        divisions?: {divisionNum: number; name: string}[];
    }[];
    shiftTeamsStatus: 'success';
    currentShiftTeamId: number | null;
    confirmedShiftSnapshot: null;
};

const makeShiftStoreState: TMakeShiftStoreState = {
    wardId: 1,
    year: 2026,
    month: 7,
    shiftTeams: [
        {
            shiftTeamId: 10,
            name: 'A팀',
            divisions: [{divisionNum: 1, name: '나이트 전담'}],
        },
    ],
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

vi.mock('../shared/make-shift-calendar', () => ({
    MakeShiftCalendar: (props: {showDivisionHeaders?: boolean; divisionLabelByNum?: ReadonlyMap<number, string | null | undefined>}) => {
        confirmedCalendarMock.props = props;

        return <div data-testid="confirmed-calendar" />;
    },
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
        confirmedCalendarMock.props = null;
        vi.mocked(shiftToDoc).mockReset();
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

    it('확정 근무표에도 그룹명과 그룹 구분선을 표시한다', () => {
        const confirmedShift = {
            lastDays: [],
            days: [],
            wardShiftTypes: [],
            divisionShiftNurses: [
                [
                    {
                        shiftNurse: {
                            shiftNurseId: 100,
                            nurseId: 200,
                            name: '김듀티',
                            divisionNum: 1,
                            priority: 0,
                            isWorker: true,
                        },
                        lastWardShiftList: [],
                        lastWardReqShiftList: [],
                        wardShiftList: [],
                        wardReqShiftList: [],
                    },
                ],
            ],
        } as unknown as TShift;
        const confirmedDoc = {
            columns: [],
            rows: [{workerId: '100', lastCells: [], cells: []}],
            workerMeta: {'100': {name: '김듀티', nurseId: 200}},
            fixedCells: {},
            requestCells: {},
        } as TDutyDoc;

        vi.mocked(shiftToDoc).mockReturnValue(confirmedDoc);
        mockedUseQuery.mockImplementation((options: {queryKey?: readonly unknown[]}) => {
            const key = options.queryKey ?? [];

            return {
                data: key.includes('id') ? {hospitalName: '듀팅병원', name: '중환자실', code: 'ABC123'} : confirmedShift,
                isLoading: false,
                isError: false,
                refetch: vi.fn(),
            } as unknown as ReturnType<typeof useQuery>;
        });

        render(<ConfirmedShifts />);

        expect(screen.getByTestId('confirmed-calendar')).toBeInTheDocument();
        expect(confirmedCalendarMock.props?.showDivisionHeaders).toBe(true);
        expect(confirmedCalendarMock.props?.divisionLabelByNum?.get(1)).toBe('나이트 전담');
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
