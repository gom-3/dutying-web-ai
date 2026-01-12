import {create} from 'zustand';
import {devtools} from 'zustand/middleware';
import {type TShiftTeam} from '@/shared/types/ward';

export type TMakeShiftStep = 1 | 2 | 3 | 4 | 5;
export type TFlowPhase = 'overview' | 'stepping';
export type TShiftStatus = 'idle' | 'pending' | 'success' | 'error';

export type TMakeShiftStore = {
    // flow
    phase: TFlowPhase;
    currentStep: TMakeShiftStep;
    restoreDraftModalOpen: boolean;

    // header (shared across overview / stepping)
    year: number;
    month: number; // 1~12
    shiftTeams: TShiftTeam[];
    currentShiftTeamId: number | null;

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

    setYearMonth: (payload: {year: number; month: number}) => void;
    goPrevMonth: () => void;
    goNextMonth: () => void;
    setShiftTeams: (teams: TShiftTeam[]) => void;
    setCurrentShiftTeamId: (shiftTeamId: number | null) => void;

    setShiftStatus: (status: TShiftStatus) => void;
    setShiftExists: (exists: boolean) => void;
};

export const useMakeShiftStore = create<TMakeShiftStore>()(
    devtools((set, get) => ({
        phase: 'overview',
        currentStep: 1,
        restoreDraftModalOpen: false,

        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        shiftTeams: [],
        currentShiftTeamId: null,

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

        setYearMonth: ({year, month}) =>
            set(() => ({
                year,
                month: Math.min(12, Math.max(1, month)),
            })),
        goPrevMonth: () => {
            const {year, month} = get();

            if (month <= 1) {
                set(() => ({year: year - 1, month: 12}));

                return;
            }

            set(() => ({month: month - 1}));
        },
        goNextMonth: () => {
            const {year, month} = get();

            if (month >= 12) {
                set(() => ({year: year + 1, month: 1}));

                return;
            }

            set(() => ({month: month + 1}));
        },
        setShiftTeams: (shiftTeams) => set(() => ({shiftTeams})),
        setCurrentShiftTeamId: (currentShiftTeamId) => set(() => ({currentShiftTeamId})),

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
