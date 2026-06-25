import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {useMakeShiftStore} from '../make-shift-store';
import {useMakeShiftUseCase} from '../make-shift-use-case';

const wardApiMocks = vi.hoisted(() => ({
    updateShiftWorkflow: vi.fn(),
}));

vi.mock('@/shared/api/ward', () => ({
    default: wardApiMocks,
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({t: (key: string) => key}),
}));

describe('useMakeShiftUseCase', () => {
    beforeEach(() => {
        window.localStorage.clear();
        wardApiMocks.updateShiftWorkflow.mockReset();
        wardApiMocks.updateShiftWorkflow.mockResolvedValue({
            workflowStatus: 'IN_PROGRESS',
            workflowStep: 2,
        });
        useMakeShiftStore.setState({
            phase: 'stepping',
            currentStep: 1,
            maxReachedStep: 1,
            restoreDraftModalOpen: false,
            isHydrated: true,
            wardId: 1,
            workerConfirmationStatus: 'success',
            workerConfirmationCount: 1,
            stepNavigationBusy: {},
            year: 2026,
            month: 6,
            shiftTeams: [],
            shiftTeamsStatus: 'success',
            currentShiftTeamId: 10,
            shiftStatus: 'success',
            shiftExists: true,
            shiftFullyAssigned: false,
            confirmedShiftSnapshot: null,
            reloadToken: 0,
        });
    });

    it('persists the next in-progress workflow step after moving forward', () => {
        const {result} = renderHook(() => useMakeShiftUseCase());

        act(() => {
            result.current.next();
        });

        expect(useMakeShiftStore.getState().currentStep).toBe(2);
        expect(wardApiMocks.updateShiftWorkflow).toHaveBeenCalledWith(1, 10, 2026, 6, {
            workflowStatus: 'IN_PROGRESS',
            workflowStep: 2,
        });
    });
});
