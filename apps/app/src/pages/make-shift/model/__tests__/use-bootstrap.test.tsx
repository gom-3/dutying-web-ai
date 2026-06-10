import {type ReactNode} from 'react';
import {MemoryRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {TShift, TShiftTeam} from '@/entities';
import {getCalendarYearMonthNow} from '@/shared/lib/shift-calendar-month-policy';
import {renderHook, waitFor} from '@/shared/util/test-utils';
import {saveDraftStep, saveMaxReachedStep} from '../make-shift-progress-storage';
import {useMakeShiftStore} from '../make-shift-store';
import {useMakeShiftBootstrap} from '../use-bootstrap';

const wardApiMocks = vi.hoisted(() => ({
    getShiftTeams: vi.fn(),
    getShift: vi.fn(),
    getWardConstraint: vi.fn(),
}));

vi.mock('@/shared/api/ward', () => ({
    default: wardApiMocks,
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({t: (key: string) => key}),
}));

function makeEmptyShift(): TShift {
    return {
        lastDays: [],
        days: [{day: 1, dayType: 'workday'}],
        wardShiftTypes: [],
        divisionShiftNurses: [
            [
                {
                    shiftNurse: {
                        shiftNurseId: 1,
                        name: 'Kim',
                        carried: 0,
                        divisionNum: 0,
                        priority: 0,
                        isWorker: true,
                        nurseId: 100,
                    },
                    lastWardShiftList: [],
                    lastWardReqShiftList: [],
                    wardShiftList: [null],
                    wardReqShiftList: [],
                },
            ],
        ],
    };
}

function makePartiallyAssignedShift(): TShift {
    const shift = makeEmptyShift();

    shift.days = [
        {day: 1, dayType: 'workday'},
        {day: 2, dayType: 'workday'},
    ];
    shift.wardShiftTypes = [
        {
            wardShiftTypeId: 1,
            name: '데이',
            shortName: 'D',
            startTime: '07:00',
            endTime: '15:00',
            color: '#4DC2AD',
            isDefault: true,
            isOff: false,
            isCounted: true,
            classification: 'DAY',
        },
    ];
    shift.divisionShiftNurses[0]![0]!.wardShiftList = [1, null];

    return shift;
}

function makeFullyAssignedShift(): TShift {
    const shift = makePartiallyAssignedShift();

    shift.divisionShiftNurses[0]![0]!.wardShiftList = [1, 1];

    return shift;
}

function wrapper({children}: {children: ReactNode}) {
    return <MemoryRouter>{children}</MemoryRouter>;
}

function createWrapper(initialEntry: string) {
    return function TestWrapper({children}: {children: ReactNode}) {
        return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
    };
}

describe('useMakeShiftBootstrap', () => {
    beforeEach(() => {
        window.localStorage.clear();
        wardApiMocks.getShiftTeams.mockReset();
        wardApiMocks.getShift.mockReset();
        wardApiMocks.getWardConstraint.mockReset();
        wardApiMocks.getShiftTeams.mockResolvedValue([{shiftTeamId: 10, name: 'A팀', nurseCnt: 0, nurses: []}] satisfies TShiftTeam[]);
        wardApiMocks.getShift.mockResolvedValue(makeEmptyShift());
        wardApiMocks.getWardConstraint.mockResolvedValue({});
        useMakeShiftStore.setState({
            phase: 'overview',
            currentStep: 1,
            maxReachedStep: 1,
            restoreDraftModalOpen: false,
            isHydrated: false,
            wardId: null,
            workerConfirmationStatus: 'idle',
            workerConfirmationCount: 0,
            year: 2026,
            month: 6,
            shiftTeams: [],
            shiftTeamsStatus: 'idle',
            currentShiftTeamId: null,
            shiftStatus: 'idle',
            shiftExists: false,
            shiftFullyAssigned: false,
            confirmedShiftSnapshot: null,
            reloadToken: 0,
        });
    });

    it('opens the confirmed step when saved progress is already confirmed and the schedule has assignments', async () => {
        useMakeShiftStore.getState().setYearMonth({year: 2026, month: 6});
        saveDraftStep(1, 10, 2026, 6, 6);
        saveMaxReachedStep(1, 10, 2026, 6, 6);
        wardApiMocks.getShift.mockResolvedValue(makePartiallyAssignedShift());

        renderHook(() => useMakeShiftBootstrap(1), {
            wrapper: createWrapper('/make?year=2026&month=6&shiftTeamId=10'),
        });

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'stepping',
                currentShiftTeamId: 10,
                currentStep: 6,
                maxReachedStep: 6,
                restoreDraftModalOpen: false,
            });
        });
    });

    it('opens the confirmed step when the selected schedule is fully assigned', async () => {
        wardApiMocks.getShift.mockResolvedValue(makeFullyAssignedShift());

        renderHook(() => useMakeShiftBootstrap(1), {
            wrapper: createWrapper('/make?year=2026&month=6&shiftTeamId=10'),
        });

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'stepping',
                currentShiftTeamId: 10,
                currentStep: 6,
                maxReachedStep: 6,
                shiftExists: true,
                shiftFullyAssigned: true,
                restoreDraftModalOpen: false,
            });
        });
    });

    it('starts on the current month when there is no saved month', async () => {
        const currentYearMonth = getCalendarYearMonthNow();

        renderHook(() => useMakeShiftBootstrap(1), {wrapper});

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject(currentYearMonth);
        });
    });

    it('starts on the current month even when a saved month exists', async () => {
        const currentYearMonth = getCalendarYearMonthNow();
        const savedYearMonth =
            currentYearMonth.month === 1
                ? {year: currentYearMonth.year - 1, month: 12}
                : {year: currentYearMonth.year, month: currentYearMonth.month - 1};

        useMakeShiftStore.getState().setYearMonth(savedYearMonth);

        renderHook(() => useMakeShiftBootstrap(1), {wrapper});

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject(currentYearMonth);
        });
    });

    it('keeps the overview for an onboarding initial schedule even when some cells are assigned', async () => {
        wardApiMocks.getShift.mockResolvedValue(makePartiallyAssignedShift());

        renderHook(() => useMakeShiftBootstrap(1), {
            wrapper: createWrapper('/make?year=2026&month=6&shiftTeamId=10'),
        });

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'overview',
                currentShiftTeamId: 10,
                currentStep: 1,
                shiftExists: true,
                shiftFullyAssigned: false,
                restoreDraftModalOpen: false,
            });
        });
    });

    it('opens an onboarding initial schedule as the confirmed step when the target has assignments', async () => {
        wardApiMocks.getShift.mockResolvedValue(makePartiallyAssignedShift());

        renderHook(
            () =>
                useMakeShiftBootstrap(1, {
                    confirmInitialSchedule: {year: 2026, month: 6, shiftTeamId: 10},
                }),
            {
                wrapper: createWrapper('/make?year=2026&month=6&shiftTeamId=10'),
            },
        );

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'stepping',
                currentShiftTeamId: 10,
                currentStep: 6,
                maxReachedStep: 6,
                shiftExists: true,
                shiftFullyAssigned: true,
                restoreDraftModalOpen: false,
            });
        });
        expect(window.localStorage.getItem('make-shift:draft-step:1:10:2026:6')).toBe('6');
        expect(window.localStorage.getItem('make-shift:max-step:1:10:2026:6')).toBe('6');
    });

    it('stores every onboarding initial schedule target as confirmed progress', async () => {
        wardApiMocks.getShiftTeams.mockResolvedValue([
            {shiftTeamId: 10, name: 'A?', nurseCnt: 0, nurses: []},
            {shiftTeamId: 20, name: 'B?', nurseCnt: 0, nurses: []},
            {shiftTeamId: 30, name: 'C?', nurseCnt: 0, nurses: []},
        ] satisfies TShiftTeam[]);
        wardApiMocks.getShift.mockResolvedValue(makePartiallyAssignedShift());

        renderHook(
            () =>
                useMakeShiftBootstrap(1, {
                    confirmInitialSchedules: [
                        {year: 2026, month: 6, shiftTeamId: 10},
                        {year: 2026, month: 6, shiftTeamId: 20},
                        {year: 2026, month: 6, shiftTeamId: 30},
                    ],
                }),
            {
                wrapper,
            },
        );

        await waitFor(() => {
            expect(window.localStorage.getItem('make-shift:draft-step:1:10:2026:6')).toBe('6');
            expect(window.localStorage.getItem('make-shift:draft-step:1:20:2026:6')).toBe('6');
            expect(window.localStorage.getItem('make-shift:draft-step:1:30:2026:6')).toBe('6');
        });
    });

    it('does not confirm an onboarding initial schedule target when the selected month has no assignments', async () => {
        wardApiMocks.getShift.mockResolvedValue(makeEmptyShift());

        renderHook(
            () =>
                useMakeShiftBootstrap(1, {
                    confirmInitialSchedule: {year: 2026, month: 6, shiftTeamId: 10},
                }),
            {
                wrapper: createWrapper('/make?year=2026&month=6&shiftTeamId=10'),
            },
        );

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'overview',
                currentShiftTeamId: 10,
                currentStep: 1,
                shiftExists: false,
                shiftFullyAssigned: false,
            });
        });
    });

    it('keeps the overview after moving from an onboarding initial schedule target to another month', async () => {
        wardApiMocks.getShift.mockResolvedValue(makePartiallyAssignedShift());

        renderHook(() => useMakeShiftBootstrap(1), {
            wrapper: createWrapper('/make?year=2026&month=7&shiftTeamId=10'),
        });

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'overview',
                currentShiftTeamId: 10,
                currentStep: 1,
                shiftExists: true,
                shiftFullyAssigned: false,
            });
        });
    });

    it('does not migrate the legacy draft step into a different month', async () => {
        window.localStorage.setItem('make-shift:draft-step', '6');
        window.localStorage.setItem('make-shift:draft-year', '2026');
        window.localStorage.setItem('make-shift:draft-month', '6');
        wardApiMocks.getShift.mockResolvedValue(makeEmptyShift());

        renderHook(() => useMakeShiftBootstrap(1), {
            wrapper: createWrapper('/make?year=2026&month=7&shiftTeamId=10'),
        });

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                currentShiftTeamId: 10,
                currentStep: 1,
                shiftExists: false,
                shiftFullyAssigned: false,
            });
        });
        expect(window.localStorage.getItem('make-shift:draft-step:1:10:2026:7')).toBeNull();
        expect(window.localStorage.getItem('make-shift:draft-step')).toBeNull();
    });

    it('clears a stale confirmed draft step when the selected month has no assignments', async () => {
        saveDraftStep(1, 10, 2026, 7, 6);
        saveMaxReachedStep(1, 10, 2026, 7, 6);
        wardApiMocks.getShift.mockResolvedValue(makeEmptyShift());

        renderHook(() => useMakeShiftBootstrap(1), {
            wrapper: createWrapper('/make?year=2026&month=7&shiftTeamId=10'),
        });

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                currentShiftTeamId: 10,
                currentStep: 1,
                maxReachedStep: 1,
                shiftExists: false,
                shiftFullyAssigned: false,
            });
        });
        expect(window.localStorage.getItem('make-shift:draft-step:1:10:2026:7')).toBeNull();
        expect(window.localStorage.getItem('make-shift:max-step:1:10:2026:7')).toBeNull();
    });

    it('keeps ordinary partially assigned schedules on the overview without onboarding intent', async () => {
        wardApiMocks.getShift.mockResolvedValue(makePartiallyAssignedShift());

        renderHook(() => useMakeShiftBootstrap(1), {wrapper});

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'overview',
                currentShiftTeamId: 10,
                currentStep: 1,
                shiftExists: true,
                shiftFullyAssigned: false,
            });
        });
    });

    it('enters the confirmed step for an onboarding initial schedule even when only some cells are assigned', async () => {
        wardApiMocks.getShift.mockResolvedValue(makePartiallyAssignedShift());

        renderHook(
            () => useMakeShiftBootstrap(1, {confirmInitialSchedule: {year: 2026, month: 6, shiftTeamId: 10}}),
            {wrapper},
        );

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'stepping',
                currentShiftTeamId: 10,
                currentStep: 6,
                shiftExists: true,
                shiftFullyAssigned: true,
                restoreDraftModalOpen: false,
            });
        });
    });

    it('resets an in-progress authoring flow to the overview without onboarding intent', async () => {
        useMakeShiftStore.setState({phase: 'stepping', currentShiftTeamId: 10});
        wardApiMocks.getShift.mockResolvedValue(makePartiallyAssignedShift());

        renderHook(() => useMakeShiftBootstrap(1), {wrapper});

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'overview',
                currentShiftTeamId: 10,
                currentStep: 1,
                shiftExists: true,
                shiftFullyAssigned: false,
            });
        });
    });
});
