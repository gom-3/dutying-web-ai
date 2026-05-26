import {MemoryRouter, useLocation} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import RequestCalendar from '../request-calendar';

const mockUseRequestShift = vi.fn();
const translations: Record<string, string> = {
    'page.request.calendar.noNurseTitleSuffix': '에는 아직 간호사가 없어요',
    'page.request.calendar.noNurseDescription': '신청 근무를 확인하려면 먼저 근무자 관리에서 팀 간호사를 추가해 주세요.',
    'page.request.calendar.noNurseAction': '근무자 관리로 이동',
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

vi.mock('@/features/ward-skill/model/skill-level', () => ({
    getWardSkillSettings: () => ({}),
    resolveWardSkillLevels: () => ({
        config: {
            enabled: false,
            levels: [],
        },
        levelsByNurseId: {},
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

function renderRequestCalendar() {
    return render(
        <MemoryRouter initialEntries={['/request']}>
            <RequestCalendar />
            <LocationProbe />
        </MemoryRouter>,
    );
}

function createUseRequestShiftValue() {
    return {
        state: {
            year: 2026,
            month: 6,
            requestShift: {
                days: [{day: 1, dayType: 'workday'}],
                wardShiftTypes: [],
                divisionShiftNurses: [],
            },
            dutyRequestList: [],
            dutyRequestStatus: 'success',
            updatingRequestId: null,
            focus: null,
            wardShiftTypeMap: new Map(),
            currentShiftTeam: {
                shiftTeamId: 3,
                name: 'A팀',
                nurseCnt: 0,
                nurses: [],
            },
            shiftTeams: [
                {
                    shiftTeamId: 3,
                    name: 'A팀',
                    nurseCnt: 0,
                    nurses: [],
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
});
