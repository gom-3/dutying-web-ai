import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen} from '@/shared/util/test-utils';
import type * as MakeShiftStoreModule from '../../../model/make-shift-store';
import {RequestsShifts} from '../requests-shifts';

const mockUseRequestShift = vi.fn();
const editUseCase = {
    prev: vi.fn(),
    next: vi.fn(),
};
const requestSetState = vi.fn();
const requestSetWardContext = vi.fn();
const makeShiftStoreState = {
    phase: 'stepping',
    currentStep: 3,
    maxReachedStep: 3,
    wardId: 1,
    year: 2026,
    month: 7,
    shiftTeams: [{shiftTeamId: 10, name: 'A팀', nurses: []}],
    shiftTeamsStatus: 'success',
    currentShiftTeamId: 10,
    workerConfirmationStatus: 'success',
    workerConfirmationCount: 1,
};
const translations: Record<string, string> = {
    'page.makeShift.requests.title': '신청 근무 확인',
    'page.makeShift.requests.descriptionLine': '신청 근무를 확인해요',
    'page.makeShift.navigation.previous': '이전',
    'page.makeShift.navigation.next': '다음',
    'page.makeShift.navigation.moving': '이동 중',
    'page.request.overview.bootstrapLoadingTitle': '신청 근무 화면을 준비하고 있어요',
    'page.request.overview.bootstrapLoadingDescription': '병동 정보를 확인한 뒤 신청 근무 화면을 준비하고 있어요.',
    'page.request.overview.loadingTitle': '신청 근무 화면을 준비하고 있어요',
    'page.request.overview.loadingDescription': '근무 팀과 신청 근무표를 순서대로 불러오고 있어요.',
    'page.request.overview.shiftLoadingTitle': '신청 근무표를 불러오고 있어요',
    'page.request.overview.shiftLoadingDescription': '신청 근무표 데이터를 확인하고 있어요.',
};

vi.mock('@/features/request-shift', () => ({
    default: (...args: unknown[]) => mockUseRequestShift(...args),
}));

vi.mock('@/features/request-shift/model/store', () => ({
    useRequestShiftStore: (
        selector: (state: {setState: typeof requestSetState; setWardContext: typeof requestSetWardContext}) => unknown,
    ) =>
        selector({
            setState: requestSetState,
            setWardContext: requestSetWardContext,
        }),
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string) => translations[key] ?? key,
    }),
}));

vi.mock('../../../model/make-shift-store', async (importOriginal) => {
    const actual = await importOriginal<typeof MakeShiftStoreModule>();

    return {
        ...actual,
        useMakeShiftStore: (selector: (state: typeof makeShiftStoreState) => unknown) => selector(makeShiftStoreState),
    };
});

vi.mock('../../../model/make-shift-use-case', () => ({
    useMakeShiftUseCase: () => editUseCase,
}));

describe('RequestsShifts', () => {
    beforeEach(() => {
        mockUseRequestShift.mockReset();
        editUseCase.prev.mockReset();
        editUseCase.next.mockReset();
        requestSetState.mockReset();
        requestSetWardContext.mockReset();
    });

    it('/make 신청근무 로딩 중 캘린더 스켈레톤을 보여준다', () => {
        mockUseRequestShift.mockReturnValue({
            state: {
                requestShift: null,
                shiftStatus: 'success',
                shiftTeams: [],
                shiftTeamsStatus: 'pending',
                bootstrapStatus: 'success',
            },
            actions: {
                retry: vi.fn(),
                createNextMonthShift: vi.fn(),
            },
        });

        render(<RequestsShifts />);

        expect(screen.getByTestId('request-calendar-skeleton')).toBeInTheDocument();
        expect(screen.queryByText('근무 팀과 신청 근무표를 순서대로 불러오고 있어요.')).not.toBeInTheDocument();
    });
});
