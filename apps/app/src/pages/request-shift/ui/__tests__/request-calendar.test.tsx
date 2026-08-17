import {MemoryRouter, useLocation} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import RequestCalendar from '../request-calendar';

const mockUseRequestShift = vi.fn();
const translations: Record<string, string> = {
    'page.request.calendar.ariaLabel': '신청 근무 캘린더',
    'page.request.calendar.linkColumn': '연동',
    'page.request.calendar.nameColumn': '이름',
    'page.request.calendar.noNurseTitleSuffix': '에는 아직 간호사가 없어요',
    'page.request.calendar.noNurseDescription': '신청 근무를 확인하려면 먼저 근무자 관리에서 팀 간호사를 추가해 주세요.',
    'page.request.calendar.noNurseAction': '근무자 관리로 이동',
    'page.request.calendar.reorderAria': '{{name}} 순서 변경',
    'page.makeShift.calendar.name': '이름',
    'page.makeShift.calendar.requestStatusPin': '신청 근무',
};

vi.mock('@/features/request-shift', () => ({
    default: () => mockUseRequestShift(),
}));

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {
            wardId: 1,
        },
    }),
}));

vi.mock('@/entities/ui/useUIConfig/store', () => ({
    useUIConfigStore: (selector: (state: {separateWeekendColor: boolean}) => unknown) =>
        selector({
            separateWeekendColor: false,
        }),
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string, params?: Record<string, string | number>) => {
            const template = translations[key] ?? key;

            return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(params?.[token] ?? ''));
        },
    }),
}));

vi.mock('@/analytics', () => ({
    events: {
        requestPage: {
            acceptRequest: 'acceptRequest',
            calendar: {
                focusCell: 'focusCell',
            },
        },
    },
    sendEvent: vi.fn(),
}));

vi.mock('react-cool-onclickoutside', () => ({
    default: () => vi.fn(),
}));

vi.mock('../request-calendar/request-duty-request-panel', () => ({
    default: ({className}: {className?: string}) => (
        <aside data-testid="request-panel" className={className}>
            request-panel
        </aside>
    ),
}));

function LocationProbe() {
    const location = useLocation();

    return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderRequestCalendar(props?: Parameters<typeof RequestCalendar>[0]) {
    return render(
        <MemoryRouter initialEntries={['/request']}>
            <RequestCalendar {...props} />
            <LocationProbe />
        </MemoryRouter>,
    );
}

function createUseRequestShiftValue({
    hasNurses = false,
    hasRequest = false,
    requestAccepted = true,
    dayType = 'workday',
    focus = null,
    nurseName = 'Kim',
    divisionName,
}: {
    hasNurses?: boolean;
    hasRequest?: boolean;
    requestAccepted?: boolean | null;
    dayType?: 'workday' | 'saturday' | 'sunday' | 'holiday';
    focus?: {shiftNurseName: string; shiftNurseId: number; day: number} | null;
    nurseName?: string;
    divisionName?: string | null;
} = {}) {
    const nurse = {
        nurseId: 10,
        accountId: null,
        shiftTeamId: 3,
        wardId: 1,
        name: nurseName,
        phoneNum: null,
        isConnected: false,
        nurseShiftTypes: [],
        isWorker: true,
        isDutyManager: false,
        isWardManager: false,
        gender: '',
        employmentDate: '',
        memo: '',
        isDeleted: false,
        divisionNum: 1,
        priority: 100,
    };
    const nurses = hasNurses ? [nurse] : [];
    const dayShiftType = {
        wardShiftTypeId: 10,
        name: 'Day',
        shortName: 'D',
        startTime: '07:00',
        endTime: '15:00',
        color: '#4B7BEC',
        isDefault: true,
        isOff: false,
        isCounted: true,
        classification: 'DAY',
    };

    return {
        state: {
            year: 2026,
            month: 6,
            requestShift: {
                days: [{day: 1, dayType}],
                wardShiftTypes: hasRequest ? [dayShiftType] : [],
                divisionShiftNurses: hasNurses
                    ? [
                          [
                              {
                                  shiftNurse: {
                                      shiftNurseId: 20,
                                      nurseId: nurse.nurseId,
                                      name: nurse.name,
                                      carried: 0,
                                      isWorker: true,
                                      divisionNum: 1,
                                      priority: 100,
                                  },
                                  carry: 0,
                                  wardReqShiftList: [hasRequest ? dayShiftType.wardShiftTypeId : null],
                              },
                          ],
                      ]
                    : [],
            },
            dutyRequestList:
                hasNurses && hasRequest
                    ? [
                          {
                              wardReqShiftId: 1,
                              nurseId: nurse.nurseId,
                              nurseName: nurse.name,
                              date: 1,
                              requestDate: '2026-06-01',
                              wardShiftTypeId: dayShiftType.wardShiftTypeId,
                              wardShiftTypeShortName: dayShiftType.shortName,
                              wardShiftTypeColor: dayShiftType.color,
                              isRead: false,
                              isAccepted: requestAccepted,
                          },
                      ]
                    : [],
            dutyRequestStatus: 'success',
            updatingRequestId: null,
            focus,
            wardShiftTypeMap: hasRequest ? new Map([[dayShiftType.wardShiftTypeId, dayShiftType]]) : new Map(),
            currentShiftTeam: {
                shiftTeamId: 3,
                name: 'A팀',
                nurseCnt: nurses.length,
                nurses,
                divisions:
                    divisionName === undefined
                        ? undefined
                        : [{shiftTeamDivisionId: 1, divisionNum: 1, name: divisionName, displayOrder: 1}],
            },
            shiftTeams: [
                {
                    shiftTeamId: 3,
                    name: 'A팀',
                    nurseCnt: nurses.length,
                    nurses,
                    divisions:
                        divisionName === undefined
                            ? undefined
                            : [{shiftTeamDivisionId: 1, divisionNum: 1, name: divisionName, displayOrder: 1}],
                },
            ],
            editAvailability: {
                canEdit: true,
            },
        },
        actions: {
            changeFocus: vi.fn(),
            acceptRequest: vi.fn(),
            acceptRequests: vi.fn(),
            retry: vi.fn(),
        },
    };
}

describe('RequestCalendar', () => {
    beforeEach(() => {
        mockUseRequestShift.mockReset();
    });

    it('팀에 간호사가 없으면 안내와 근무자 관리 이동 버튼을 보여주고 패널 높이를 맞춘다', async () => {
        const user = userEvent.setup();

        mockUseRequestShift.mockReturnValue(createUseRequestShiftValue());

        renderRequestCalendar();

        expect(
            screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === 'A팀에는 아직 간호사가 없어요'),
        ).toBeInTheDocument();
        expect(screen.getByText('A팀')).toHaveClass('text-main-1');
        expect(screen.getByText('신청 근무를 확인하려면 먼저 근무자 관리에서 팀 간호사를 추가해 주세요.')).toBeInTheDocument();
        expect(document.getElementById('calendar')).toHaveClass('items-stretch');
        expect(screen.getByTestId('request-panel')).toHaveClass('h-full');

        await user.click(screen.getByRole('button', {name: /근무자 관리로 이동/}));

        expect(screen.getByTestId('location')).toHaveTextContent('/member?shiftTeamId=3');
    });

    it('신청근무표에도 근무 만들기 1단계와 같은 행 순서 핸들을 보여준다', () => {
        mockUseRequestShift.mockReturnValue(createUseRequestShiftValue({hasNurses: true}));

        renderRequestCalendar();

        const handle = screen.getByRole('button', {name: 'Kim 순서 변경'});
        const headerSpacer = document.querySelector('.make-shift-calendar__header-label--drag');

        expect(handle).toHaveClass('make-shift-calendar__row-drag-handle', 'text-gray-4', 'hover:bg-gray-7', 'hover:text-sub-2');
        expect(handle).toHaveClass('size-7', 'shrink-0', 'self-center', 'p-0', 'leading-none');
        expect(headerSpacer).toBeInTheDocument();
        expect(handle.querySelector('svg')).toBeInTheDocument();
    });

    it('행 순서 저장 중에도 핸들을 숨기지 않고 비활성 상태로 유지한다', () => {
        mockUseRequestShift.mockReturnValue(createUseRequestShiftValue({hasNurses: true}));

        renderRequestCalendar({canReorderRows: true, rowReorderDisabled: true, onRowDragEnd: vi.fn()});

        const handle = screen.getByRole('button', {name: 'Kim 순서 변경'});

        expect(handle).toBeDisabled();
        expect(handle).toHaveClass('make-shift-calendar__row-drag-handle', 'disabled:cursor-not-allowed');
    });

    it('신청근무 캘린더를 공용 simplified 캘린더 칼럼으로 렌더링한다', () => {
        mockUseRequestShift.mockReturnValue(createUseRequestShiftValue({hasNurses: true}));

        renderRequestCalendar();

        expect(screen.getByText('이름')).toBeInTheDocument();
        expect(screen.getByText('Kim')).toBeInTheDocument();
        expect(screen.queryByText('연동')).not.toBeInTheDocument();
        expect(screen.queryByText('숙련도')).not.toBeInTheDocument();
    });

    it('페이지를 내려도 이름과 날짜 헤더가 화면 상단에 고정되도록 렌더링한다', () => {
        mockUseRequestShift.mockReturnValue(createUseRequestShiftValue({hasNurses: true}));

        renderRequestCalendar();

        const header = document.querySelector<HTMLElement>('.make-shift-calendar__header');
        const calendarViewport = document.querySelector<HTMLElement>('.request-calendar__calendar-frame')?.parentElement;

        expect(header).toHaveAttribute('data-sticky-header', 'true');
        expect(header).toHaveClass('sticky', 'top-0', 'bg-white');
        expect(calendarViewport).toHaveClass('overflow-visible');
        expect(calendarViewport).not.toHaveClass('overflow-x-auto');
    });

    it('신청근무 캘린더에 그룹 구분선을 보여준다', () => {
        mockUseRequestShift.mockReturnValue(createUseRequestShiftValue({hasNurses: true, divisionName: '나이트킵'}));

        renderRequestCalendar();

        const header = document.querySelector<HTMLElement>('.make-shift-calendar__division-header');

        expect(header).toHaveTextContent('나이트킵');
        expect(header).toHaveTextContent('1');
        expect(header?.querySelector('svg')).toBeInTheDocument();
    });

    it('신청근무 행 이름 글자 크기를 근무표 만들기 화면 기준으로 맞춘다', () => {
        mockUseRequestShift.mockReturnValue(createUseRequestShiftValue({hasNurses: true}));

        renderRequestCalendar();

        expect(screen.getByText('Kim').closest('.make-shift-calendar__row-name')).toHaveClass('text-[clamp(12px,1.05vw,16px)]');
    });

    it('신청근무 행 이름은 글자 수로 미리 자르지 않고 넓어진 이름 열에 표시한다', () => {
        mockUseRequestShift.mockReturnValue(createUseRequestShiftValue({hasNurses: true, nurseName: '박서연지희'}));

        renderRequestCalendar();

        const nameCell = screen.getByText('박서연지희').closest<HTMLElement>('.make-shift-calendar__row-name');

        expect(nameCell).toBeInTheDocument();
        expect(screen.queryByText('박서연지…')).not.toBeInTheDocument();
    });

    it('간호사 행 사이에 작은 세로 여백을 둔다', () => {
        mockUseRequestShift.mockReturnValue(createUseRequestShiftValue({hasNurses: true}));

        renderRequestCalendar();

        const divisionCard = document.querySelector('.make-shift-calendar__division-card');

        expect(divisionCard).toHaveClass('gap-y-3');
    });

    it('신청 근무가 있는 셀의 근무유형 칩에 파란 핀을 표시한다', () => {
        mockUseRequestShift.mockReturnValue(createUseRequestShiftValue({hasNurses: true, hasRequest: true}));

        renderRequestCalendar();

        const requestPin = document.querySelector<HTMLElement>('[data-cell-status-pin="request"]');
        const requestCell = document.querySelector<HTMLElement>('[data-day-index="0"]');

        expect(requestPin).toBeInTheDocument();
        expect(requestPin).toHaveAttribute('title', '신청 근무');
        expect(screen.getByText('D')).toBeInTheDocument();
        expect(requestCell).not.toHaveAttribute('data-dimmed-request-cell');
        expect(requestCell?.querySelector('.make-shift-calendar__shift-badge')).not.toHaveClass('opacity-60');
    });

    it('캘린더 셀을 클릭하면 기존 focus 하이라이팅 상태를 요청한다', async () => {
        const user = userEvent.setup();
        const requestShiftValue = createUseRequestShiftValue({hasNurses: true, hasRequest: true});

        mockUseRequestShift.mockReturnValue(requestShiftValue);

        renderRequestCalendar();

        await user.click(screen.getByText('D'));

        expect(requestShiftValue.actions.changeFocus).toHaveBeenCalledWith({
            shiftNurseName: 'Kim',
            shiftNurseId: 20,
            day: 0,
        });
    });

    it('선택된 날짜 세로 컬럼과 간호사 이름을 하이라이팅한다', () => {
        mockUseRequestShift.mockReturnValue(
            createUseRequestShiftValue({
                hasNurses: true,
                hasRequest: true,
                focus: {
                    shiftNurseName: 'Kim',
                    shiftNurseId: 20,
                    day: 0,
                },
            }),
        );

        renderRequestCalendar();

        expect(screen.getByText('Kim').closest('.make-shift-calendar__row-name')).toHaveClass('text-main-1');
        expect(document.querySelector('[data-selection-layer="true"]')).toBeInTheDocument();
        expect(document.querySelector('[data-selection-column-layer="true"]')).toBeInTheDocument();
        expect(document.querySelector('[data-selection-division-column-layer="true"]')).toBeInTheDocument();
    });

    it.each([
        ['saturday', 'bg-blue/5'],
        ['sunday', 'bg-red/5'],
        ['holiday', 'bg-red/5'],
    ] as const)('%s 배경을 행 간격까지 이어서 표시한다', (dayType, expectedClass) => {
        mockUseRequestShift.mockReturnValue(createUseRequestShiftValue({hasNurses: true, dayType}));

        renderRequestCalendar();

        const backgroundLayer = document.querySelector('[data-division-day-background-layer="true"]');

        expect(backgroundLayer).toBeInTheDocument();
        expect(
            Array.from(backgroundLayer?.querySelectorAll('span') ?? []).some((element) => element.classList.contains(expectedClass)),
        ).toBe(true);
    });

    it.each([null, false] as const)('대기·거절 신청 근무는 옅은 색으로 표시하고 핀을 표시하지 않는다', (requestAccepted) => {
        mockUseRequestShift.mockReturnValue(
            createUseRequestShiftValue({
                hasNurses: true,
                hasRequest: true,
                requestAccepted,
            }),
        );

        renderRequestCalendar();

        const requestCell = document.querySelector<HTMLElement>('[data-day-index="0"]');

        expect(document.querySelector('[data-cell-status-pin="request"]')).not.toBeInTheDocument();
        expect(requestCell).toHaveAttribute('data-dimmed-request-cell', 'true');
        expect(requestCell?.querySelector('.make-shift-calendar__shift-badge')).toHaveClass('opacity-60');
        expect(screen.getByText('D')).toBeInTheDocument();
    });
});
