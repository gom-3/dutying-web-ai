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

function wrapper({children}: {children: ReactNode}) {
    return <MemoryRouter>{children}</MemoryRouter>;
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

    it('enters the confirmed step when saved progress is already confirmed', async () => {
        useMakeShiftStore.getState().setYearMonth({year: 2026, month: 6});
        saveDraftStep(1, 10, 2026, 6, 6);
        saveMaxReachedStep(1, 10, 2026, 6, 6);

        renderHook(() => useMakeShiftBootstrap(1), {wrapper});

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject({
                phase: 'stepping',
                currentShiftTeamId: 10,
                currentStep: 6,
                restoreDraftModalOpen: false,
            });
        });
    });

    it('starts on next month when there is no saved month', async () => {
        const nextYearMonth = getNextCalendarYearMonth();

        renderHook(() => useMakeShiftBootstrap(1), {wrapper});

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject(nextYearMonth);
        });
    });

    it('prefers next month for onboarding entry even when a saved month exists', async () => {
        useMakeShiftStore.getState().setYearMonth({year: 2026, month: 6});

        const nextYearMonth = getNextCalendarYearMonth();

        renderHook(() => useMakeShiftBootstrap(1, {preferNextMonth: true}), {wrapper});

        await waitFor(() => {
            expect(useMakeShiftStore.getState()).toMatchObject(nextYearMonth);
        });
    });

    it('enters the confirmed step for an onboarding initial schedule even when only some cells are assigned', async () => {
        wardApiMocks.getShift.mockResolvedValue(makePartiallyAssignedShift());

        renderHook(() => useMakeShiftBootstrap(1, {confirmExistingShift: true}), {wrapper});

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

    it('keeps ordinary partially assigned schedules in the authoring flow without onboarding intent', async () => {
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
