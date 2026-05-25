import {beforeEach, describe, expect, it} from 'vitest';
import {useMakeShiftStore} from '../make-shift-store';

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
});
