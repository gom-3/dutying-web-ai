import {type TWorkspaceScheduleResponse} from '@dutying/api/ward';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import React, {type ReactNode} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {type TShift} from '@/entities';
import {useShiftEditorStore} from '@/features/shift-editor/model';
import {useMakeShiftStore} from '@/pages/make-shift/model/make-shift-store';
import {act, renderHook, waitFor} from '@/shared/util/test-utils';
import {focusEditorWithoutScrolling, useDutyEditorStep} from '../use-duty-editor-step';

const wardApiMocks = vi.hoisted(() => ({
    getShift: vi.fn(),
    getWorkspaceSchedule: vi.fn(),
}));

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {wardId: 1},
    }),
}));

vi.mock('@/shared/api', () => ({
    WardAPI: wardApiMocks,
}));

vi.mock('@/shared/api/ward', () => ({
    default: wardApiMocks,
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({t: (key: string) => key}),
}));

function createQueryWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                gcTime: 0,
                retry: false,
            },
        },
    });

    return function TestQueryWrapper({children}: {children: ReactNode}) {
        return React.createElement(QueryClientProvider, {client: queryClient}, children);
    };
}

function createDeferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return {promise, resolve, reject};
}

function makeShift({
    wardShiftList = [10],
    wardReqShiftList = [null],
    shortName = 'D',
}: {
    wardShiftList?: (number | null)[];
    wardReqShiftList?: (number | null)[];
    shortName?: string;
} = {}): TShift {
    return {
        lastDays: [],
        days: [{day: 1, dayType: 'workday'}],
        wardShiftTypes: [
            {
                wardShiftTypeId: 10,
                name: 'Day',
                shortName,
                startTime: '07:00',
                endTime: '15:00',
                color: '#4B7BEC',
                isDefault: true,
                isOff: false,
                isCounted: true,
                classification: 'DAY',
            },
        ],
        divisionShiftNurses: [
            [
                {
                    shiftNurse: {
                        shiftNurseId: 2,
                        name: 'Kim',
                        carried: 0,
                        divisionNum: 0,
                        priority: 0,
                        isWorker: true,
                        nurseId: 100,
                    },
                    lastWardShiftList: [],
                    lastWardReqShiftList: [],
                    wardShiftList,
                    wardReqShiftList,
                },
            ],
        ],
    };
}

function makeWorkspaceSchedule({
    fixed = true,
    requestShifts = [],
}: {
    fixed?: boolean;
    requestShifts?: TWorkspaceScheduleResponse['requestShifts'];
} = {}) {
    return {
        wardId: 1,
        shiftTeamId: 10,
        year: 2026,
        month: 5,
        days: ['2026-05-01'],
        shiftTypes: [],
        rows: [],
        rowOrder: [],
        cells: [],
        wardShiftBase: fixed
            ? [
                  {
                      shiftNurseId: 2,
                      nurseId: 100,
                      date: '2026-05-01',
                      wardShiftTypeId: 10,
                      shiftCode: 'D',
                      fixed: true,
                  },
              ]
            : [],
        requestShifts,
        rules: [],
        rulesHash: 'rules-v1',
        latestSnapshot: null,
    };
}

describe('focusEditorWithoutScrolling', () => {
    it('focuses the editor without letting the browser adjust scroll position', () => {
        const editor = document.createElement('div');
        const focus = vi.spyOn(editor, 'focus').mockImplementation(() => undefined);

        focusEditorWithoutScrolling(editor);

        expect(focus).toHaveBeenCalledWith({preventScroll: true});
    });
});

describe('useDutyEditorStep', () => {
    beforeEach(() => {
        window.localStorage.clear();
        wardApiMocks.getShift.mockReset();
        wardApiMocks.getWorkspaceSchedule.mockReset();
        useShiftEditorStore.getState().reset();
        useMakeShiftStore.setState({
            wardId: 1,
            year: 2026,
            month: 5,
            shiftTeams: [{shiftTeamId: 10, name: 'A Team', nurseCnt: 0, nurses: []}],
            shiftTeamsStatus: 'success',
            currentShiftTeamId: 10,
        });
    });

    afterEach(() => {
        window.localStorage.clear();
        useShiftEditorStore.getState().reset();
    });

    it('waits for workspace fixed cells before hydrating the editor document', async () => {
        const workspace = createDeferred<ReturnType<typeof makeWorkspaceSchedule>>();

        wardApiMocks.getShift.mockResolvedValue(makeShift());
        wardApiMocks.getWorkspaceSchedule.mockReturnValue(workspace.promise);

        const {result} = renderHook(() => useDutyEditorStep(), {wrapper: createQueryWrapper()});

        await waitFor(() => {
            expect(result.current.dutyQuery.data).toBeDefined();
        });

        expect(result.current.isHydratingEditor).toBe(true);
        expect(useShiftEditorStore.getState().doc.columns).toEqual([]);

        await act(async () => {
            workspace.resolve(makeWorkspaceSchedule());
            await workspace.promise;
        });

        await waitFor(() => {
            expect(useShiftEditorStore.getState().doc.fixedCells).toEqual({'2|2026-05-01': true});
        });

        expect(result.current.isHydratingEditor).toBe(false);
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells[0]).toBe('D');
        await waitFor(() => {
            expect(useShiftEditorStore.getState().rulesHash).toBe('rules-v1');
        });
    });

    it('hydrates request cells from accepted workspace requests', async () => {
        wardApiMocks.getShift.mockResolvedValue(makeShift({wardShiftList: [null], wardReqShiftList: [10]}));
        wardApiMocks.getWorkspaceSchedule.mockResolvedValue(
            makeWorkspaceSchedule({
                fixed: false,
                requestShifts: [
                    {
                        shiftNurseId: 2,
                        nurseId: 100,
                        date: '2026-05-01',
                        wardShiftTypeId: 10,
                        shiftCode: 'D',
                        isAccepted: true,
                        isRequested: true,
                    },
                ],
            }),
        );

        renderHook(() => useDutyEditorStep(), {wrapper: createQueryWrapper()});

        await waitFor(() => {
            expect(useShiftEditorStore.getState().doc.requestCells).toEqual({'2|2026-05-01': true});
        });

        expect(useShiftEditorStore.getState().doc.rows[0]?.cells[0]).toBe('D');
    });

    it('keeps accepted request cells out of fixed cells when workspace base also marks them fixed', async () => {
        wardApiMocks.getShift.mockResolvedValue(makeShift({wardShiftList: [null], wardReqShiftList: [10]}));
        wardApiMocks.getWorkspaceSchedule.mockResolvedValue(
            makeWorkspaceSchedule({
                fixed: true,
                requestShifts: [
                    {
                        shiftNurseId: 2,
                        nurseId: 100,
                        date: '2026-05-01',
                        wardShiftTypeId: 10,
                        shiftCode: 'D',
                        isAccepted: true,
                        isRequested: true,
                    },
                ],
            }),
        );

        renderHook(() => useDutyEditorStep(), {wrapper: createQueryWrapper()});

        await waitFor(() => {
            expect(useShiftEditorStore.getState().doc.requestCells).toEqual({'2|2026-05-01': true});
        });

        expect(useShiftEditorStore.getState().doc.fixedCells).toEqual({});
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells[0]).toBe('D');
    });

    it('does not hydrate rejected workspace requests into fixed request cells', async () => {
        wardApiMocks.getShift.mockResolvedValue(makeShift({wardShiftList: [null], wardReqShiftList: [10]}));
        wardApiMocks.getWorkspaceSchedule.mockResolvedValue(
            makeWorkspaceSchedule({
                fixed: false,
                requestShifts: [
                    {
                        shiftNurseId: 2,
                        nurseId: 100,
                        date: '2026-05-01',
                        wardShiftTypeId: 10,
                        shiftCode: 'D',
                        isAccepted: false,
                        isRequested: true,
                    },
                ],
            }),
        );

        renderHook(() => useDutyEditorStep(), {wrapper: createQueryWrapper()});

        await waitFor(() => {
            expect(useShiftEditorStore.getState().doc.rows[0]?.cells[0]).toBeNull();
        });

        expect(useShiftEditorStore.getState().doc.requestCells).toEqual({});
    });

    it('rebases stale persisted short names to the current server shift value', async () => {
        window.localStorage.setItem(
            'shift-editor:draft:1:10:2026:5',
            JSON.stringify({
                doc: {
                    columns: ['2026-05-01'],
                    rows: [{workerId: '2', lastCells: [], cells: ['O']}],
                    workerMeta: {2: {name: 'Kim', nurseId: 100, priority: 0, divisionNum: 1}},
                    fixedCells: {},
                    requestCells: {},
                },
                history: JSON.stringify({past: [], future: [], maxDepth: 100}),
                scheduleViolations: {validationSnapshot: null},
                savedAt: Date.now(),
            }),
        );
        wardApiMocks.getShift.mockResolvedValue(makeShift({shortName: '-', wardShiftList: [10]}));
        wardApiMocks.getWorkspaceSchedule.mockResolvedValue(makeWorkspaceSchedule({fixed: false}));

        renderHook(() => useDutyEditorStep(), {wrapper: createQueryWrapper()});

        await waitFor(() => {
            expect(useShiftEditorStore.getState().doc.rows[0]?.cells[0]).toBe('-');
        });
    });

    it('does not request duty data until the selected team belongs to the current ward context', async () => {
        useMakeShiftStore.setState({
            wardId: 301,
            shiftTeams: [{shiftTeamId: 727, name: 'Old Team', nurseCnt: 0, nurses: []}],
            shiftTeamsStatus: 'success',
            currentShiftTeamId: 727,
        });

        renderHook(() => useDutyEditorStep(), {wrapper: createQueryWrapper()});

        await act(async () => {
            await Promise.resolve();
        });

        expect(wardApiMocks.getShift).not.toHaveBeenCalled();
        expect(wardApiMocks.getWorkspaceSchedule).not.toHaveBeenCalled();
    });

    it('keeps local editor changes when duty data refetches for the same context', async () => {
        wardApiMocks.getShift.mockResolvedValueOnce(makeShift()).mockResolvedValueOnce(makeShift());
        wardApiMocks.getWorkspaceSchedule.mockResolvedValue(makeWorkspaceSchedule({fixed: false}));

        const {result} = renderHook(() => useDutyEditorStep(), {wrapper: createQueryWrapper()});

        await waitFor(() => {
            expect(useShiftEditorStore.getState().doc.rows[0]?.cells[0]).toBe('D');
        });

        act(() => {
            const {doc, setDoc} = useShiftEditorStore.getState();

            setDoc({
                ...doc,
                rows: doc.rows.map((row, rowIdx) => (rowIdx === 0 ? {...row, cells: [null]} : row)),
            });
        });

        expect(useShiftEditorStore.getState().doc.rows[0]?.cells[0]).toBeNull();

        await act(async () => {
            await result.current.dutyQuery.refetch();
        });

        expect(useShiftEditorStore.getState().doc.rows[0]?.cells[0]).toBeNull();
    });
});
