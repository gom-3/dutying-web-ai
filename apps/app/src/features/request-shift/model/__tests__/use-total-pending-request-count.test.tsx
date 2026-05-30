import {beforeEach, describe, expect, it, vi} from 'vitest';
import {type TRequestShift} from '@/entities/shift';
import {type TShiftTeam} from '@/entities/ward';
import {wardQueryKeys} from '@/entities/ward/model/queries';
import {renderHook} from '@/shared/util/test-utils';
import {useRequestShiftStore} from '../store';
import {useTotalPendingRequestCount} from '../use-total-pending-request-count';

const {mockUseQueries, mockUseQuery, mockWardId} = vi.hoisted(() => ({
    mockUseQueries: vi.fn(),
    mockUseQuery: vi.fn(),
    mockWardId: {value: 1 as number | null},
}));

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@tanstack/react-query');

    return {
        ...actual,
        useQueries: mockUseQueries,
        useQuery: mockUseQuery,
    };
});

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {
            wardId: mockWardId.value,
        },
    }),
}));

const createShiftTeam = (shiftTeamId: number): TShiftTeam => ({
    shiftTeamId,
    name: `${shiftTeamId}-team`,
    nurseCnt: 0,
    nurses: [],
});
const requestShift: TRequestShift = {
    days: [
        {day: 3, dayType: 'workday'},
        {day: 7, dayType: 'workday'},
        {day: 12, dayType: 'workday'},
        {day: 18, dayType: 'workday'},
        {day: 22, dayType: 'workday'},
    ],
    wardShiftTypes: [
        {
            wardShiftTypeId: 1,
            name: 'Day',
            shortName: 'D',
            startTime: '07:00',
            endTime: '15:00',
            color: '#7457FF',
            isDefault: true,
            isOff: false,
            isCounted: true,
            classification: 'DAY',
        },
        {
            wardShiftTypeId: 2,
            name: 'Off',
            shortName: 'O',
            startTime: '',
            endTime: '',
            color: '#E97A84',
            isDefault: false,
            isOff: true,
            isCounted: false,
            classification: 'OFF',
        },
    ],
    divisionShiftNurses: [
        [
            {
                shiftNurse: {
                    shiftNurseId: 100,
                    name: 'Kim',
                    carried: 0,
                    divisionNum: 1,
                    priority: 1,
                    isWorker: true,
                    nurseId: 10,
                },
                carry: 0,
                wardReqShiftList: [],
            },
            {
                shiftNurse: {
                    shiftNurseId: 200,
                    name: 'Lee',
                    carried: 0,
                    divisionNum: 1,
                    priority: 2,
                    isWorker: true,
                    nurseId: 20,
                },
                carry: 0,
                wardReqShiftList: [],
            },
        ],
    ],
};

describe('useTotalPendingRequestCount', () => {
    beforeEach(() => {
        mockWardId.value = 1;
        mockUseQuery.mockReset();
        mockUseQueries.mockReset();
        useRequestShiftStore.getState().resetState();
        useRequestShiftStore.setState({year: 2026, month: 6, currentShiftTeamId: null});
    });

    it('fetches shift teams itself and sums pending request counts for the navigation badge', () => {
        mockUseQuery.mockReturnValue({
            data: [createShiftTeam(10), createShiftTeam(20)],
        });
        mockUseQueries.mockReturnValue([{data: 2}, {data: 1}]);

        const {result} = renderHook(() => useTotalPendingRequestCount(undefined));

        expect(result.current).toBe(3);
        expect(mockUseQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                enabled: true,
                placeholderData: undefined,
            }),
        );
        expect(mockUseQueries).toHaveBeenCalledWith({
            queries: [
                expect.objectContaining({
                    queryKey: wardQueryKeys.requestList(1, 10, 2026, 6),
                    enabled: true,
                }),
                expect.objectContaining({
                    queryKey: wardQueryKeys.requestList(1, 20, 2026, 6),
                    enabled: true,
                }),
            ],
        });
    });

    it('includes frontend mock pending requests from the current request panel team', () => {
        useRequestShiftStore.setState({currentShiftTeamId: 10});
        mockUseQuery
            .mockReturnValueOnce({
                data: [createShiftTeam(10)],
            })
            .mockReturnValueOnce({
                data: [],
            })
            .mockReturnValueOnce({
                data: requestShift,
            });
        mockUseQueries.mockReturnValue([{data: 0}]);

        const {result} = renderHook(() => useTotalPendingRequestCount(undefined));

        expect(result.current).toBe(8);
    });
});
