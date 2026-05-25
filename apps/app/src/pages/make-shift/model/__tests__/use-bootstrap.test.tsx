import {type ReactNode} from 'react';
import {MemoryRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {TShift, TShiftTeam} from '@/entities';
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
});
