import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, render, screen, userEvent, waitFor, within} from '@/shared/util/test-utils';
import RequestCalendar from '../request-calendar';

const mockUseRequestShift = vi.fn();
const apiMocks = vi.hoisted(() => ({
    updateNurseOrder: vi.fn(),
}));

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

vi.mock('@/shared/api', () => ({
    NurseAPI: {
        updateNurseOrder: apiMocks.updateNurseOrder,
    },
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string, params?: Record<string, string | number>) => {
            if (key === 'page.request.calendar.reorderAria') return `${params?.name ?? ''} 순서 변경`;

            if (key === 'feature.editShiftTeam.moveNurseFailed') return '순서 변경에 실패했습니다';

            return key;
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
    default: () => <aside data-testid="request-panel">request-panel</aside>,
}));

vi.mock('@/pages/make-shift/ui/steps/shared/make-shift-calendar', () => ({
    MakeShiftCalendar: ({
        shift,
        rowReorderDisabled,
        onRowDragEnd,
    }: {
        shift: {
            divisionShiftNurses: Array<
                Array<{
                    shiftNurse: {
                        shiftNurseId: number;
                        name: string;
                        isWorker: boolean;
                    };
                }>
            >;
        };
        rowReorderDisabled?: boolean;
        onRowDragEnd?: (result: {
            draggableId: string;
            type: string;
            source: {droppableId: string; index: number};
            destination: {droppableId: string; index: number};
            reason: string;
            mode: string;
            combine: null;
        }) => void;
    }) => (
        <div>
            <button
                type="button"
                data-testid="move-first-row"
                disabled={rowReorderDisabled}
                onClick={() =>
                    onRowDragEnd?.({
                        draggableId: '20',
                        type: 'DEFAULT',
                        source: {droppableId: '1', index: 0},
                        destination: {droppableId: '1', index: 1},
                        reason: 'DROP',
                        mode: 'FLUID',
                        combine: null,
                    })
                }
            >
                move
            </button>
            <ol data-testid="row-order">
                {shift.divisionShiftNurses
                    .flat()
                    .filter((row) => row.shiftNurse.isWorker)
                    .map((row) => (
                        <li data-testid="row-name" key={row.shiftNurse.shiftNurseId}>
                            {row.shiftNurse.name}
                        </li>
                    ))}
            </ol>
        </div>
    ),
}));

function createNurse(nurseId: number, name: string, priority: number) {
    return {
        nurseId,
        accountId: null,
        shiftTeamId: 3,
        wardId: 1,
        name,
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
        priority,
    };
}

function createUseRequestShiftValue() {
    const kim = createNurse(10, 'Kim', 100);
    const lee = createNurse(11, 'Lee', 200);
    const nurses = [kim, lee];

    return {
        state: {
            year: 2026,
            month: 6,
            requestShift: {
                days: [{day: 1, dayType: 'workday'}],
                wardShiftTypes: [],
                divisionShiftNurses: [
                    [
                        {
                            shiftNurse: {
                                shiftNurseId: 20,
                                nurseId: kim.nurseId,
                                name: kim.name,
                                carried: 0,
                                isWorker: true,
                                divisionNum: 1,
                                priority: 100,
                            },
                            carry: 0,
                            wardReqShiftList: [null],
                        },
                        {
                            shiftNurse: {
                                shiftNurseId: 21,
                                nurseId: lee.nurseId,
                                name: lee.name,
                                carried: 0,
                                isWorker: true,
                                divisionNum: 1,
                                priority: 200,
                            },
                            carry: 0,
                            wardReqShiftList: [null],
                        },
                    ],
                ],
            },
            dutyRequestList: [],
            dutyRequestStatus: 'success',
            updatingRequestId: null,
            focus: null,
            wardShiftTypeMap: new Map(),
            currentShiftTeam: {
                shiftTeamId: 3,
                name: 'A팀',
                nurseCnt: nurses.length,
                nurses,
            },
            shiftTeams: [
                {
                    shiftTeamId: 3,
                    name: 'A팀',
                    nurseCnt: nurses.length,
                    nurses,
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

function getRowNames() {
    return within(screen.getByTestId('row-order'))
        .getAllByTestId('row-name')
        .map((row) => row.textContent);
}

describe('RequestCalendar reorder', () => {
    beforeEach(() => {
        mockUseRequestShift.mockReset();
        apiMocks.updateNurseOrder.mockReset();
    });

    it('드롭 직후 저장이 끝나기 전에도 변경된 행 순서를 유지하고 핸들을 비활성화하지 않는다', async () => {
        const user = userEvent.setup();

        let resolveUpdate: (() => void) | undefined;

        apiMocks.updateNurseOrder.mockReturnValue(
            new Promise<void>((resolve) => {
                resolveUpdate = resolve;
            }),
        );
        mockUseRequestShift.mockReturnValue(createUseRequestShiftValue());

        render(
            <MemoryRouter initialEntries={['/request']}>
                <RequestCalendar />
            </MemoryRouter>,
        );

        expect(getRowNames()).toEqual(['Kim', 'Lee']);

        await user.click(screen.getByTestId('move-first-row'));

        await waitFor(() => expect(getRowNames()).toEqual(['Lee', 'Kim']));
        expect(screen.getByTestId('move-first-row')).not.toBeDisabled();
        expect(apiMocks.updateNurseOrder).toHaveBeenCalledWith(10, 3, 3, 1, 200, 2224, '2026-06');

        await act(async () => {
            resolveUpdate?.();
            await Promise.resolve();
        });
    });
});
