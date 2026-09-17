import {useQuery} from '@tanstack/react-query';
import type * as ReactQuery from '@tanstack/react-query';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ReactNode} from 'react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {TNurse} from '@/entities';
import {render} from '@/shared/util/test-utils';
import {Workers} from '../workers';

const restPolicyCardCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const setWorkerConfirmationStateMock = vi.hoisted(() => vi.fn());
const selectNurseMock = vi.hoisted(() => vi.fn());
const addNurseMock = vi.hoisted(() => vi.fn(async () => undefined));
const updateNurseMock = vi.hoisted(() => vi.fn());
const teamNurses: TNurse[] = [
    {
        nurseId: 1,
        accountId: null,
        shiftTeamId: 10,
        wardId: 1,
        name: 'Kim',
        phoneNum: null,
        isConnected: false,
        nurseShiftTypes: [],
        isWorker: true,
        isDutyManager: false,
        isWardManager: false,
        gender: 'F',
        employmentDate: '2026-01-01',
        memo: '',
        isDeleted: false,
        divisionNum: 1,
        priority: 1,
    },
];
const makeShiftStoreState = {
    wardId: 1,
    currentShiftTeamId: 10,
    shiftTeams: [{shiftTeamId: 10, name: 'A team', nurseCnt: 1, nurses: teamNurses}],
    shiftTeamsStatus: 'success',
    year: 2026,
    month: 6,
    setWorkerConfirmationState: setWorkerConfirmationStateMock,
};

vi.mock('@tanstack/react-query', async (importOriginal) => {
    const actual = await importOriginal<typeof ReactQuery>();

    return {
        ...actual,
        useQuery: vi.fn(),
    };
});

vi.mock('@hello-pangea/dnd', () => ({
    DragDropContext: ({children}: {children: ReactNode}) => <div>{children}</div>,
}));

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {wardId: 1},
    }),
}));

vi.mock('@/features/edit-shift-team', () => ({
    default: () => ({
        state: {
            ward: undefined,
            shiftTeams: makeShiftStoreState.shiftTeams,
            selectedNurse: teamNurses[0],
            nurseSaveStatus: 'idle',
            isAddingNurse: false,
        },
        actions: {addNurse: addNurseMock, selectNurse: selectNurseMock, updateNurse: updateNurseMock},
    }),
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string, values?: Record<string, number>) => (values?.count === undefined ? key : `${key}:${values.count}`),
    }),
}));

vi.mock('../../../model/make-shift-store', () => ({
    isMakeShiftTeamReadyForWard: vi.fn(() => true),
    useMakeShiftStore: (selector: (state: typeof makeShiftStoreState) => unknown) => selector(makeShiftStoreState),
}));

vi.mock('../../../model/use-make-shift-nurse-order', () => ({
    useMakeShiftNurseOrder: () => ({
        moveNurseOrder: vi.fn(),
    }),
}));

vi.mock('../rest-leave-policy-summary-card', () => ({
    RestLeavePolicySummaryCard: (props: Record<string, unknown>) => {
        restPolicyCardCalls.push(props);

        return <div data-testid="rest-policy-summary-card" />;
    },
}));

vi.mock('../workers-sections', () => ({
    WorkersTableHeader: () => <div data-testid="workers-table-header" />,
    WorkersList: ({grouped, onEditNurse}: {grouped: Array<[string, TNurse[]]>; onEditNurse: (nurse: TNurse) => void}) => (
        <button type="button" onClick={() => onEditNurse(grouped[0]![1][0]!)}>
            open worker edit
        </button>
    ),
}));

vi.mock('../worker-edit-modal', () => ({
    WorkerEditModal: ({open}: {open: boolean}) => (open ? <div data-testid="worker-edit-modal" /> : null),
}));

const mockedUseQuery = vi.mocked(useQuery);

function queryResult<T>(data: T) {
    return {
        data,
        isPending: false,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuery>;
}

describe('Workers', () => {
    beforeEach(() => {
        restPolicyCardCalls.length = 0;
        setWorkerConfirmationStateMock.mockClear();
        selectNurseMock.mockClear();
        addNurseMock.mockClear();
        updateNurseMock.mockClear();
        mockedUseQuery.mockImplementation((options: {queryKey?: readonly unknown[]}) => {
            const key = options.queryKey ?? [];

            if (key.includes('shiftTeamNurses')) return queryResult(teamNurses);

            if (key.includes('id')) {
                return queryResult({
                    wardId: 1,
                    name: 'Ward',
                    code: 'WARD',
                    hospitalName: 'Hospital',
                    nurseCnt: 1,
                    wardShiftTypes: [],
                    shiftTeams: makeShiftStoreState.shiftTeams,
                });
            }

            if (key.includes('duty')) return queryResult({days: []});

            return queryResult(null);
        });
    });

    it('renders the rest target summary for the selected month', () => {
        render(
            <MemoryRouter>
                <Workers />
            </MemoryRouter>,
        );

        expect(restPolicyCardCalls[restPolicyCardCalls.length - 1]).toMatchObject({
            wardId: 1,
            shiftTeamId: 10,
            year: 2026,
            month: 6,
        });
        expect(restPolicyCardCalls[restPolicyCardCalls.length - 1]).not.toHaveProperty('days');
    });

    it('opens the shared worker editor when a worker row is selected', async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter>
                <Workers />
            </MemoryRouter>,
        );

        expect(screen.queryByTestId('worker-edit-modal')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: 'open worker edit'}));

        expect(selectNurseMock).toHaveBeenCalledWith(1);
        expect(screen.getByTestId('worker-edit-modal')).toBeInTheDocument();
    });

    it('adds a nurse to the current team from the worker step', async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter>
                <Workers />
            </MemoryRouter>,
        );

        await user.click(screen.getByRole('button', {name: 'page.member.addNurse'}));

        expect(addNurseMock).toHaveBeenCalledWith(10);
    });
});
