import {create} from 'zustand';
import {devtools} from 'zustand/middleware';

export type TMakeShiftStep = 1 | 2 | 3 | 4 | 5;
export type TFlowPhase = 'overview' | 'stepping';
export type TShiftStatus = 'idle' | 'pending' | 'success' | 'error';

export type TMakeShiftStore = {
    // flow
    phase: TFlowPhase;
    currentStep: TMakeShiftStep;
    restoreDraftModalOpen: boolean;

    // overview status (MVP)
    shiftStatus: TShiftStatus;
    shiftExists: boolean;

    // actions (no business logic beyond state transitions)
    startFromStep1: (opts: {openRestoreDraftModal: boolean}) => void;
    closeRestoreDraftModal: () => void;
    resetToOverview: () => void;

    goPrev: () => void;
    goNext: () => void;
    goToStep: (step: TMakeShiftStep) => void;

    setShiftStatus: (status: TShiftStatus) => void;
    setShiftExists: (exists: boolean) => void;
};

export const useMakeShiftStore = create<TMakeShiftStore>()(
    devtools((set, get) => ({
        phase: 'overview',
        currentStep: 1,
        restoreDraftModalOpen: false,

        shiftStatus: 'idle',
        shiftExists: false,

        startFromStep1: ({openRestoreDraftModal}) => {
            set(() => ({
                phase: 'stepping',
                currentStep: 1,
                restoreDraftModalOpen: openRestoreDraftModal,
            }));
        },
        closeRestoreDraftModal: () => set(() => ({restoreDraftModalOpen: false})),
        resetToOverview: () =>
            set(() => ({
                phase: 'overview',
                currentStep: 1,
                restoreDraftModalOpen: false,
            })),

        goPrev: () => {
            const {phase, currentStep} = get();

            if (phase !== 'stepping') return;

            if (currentStep <= 1) return;

            set(() => ({currentStep: (currentStep - 1) as TMakeShiftStep}));
        },
        goNext: () => {
            const {phase, currentStep} = get();

            if (phase !== 'stepping') return;

            if (currentStep >= 5) return;

            set(() => ({currentStep: (currentStep + 1) as TMakeShiftStep}));
        },
        goToStep: (step) => {
            const {phase, currentStep} = get();

            if (phase !== 'stepping') return;

            if (step > currentStep) return; // 선형 정책

            set(() => ({currentStep: step}));
        },

        setShiftStatus: (shiftStatus) => set(() => ({shiftStatus})),
        setShiftExists: (shiftExists) => set(() => ({shiftExists})),
    })),
);

export function canGoPrev(state: Pick<TMakeShiftStore, 'phase' | 'currentStep'>): boolean {
    return state.phase === 'stepping' && state.currentStep > 1;
}

export function canGoNext(state: Pick<TMakeShiftStore, 'phase' | 'currentStep'>): boolean {
    return state.phase === 'stepping' && state.currentStep < 5;
}
