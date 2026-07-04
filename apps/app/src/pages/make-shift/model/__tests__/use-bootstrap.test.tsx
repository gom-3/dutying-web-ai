import {type ReactNode} from 'react';
import {MemoryRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {TShift, TShiftTeam} from '@/entities';
import {getNextCalendarYearMonth} from '@/shared/lib/shift-calendar-month-policy';
import {renderHook, waitFor} from '@/shared/util/test-utils';
import {saveDraftStep, saveMaxReachedStep} from '../make-shift-progress-storage';
import {useMakeShiftStore} from '../make-shift-store';
import {useMakeShiftBootstrap} from '../use-bootstrap';

const wardApiMocks = vi.hoisted(() => ({
    getShiftTeams: vi.fn(),
    getShift: vi.fn(),
    getWorkspaceSchedule: vi.fn(),
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
        wardApiMocks.getWorkspaceSchedule.mockReset();
        wardApiMocks.getWardConstraint.mockReset();
        wardApiMocks.getShiftTeams.mockResolvedValue([{shiftTeamId: 10, name: 'A팀', nurseCnt: 0, nurses: []}] satisfies TShiftTeam[]);
        wardApiMocks.getShift.mockResolvedValue(makeEmptyShift());
        wardApiMocks.getWorkspaceSchedule.mockResolvedValue({});
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

    it('clears stale confirmed progress when the backend reports the schedule is in progress', async () => {
        useMakeShiftStore.getState().setYearMonth({year: 2026, month: 6});
        saveDraftStep(1, 10, 2026, 6, 6);
        saveMaxReachedStep(1, 10, 2026, 6, 6);
        wardApiMocks.getShift.mockResolvedValue({
            ...makePartiallyAssignedShift(),
            workflowStatus: 'IN_PROGRESS',
            workflowStep: 3,
        });

        renderHook(() => useMakeShiftBootstrap(1), {
            wrapper: createWrapper('/make?year=2026&month=6&shiftTeamId=10'),
        });

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'stepping',
                currentShiftTeamId: 10,
                currentStep: 3,
                maxReachedStep: 3,
                restoreDraftModalOpen: false,
            });
        });
        expect(window.localStorage.getItem('make-shift:draft-step:1:10:2026:6')).toBe('3');
        expect(window.localStorage.getItem('make-shift:max-step:1:10:2026:6')).toBe('3');
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

    it('opens the confirmed step when the backend workflow status is confirmed', async () => {
        wardApiMocks.getShift.mockResolvedValue({
            ...makeEmptyShift(),
            workflowStatus: 'CONFIRMED',
            workflowStep: 6,
        });

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

    it('opens the confirmed step when the backend workflow step is confirmed', async () => {
        wardApiMocks.getShift.mockResolvedValue({
            ...makeEmptyShift(),
            workflowStep: 6,
        });

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

    it('opens the confirmed step from the backend workspace step when no explicit workflow status is present', async () => {
        wardApiMocks.getShift.mockResolvedValue(makePartiallyAssignedShift());
        wardApiMocks.getWorkspaceSchedule.mockResolvedValue({
            currentStep: 6,
        });

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
            });
        });
    });

    it('keeps an explicit confirmed workflow status ahead of an inferred workspace step', async () => {
        wardApiMocks.getShift.mockResolvedValue({
            ...makeEmptyShift(),
            workflowStatus: 'CONFIRMED',
            workflowStep: 6,
        });
        wardApiMocks.getWorkspaceSchedule.mockResolvedValue({
            currentStep: 1,
        });

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
            });
        });
    });

    it('opens the saved workflow step when the backend workflow status is in progress', async () => {
        wardApiMocks.getShift.mockResolvedValue({
            ...makeEmptyShift(),
            workflowStatus: 'IN_PROGRESS',
            workflowStep: 3,
        });

        renderHook(() => useMakeShiftBootstrap(1), {
            wrapper: createWrapper('/make?year=2026&month=6&shiftTeamId=10'),
        });

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'stepping',
                currentShiftTeamId: 10,
                currentStep: 3,
                maxReachedStep: 3,
                shiftExists: true,
                shiftFullyAssigned: false,
            });
        });
        expect(window.localStorage.getItem('make-shift:draft-step:1:10:2026:6')).toBe('3');
        expect(window.localStorage.getItem('make-shift:max-step:1:10:2026:6')).toBe('3');
    });

    it('opens a reachable step from the URL after the selected schedule loads', async () => {
        wardApiMocks.getShift.mockResolvedValue({
            ...makeEmptyShift(),
            workflowStatus: 'IN_PROGRESS',
            workflowStep: 3,
        });

        renderHook(() => useMakeShiftBootstrap(1), {
            wrapper: createWrapper('/make?year=2026&month=6&shiftTeamId=10&step=3'),
        });

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'stepping',
                currentShiftTeamId: 10,
                currentStep: 3,
                maxReachedStep: 3,
                shiftExists: true,
                shiftFullyAssigned: false,
            });
        });
    });

    it('starts on the next month when there is no saved month', async () => {
        const nextYearMonth = getNextCalendarYearMonth();

        renderHook(() => useMakeShiftBootstrap(1), {wrapper});

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject(nextYearMonth);
        });
    });

    it('starts on the next month even when a saved month exists', async () => {
        const nextYearMonth = getNextCalendarYearMonth();
        const savedYearMonth =
            nextYearMonth.month === 1
                ? {year: nextYearMonth.year - 1, month: 12}
                : {year: nextYearMonth.year, month: nextYearMonth.month - 1};

        useMakeShiftStore.getState().setYearMonth(savedYearMonth);

        renderHook(() => useMakeShiftBootstrap(1), {wrapper});

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject(nextYearMonth);
        });
    });

    it('opens the first step when some cells are assigned without backend confirmation', async () => {
        wardApiMocks.getShift.mockResolvedValue(makePartiallyAssignedShift());

        renderHook(() => useMakeShiftBootstrap(1), {
            wrapper: createWrapper('/make?year=2026&month=6&shiftTeamId=10'),
        });

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'stepping',
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
                    initialScheduleTarget: {year: 2026, month: 6, shiftTeamId: 10},
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

    it('confirms only the selected onboarding initial schedule target after its server schedule loads', async () => {
        wardApiMocks.getShiftTeams.mockResolvedValue([
            {shiftTeamId: 10, name: 'A?', nurseCnt: 0, nurses: []},
            {shiftTeamId: 20, name: 'B?', nurseCnt: 0, nurses: []},
            {shiftTeamId: 30, name: 'C?', nurseCnt: 0, nurses: []},
        ] satisfies TShiftTeam[]);
        wardApiMocks.getShift.mockResolvedValue(makePartiallyAssignedShift());

        renderHook(
            () =>
                useMakeShiftBootstrap(1, {
                    initialScheduleTargets: [
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
            expect(useMakeShiftStore.getState()).toMatchObject({
                currentShiftTeamId: 10,
                shiftStatus: 'success',
            });
        });
        expect(window.localStorage.getItem('make-shift:draft-step:1:10:2026:6')).toBe('6');
        expect(window.localStorage.getItem('make-shift:draft-step:1:20:2026:6')).toBeNull();
        expect(window.localStorage.getItem('make-shift:draft-step:1:30:2026:6')).toBeNull();
    });

    it('treats an onboarding initial schedule with assignments as confirmed even if the backend status is not started', async () => {
        wardApiMocks.getShift.mockResolvedValue({
            ...makePartiallyAssignedShift(),
            workflowStatus: 'NOT_STARTED',
            workflowStep: null,
        });

        renderHook(
            () =>
                useMakeShiftBootstrap(1, {
                    initialScheduleTarget: {year: 2026, month: 6, shiftTeamId: 10},
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
            });
        });
    });

    it('does not confirm an onboarding initial schedule target when the selected month has no assignments', async () => {
        wardApiMocks.getShift.mockResolvedValue(makeEmptyShift());

        renderHook(
            () =>
                useMakeShiftBootstrap(1, {
                    initialScheduleTarget: {year: 2026, month: 6, shiftTeamId: 10},
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

    it('opens the first step after moving from an onboarding initial schedule target to another month with progress', async () => {
        wardApiMocks.getShift.mockResolvedValue(makePartiallyAssignedShift());

        renderHook(() => useMakeShiftBootstrap(1), {
            wrapper: createWrapper('/make?year=2026&month=7&shiftTeamId=10'),
        });

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'stepping',
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

    it('opens the first step for ordinary partially assigned schedules without onboarding intent', async () => {
        wardApiMocks.getShift.mockResolvedValue(makePartiallyAssignedShift());

        renderHook(() => useMakeShiftBootstrap(1), {wrapper});

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'stepping',
                currentShiftTeamId: 10,
                currentStep: 1,
                shiftExists: true,
                shiftFullyAssigned: false,
            });
        });
    });

    it('enters the confirmed step for an onboarding initial schedule when the backend confirms it', async () => {
        wardApiMocks.getShift.mockResolvedValue({
            ...makePartiallyAssignedShift(),
            workflowStatus: 'CONFIRMED',
            workflowStep: 6,
        });

        renderHook(
            () => useMakeShiftBootstrap(1, {initialScheduleTarget: {year: 2026, month: 6, shiftTeamId: 10}}),
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

    it('keeps an in-progress authoring flow in the step editor without onboarding intent', async () => {
        useMakeShiftStore.setState({phase: 'stepping', currentShiftTeamId: 10});
        wardApiMocks.getShift.mockResolvedValue(makePartiallyAssignedShift());

        renderHook(() => useMakeShiftBootstrap(1), {wrapper});

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'stepping',
                currentShiftTeamId: 10,
                currentStep: 1,
                shiftExists: true,
                shiftFullyAssigned: false,
            });
        });
    });
});
