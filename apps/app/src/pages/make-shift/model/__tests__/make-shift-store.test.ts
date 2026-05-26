import {beforeEach, describe, expect, it} from 'vitest';
import {type TNurse, type TShiftTeam} from '@/entities';
import {canGoNext, useMakeShiftStore} from '../make-shift-store';

const createNurse = (params: Partial<TNurse> & Pick<TNurse, 'nurseId' | 'isWorker'>): TNurse => ({
    nurseId: params.nurseId,
    accountId: params.accountId ?? null,
    shiftTeamId: params.shiftTeamId ?? 10,
    wardId: params.wardId ?? 1,
    name: params.name ?? `Nurse ${params.nurseId}`,
    phoneNum: params.phoneNum ?? '',
    isConnected: params.isConnected ?? true,
    nurseShiftTypes: params.nurseShiftTypes ?? [],
    isWorker: params.isWorker,
    isDutyManager: params.isDutyManager ?? false,
    isWardManager: params.isWardManager ?? false,
    gender: params.gender ?? '',
    employmentDate: params.employmentDate ?? '',
    memo: params.memo ?? '',
    isDeleted: params.isDeleted ?? false,
    divisionNum: params.divisionNum ?? 1,
    priority: params.priority ?? 100,
});

const createShiftTeam = (params: Partial<TShiftTeam> & Pick<TShiftTeam, 'shiftTeamId' | 'nurses'>): TShiftTeam => ({
    shiftTeamId: params.shiftTeamId,
    name: params.name ?? 'A Team',
    nurseCnt: params.nurseCnt ?? params.nurses.length,
    nurses: params.nurses,
});

describe('make-shift-store', () => {
    beforeEach(() => {
        window.localStorage.clear();
        useMakeShiftStore.setState({
            phase: 'overview',
            currentStep: 1,
            maxReachedStep: 1,
            restoreDraftModalOpen: false,
            wardId: 1,
            year: 2026,
            month: 6,
            currentShiftTeamId: 10,
            shiftStatus: 'success',
            shiftExists: true,
            shiftFullyAssigned: false,
            confirmedShiftSnapshot: null,
            workerConfirmationStatus: 'idle',
            workerConfirmationCount: 0,
        });
    });

    it('opens the confirmed step when a fully assigned schedule enters the flow', () => {
        useMakeShiftStore.setState({shiftFullyAssigned: true});

        useMakeShiftStore.getState().startFromStep({step: 1, openRestoreDraftModal: true});

        expect(useMakeShiftStore.getState()).toMatchObject({
            phase: 'stepping',
            currentStep: 6,
            maxReachedStep: 6,
            restoreDraftModalOpen: false,
        });
    });

    it('restores the confirmed step without opening the draft restore modal', () => {
        useMakeShiftStore.getState().startFromStep({step: 6, openRestoreDraftModal: true});

        expect(useMakeShiftStore.getState()).toMatchObject({
            phase: 'stepping',
            currentStep: 6,
            maxReachedStep: 6,
            restoreDraftModalOpen: false,
        });
    });

    it('returns to the overview and clears the previous schedule status when another team is selected', () => {
        useMakeShiftStore.setState({
            phase: 'stepping',
            currentStep: 3,
            restoreDraftModalOpen: true,
            currentShiftTeamId: 10,
            shiftStatus: 'success',
            shiftExists: true,
            shiftFullyAssigned: false,
        });

        useMakeShiftStore.getState().setCurrentShiftTeamId(20);

        expect(useMakeShiftStore.getState()).toMatchObject({
            phase: 'overview',
            currentStep: 1,
            restoreDraftModalOpen: false,
            currentShiftTeamId: 20,
            shiftStatus: 'idle',
            shiftExists: false,
            shiftFullyAssigned: false,
            confirmedShiftSnapshot: null,
        });
    });

    it('blocks moving past worker confirmation when no nurse is included', () => {
        useMakeShiftStore.setState({
            phase: 'stepping',
            currentStep: 1,
            maxReachedStep: 1,
            workerConfirmationStatus: 'success',
            workerConfirmationCount: 0,
        });

        useMakeShiftStore.getState().goNext();

        expect(useMakeShiftStore.getState()).toMatchObject({
            currentStep: 1,
            maxReachedStep: 1,
        });
    });

    it('moves past worker confirmation when at least one nurse is included', () => {
        useMakeShiftStore.setState({
            phase: 'stepping',
            currentStep: 1,
            maxReachedStep: 1,
            workerConfirmationStatus: 'success',
            workerConfirmationCount: 1,
        });

        useMakeShiftStore.getState().goNext();

        expect(useMakeShiftStore.getState()).toMatchObject({
            currentStep: 2,
            maxReachedStep: 2,
        });
    });

    it('allows the first next button immediately when the selected team already has an included nurse', () => {
        useMakeShiftStore.setState({
            phase: 'stepping',
            currentStep: 1,
            maxReachedStep: 1,
            currentShiftTeamId: 10,
            shiftTeams: [createShiftTeam({shiftTeamId: 10, nurses: [createNurse({nurseId: 1, isWorker: true})]})],
            workerConfirmationStatus: 'pending',
            workerConfirmationCount: 0,
        });

        expect(canGoNext(useMakeShiftStore.getState())).toBe(true);
    });
});
