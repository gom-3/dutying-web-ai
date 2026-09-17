import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {getNextRequestShiftDate} from '@/features/request-shift/model/request-shift';
import {useRequestShiftStore} from '@/features/request-shift/model/store';
import {ANDROID_PLAY_STORE_URL_KO, IOS_APP_STORE_URL_KO} from '@/shared/config/invite';
import {act, fireEvent, render, screen, userEvent} from '@/shared/util/test-utils';
import RequestShiftPage from '../index';

const mockUseRequestShift = vi.fn();
const translations: Record<string, string> = {
    'page.request.overview.loadingTitle': '신청 근무 화면을 준비하고 있어요',
    'page.request.overview.loadingDescription': '근무 팀과 신청 근무표를 순서대로 불러오고 있어요.',
    'page.request.overview.bootstrapLoadingTitle': '계정 정보를 확인하고 있어요',
    'page.request.overview.bootstrapLoadingDescription': '병동 정보를 확인한 뒤 신청 근무 화면을 준비하고 있어요.',
    'page.request.overview.shiftErrorTitle': '신청 근무표를 불러오지 못했어요',
    'page.request.overview.emptyTitle': '이번 달 신청 근무표가 아직 없어요',
    'page.request.overview.createNextMonth': '다음 달 신청 근무 작성하기',
    'page.request.emptyGuide.title': '간호사에게 듀팅 앱으로 신청근무를 받아보세요',
    'page.request.emptyGuide.description': '간호사가 앱에서 원하는 근무를 보내면 이곳에서 한 번에 확인할 수 있어요.',
    'page.request.emptyGuide.directEntry': '직접 정하려면 다음 단계에서 입력할 수 있어요.',
    'page.request.emptyGuide.requestPageDirectEntry':
        '신청근무를 직접 등록하려면 ‘근무표 만들기’ 4단계에서 원하는 근무를 고정할 수 있어요.',
    'page.request.emptyGuide.close': '안내 닫기',
    'page.state.retry': '다시 시도',
    'page.state.errorDescription': '잠시 후 다시 시도해 주세요. 문제가 계속되면 새로고침 후 다시 확인해 주세요.',
};

vi.mock('@/features/request-shift', () => ({
    default: (...args: unknown[]) => mockUseRequestShift(...args),
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string) => translations[key] ?? key,
    }),
}));

vi.mock('../ui/toolbar', () => ({
    default: () => <div>toolbar</div>,
}));

vi.mock('../ui/request-calendar', () => ({
    default: () => <div>request-calendar</div>,
}));

type TMockUseRequestShiftValue = {
    state: {
        readonly: boolean;
        bootstrapStatus: 'pending' | 'error' | 'success';
        editAvailability: {
            canEdit: boolean;
            status: 'editable' | 'lockedPast' | 'lockedFuture';
            validationMessage: string | null;
            badgeLabel: string;
            periodLabel: string;
            description: string;
        };
        year: number;
        month: number;
        requestShift: {shiftId: number} | null;
        shiftStatus: 'pending' | 'error' | 'success';
        shiftTeams: Array<{shiftTeamId: number; name: string}>;
        shiftTeamsStatus: 'pending' | 'error' | 'success';
        dutyRequestList: Array<{wardReqShiftId: number}>;
        dutyRequestStatus: 'pending' | 'error' | 'success';
        currentShiftTeam: {shiftTeamId: number} | null;
    };
    actions: {
        retry: ReturnType<typeof vi.fn>;
        createNextMonthShift: ReturnType<typeof vi.fn>;
    };
};

const createUseRequestShiftValue = (overrides?: {
    state?: Partial<TMockUseRequestShiftValue['state']>;
    actions?: Partial<TMockUseRequestShiftValue['actions']>;
}): TMockUseRequestShiftValue => {
    const baseValue = baseUseRequestShiftValue();

    return {
        ...baseValue,
        ...overrides,
        state: {
            ...baseValue.state,
            ...overrides?.state,
        },
        actions: {
            ...baseValue.actions,
            ...overrides?.actions,
        },
    };
};

function baseUseRequestShiftValue(): TMockUseRequestShiftValue {
    return {
        state: {
            readonly: true,
            bootstrapStatus: 'success',
            editAvailability: {
                canEdit: true,
                status: 'editable',
                validationMessage: null,
                badgeLabel: '수정 가능',
                periodLabel: '수정 가능 범위: 지난달부터 다음 달까지',
                description: '현재 달력 범위에서는 신청 근무를 수정할 수 있어요.',
            },
            year: 2026,
            month: 7,
            requestShift: {shiftId: 1},
            shiftStatus: 'success' as const,
            shiftTeams: [{shiftTeamId: 1, name: '중환자실 A팀'}],
            shiftTeamsStatus: 'success' as const,
            dutyRequestList: [{wardReqShiftId: 1}],
            dutyRequestStatus: 'success' as const,
            currentShiftTeam: {shiftTeamId: 1},
        },
        actions: {
            retry: vi.fn(),
            createNextMonthShift: vi.fn(),
        },
    };
}

describe('RequestShiftPage', () => {
    beforeEach(() => {
        localStorage.removeItem('useRequestShiftStore');
        useRequestShiftStore.getState().resetState();
        mockUseRequestShift.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('페이지 진입 시 저장된 연월 대신 다음 달을 선택한다', () => {
        useRequestShiftStore.setState({year: 2024, month: 2});
        mockUseRequestShift.mockReturnValue(createUseRequestShiftValue());

        render(<RequestShiftPage />);

        const {year, month} = getNextRequestShiftDate();

        expect(useRequestShiftStore.getState()).toMatchObject({year, month});
    });

    it('근무 팀을 불러오는 중이면 초기 로딩 상태를 보여준다', () => {
        mockUseRequestShift.mockReturnValue(
            createUseRequestShiftValue({
                state: {
                    shiftTeamsStatus: 'pending',
                },
            }),
        );

        render(<RequestShiftPage />);

        expect(screen.getByRole('status', {name: '신청 근무 화면을 준비하고 있어요'})).toHaveAttribute(
            'data-testid',
            'request-calendar-skeleton',
        );
        expect(screen.queryByText('근무 팀과 신청 근무표를 순서대로 불러오고 있어요.')).not.toBeInTheDocument();
    });

    it('계정 정보를 확인하는 중이면 부트스트랩 로딩 상태를 보여준다', () => {
        mockUseRequestShift.mockReturnValue(
            createUseRequestShiftValue({
                state: {
                    bootstrapStatus: 'pending',
                },
            }),
        );

        render(<RequestShiftPage />);

        expect(screen.getByRole('status', {name: '계정 정보를 확인하고 있어요'})).toHaveAttribute(
            'data-testid',
            'request-calendar-skeleton',
        );
        expect(screen.queryByText('병동 정보를 확인한 뒤 신청 근무 화면을 준비하고 있어요.')).not.toBeInTheDocument();
    });

    it('신청 근무표 조회 실패 시 재시도를 노출하고 실행한다', async () => {
        const retry = vi.fn();
        const user = userEvent.setup();

        mockUseRequestShift.mockReturnValue(
            createUseRequestShiftValue({
                state: {
                    shiftStatus: 'error',
                },
                actions: {
                    retry,
                },
            }),
        );

        render(<RequestShiftPage />);

        expect(screen.getByText('신청 근무표를 불러오지 못했어요')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '다시 시도'}));

        expect(retry).toHaveBeenCalledTimes(1);
    });

    it('신청 근무표가 없으면 다음 달 작성 액션을 노출한다', async () => {
        const createNextMonthShift = vi.fn();
        const user = userEvent.setup();

        mockUseRequestShift.mockReturnValue(
            createUseRequestShiftValue({
                state: {
                    requestShift: null,
                },
                actions: {
                    createNextMonthShift,
                },
            }),
        );

        render(<RequestShiftPage />);

        expect(screen.getByText('이번 달 신청 근무표가 아직 없어요')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '다음 달 신청 근무 작성하기'}));

        expect(createNextMonthShift).toHaveBeenCalledTimes(1);
    });

    it('모든 데이터가 준비되면 캘린더를 보여준다', () => {
        mockUseRequestShift.mockReturnValue(createUseRequestShiftValue());

        render(<RequestShiftPage />);

        expect(screen.getByText('toolbar')).toBeInTheDocument();
        expect(screen.getByText('request-calendar')).toBeInTheDocument();
    });

    it('신청근무가 없으면 1초 뒤 캘린더 위에 앱 신청 안내를 보여준다', () => {
        vi.useFakeTimers();
        mockUseRequestShift.mockReturnValue(
            createUseRequestShiftValue({
                state: {
                    dutyRequestList: [],
                },
            }),
        );

        render(<RequestShiftPage />);

        act(() => vi.advanceTimersByTime(999));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        act(() => vi.advanceTimersByTime(1));

        const dialog = screen.getByRole('dialog');
        const title = screen.getByRole('heading', {name: '간호사에게 듀팅 앱으로 신청근무를 받아보세요'});
        const description = screen.getByText('간호사가 앱에서 원하는 근무를 보내면 이곳에서 한 번에 확인할 수 있어요.');

        expect(dialog).toHaveClass('overflow-y-auto');
        expect(title).toHaveClass('whitespace-normal', 'break-normal', '[overflow-wrap:anywhere]', '[text-wrap:balance]');
        expect(title).not.toHaveClass('break-keep', 'sm:whitespace-nowrap');
        expect(description).toHaveClass('[overflow-wrap:anywhere]', '[text-wrap:pretty]');
        expect(description.parentElement).toHaveClass('min-w-0', 'break-normal', '[overflow-wrap:anywhere]');
        expect(screen.getByText('신청근무를 직접 등록하려면 ‘근무표 만들기’ 4단계에서 원하는 근무를 고정할 수 있어요.')).toHaveClass(
            '[overflow-wrap:anywhere]',
            '[text-wrap:pretty]',
        );
        expect(screen.getByTestId('request-calendar-content')).toHaveClass('blur-[3px]', 'opacity-65');

        const appStoreLink = screen.getByRole('link', {name: 'App Store'});

        expect(appStoreLink).toHaveAttribute('href', IOS_APP_STORE_URL_KO);
        expect(appStoreLink.parentElement).toHaveClass('flex-wrap');
        expect(screen.getByRole('link', {name: 'Google Play'})).toHaveAttribute('href', ANDROID_PLAY_STORE_URL_KO);

        fireEvent.click(screen.getByRole('button', {name: '안내 닫기'}));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
