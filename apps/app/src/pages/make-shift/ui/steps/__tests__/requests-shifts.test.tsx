import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ANDROID_PLAY_STORE_URL_KO, IOS_APP_STORE_URL_KO} from '@/shared/config/invite';
import {act, fireEvent, render, screen} from '@/shared/util/test-utils';
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
    'page.request.emptyGuide.title': '간호사에게 듀팅 앱으로 신청근무를 받아보세요',
    'page.request.emptyGuide.description': '간호사가 앱에서 원하는 근무를 보내면 이곳에서 한 번에 확인할 수 있어요.',
    'page.request.emptyGuide.directEntry': '직접 정하려면 다음 단계에서 입력할 수 있어요.',
    'page.request.emptyGuide.close': '안내 닫기',
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

vi.mock('@/pages/request-shift/ui/request-calendar', () => ({
    default: () => <button type="button">신청근무 캘린더</button>,
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

    afterEach(() => {
        vi.useRealTimers();
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

    it('신청근무가 없으면 2초 뒤 앱 신청 안내를 보여준다', () => {
        vi.useFakeTimers();

        mockUseRequestShift.mockReturnValue({
            state: {
                requestShift: {days: [], wardShiftTypes: [], divisionShiftNurses: []},
                shiftStatus: 'success',
                shiftTeams: [{shiftTeamId: 10, name: 'A팀', nurses: []}],
                shiftTeamsStatus: 'success',
                bootstrapStatus: 'success',
                dutyRequestList: [],
                dutyRequestStatus: 'success',
            },
            actions: {
                retry: vi.fn(),
                createNextMonthShift: vi.fn(),
            },
        });

        render(<RequestsShifts />);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        act(() => vi.advanceTimersByTime(1_999));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        act(() => vi.advanceTimersByTime(1));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('간호사에게 듀팅 앱으로 신청근무를 받아보세요')).toBeInTheDocument();
        expect(screen.getByText('간호사가 앱에서 원하는 근무를 보내면 이곳에서 한 번에 확인할 수 있어요.')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'App Store'})).toHaveAttribute('href', IOS_APP_STORE_URL_KO);
        expect(screen.getByRole('link', {name: 'Google Play'})).toHaveAttribute('href', ANDROID_PLAY_STORE_URL_KO);
        expect(screen.getByTestId('make-request-calendar-content')).toHaveClass('blur-[3px]', 'opacity-65');

        fireEvent.click(screen.getByRole('button', {name: '안내 닫기'}));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('신청근무가 있으면 시간이 지나도 앱 신청 안내를 보여주지 않는다', () => {
        vi.useFakeTimers();

        mockUseRequestShift.mockReturnValue({
            state: {
                requestShift: {days: [], wardShiftTypes: [], divisionShiftNurses: []},
                shiftStatus: 'success',
                shiftTeams: [{shiftTeamId: 10, name: 'A팀', nurses: []}],
                shiftTeamsStatus: 'success',
                bootstrapStatus: 'success',
                dutyRequestList: [{wardReqShiftId: 1}],
                dutyRequestStatus: 'success',
            },
            actions: {
                retry: vi.fn(),
                createNextMonthShift: vi.fn(),
            },
        });

        render(<RequestsShifts />);

        act(() => vi.advanceTimersByTime(2_000));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByTestId('make-request-calendar-content')).not.toHaveClass('blur-[3px]', 'opacity-65');
    });
});
