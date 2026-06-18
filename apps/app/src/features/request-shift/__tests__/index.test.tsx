import {useQueries, useQuery, useQueryClient} from '@tanstack/react-query';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {renderHook} from '@/shared/util/test-utils';
import useRequestShift from '../index';
import {useRequestShiftStore} from '../model/store';

const {authState, queryState} = vi.hoisted(() => ({
    authState: {
        wardId: 409 as number | null,
        isAuth: true,
        _loaded: true,
        accountMeStatus: 'success',
    },
    queryState: {
        shiftTeams: [] as Array<{shiftTeamId: number; name: string}>,
        shiftTeamsStatus: 'success' as 'pending' | 'success' | 'error',
    },
}));

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: authState,
        actions: {
            handleGetAccountMe: vi.fn(),
        },
    }),
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');

    return {
        ...actual,
        useQuery: vi.fn(),
        useQueries: vi.fn(),
        useQueryClient: vi.fn(),
    };
});

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseQueries = vi.mocked(useQueries);
const mockedUseQueryClient = vi.mocked(useQueryClient);

function setupQueryMocks() {
    mockedUseQuery.mockImplementation((options: {queryKey?: readonly unknown[]}) => {
        const key = options.queryKey ?? [];
        const queryName = key[1];

        if (queryName === 'shiftTeams') {
            return {
                data: queryState.shiftTeams,
                status: queryState.shiftTeamsStatus,
                refetch: vi.fn(),
            } as unknown as ReturnType<typeof useQuery>;
        }

        return {
            data: queryName === 'requestList' ? [] : null,
            status: 'pending',
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useQuery>;
    });
    mockedUseQueries.mockImplementation(({queries}: {queries: unknown[]}) =>
        queries.map(() => ({data: 0})) as unknown as ReturnType<typeof useQueries>,
    );
    mockedUseQueryClient.mockReturnValue({
        invalidateQueries: vi.fn(),
        cancelQueries: vi.fn(),
        getQueryData: vi.fn(),
        setQueryData: vi.fn(),
    } as unknown as ReturnType<typeof useQueryClient>);
}

function getRequestQueryCalls(shiftTeamId: number) {
    return mockedUseQuery.mock.calls
        .map(([options]) => options as {queryKey?: readonly unknown[]; enabled?: boolean})
        .filter((options) => {
            const key = options.queryKey ?? [];

            return (key[1] === 'request' || key[1] === 'requestList') && key.includes(shiftTeamId);
        });
}

describe('useRequestShift', () => {
    beforeEach(() => {
        localStorage.removeItem('useRequestShiftStore');
        useRequestShiftStore.getState().resetState();
        mockedUseQuery.mockReset();
        mockedUseQueries.mockReset();
        mockedUseQueryClient.mockReset();
        authState.wardId = 409;
        authState.isAuth = true;
        authState._loaded = true;
        authState.accountMeStatus = 'success';
        queryState.shiftTeams = [];
        queryState.shiftTeamsStatus = 'success';
        setupQueryMocks();
    });

    it('does not enable req-duty queries for a team left over from another ward', () => {
        queryState.shiftTeams = [{shiftTeamId: 900, name: 'New Team'}];
        useRequestShiftStore.setState({
            wardId: 301,
            year: 2026,
            month: 7,
            currentShiftTeamId: 728,
        });

        renderHook(() => useRequestShift());

        expect(getRequestQueryCalls(728)).toEqual([
            expect.objectContaining({enabled: false}),
            expect.objectContaining({enabled: false}),
        ]);
    });

    it('enables req-duty queries when the selected team belongs to the current ward', () => {
        queryState.shiftTeams = [{shiftTeamId: 728, name: 'Current Team'}];
        useRequestShiftStore.setState({
            wardId: 409,
            year: 2026,
            month: 7,
            currentShiftTeamId: 728,
        });

        renderHook(() => useRequestShift());

        expect(getRequestQueryCalls(728)).toEqual([
            expect.objectContaining({enabled: true}),
            expect.objectContaining({enabled: true}),
        ]);
    });
});
