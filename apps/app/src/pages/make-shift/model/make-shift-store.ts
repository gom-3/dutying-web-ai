import {create} from 'zustand';
import {devtools} from 'zustand/middleware';
import {type TShiftTeam} from '@/entities';

export type TMakeShiftStep = 1 | 2 | 3 | 4 | 5;
export type TFlowPhase = 'overview' | 'stepping';
export type TShiftStatus = 'idle' | 'pending' | 'success' | 'error';
export type TShiftTeamsStatus = 'idle' | 'pending' | 'success' | 'error';

const STEP_STORAGE_KEY = 'make-shift:draft-step';
const YEAR_STORAGE_KEY = 'make-shift:draft-year';
const MONTH_STORAGE_KEY = 'make-shift:draft-month';

function persistStep(step: TMakeShiftStep) {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(STEP_STORAGE_KEY, String(step));
}

export function loadPersistedStep(): TMakeShiftStep | null {
    if (typeof window === 'undefined') return null;

    const raw = window.localStorage.getItem(STEP_STORAGE_KEY);

    if (!raw) return null;

    const n = Number(raw);

    return n >= 1 && n <= 5 ? (n as TMakeShiftStep) : null;
}

function persistYearMonth(year: number, month: number) {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(YEAR_STORAGE_KEY, String(year));
    window.localStorage.setItem(MONTH_STORAGE_KEY, String(month));
}

export function loadPersistedYearMonth(): {year: number; month: number} | null {
    if (typeof window === 'undefined') return null;

    const y = window.localStorage.getItem(YEAR_STORAGE_KEY);
    const m = window.localStorage.getItem(MONTH_STORAGE_KEY);

    if (!y || !m) return null;

    return {year: Number(y), month: Number(m)};
}

export function clearPersistedStep() {
    if (typeof window === 'undefined') return;

    window.localStorage.removeItem(STEP_STORAGE_KEY);
    window.localStorage.removeItem(YEAR_STORAGE_KEY);
    window.localStorage.removeItem(MONTH_STORAGE_KEY);
}

export type TMakeShiftStore = {
    // flow
    phase: TFlowPhase;
    currentStep: TMakeShiftStep;
    restoreDraftModalOpen: boolean;
    isHydrated: boolean;

    // header (shared across overview / stepping)
    year: number;
    month: number; // 1~12
    shiftTeams: TShiftTeam[];
    shiftTeamsStatus: TShiftTeamsStatus;
    currentShiftTeamId: number | null;

    // overview status (MVP)
    shiftStatus: TShiftStatus;
    shiftExists: boolean;
    reloadToken: number;

    // actions (no business logic beyond state transitions)
    startFromStep: (opts: {step: TMakeShiftStep; openRestoreDraftModal: boolean}) => void;
    closeRestoreDraftModal: () => void;
    resetToOverview: () => void;

    goPrev: () => void;
    goNext: () => void;
    goToStep: (step: TMakeShiftStep) => void;

    setYearMonth: (payload: {year: number; month: number}) => void;
    goPrevMonth: () => void;
    goNextMonth: () => void;
    setShiftTeams: (teams: TShiftTeam[]) => void;
    setShiftTeamsStatus: (status: TShiftTeamsStatus) => void;
    setCurrentShiftTeamId: (shiftTeamId: number | null) => void;

    setShiftStatus: (status: TShiftStatus) => void;
    setShiftExists: (exists: boolean) => void;
    requestReload: () => void;
    setHydrated: () => void;
};

export const useMakeShiftStore = create<TMakeShiftStore>()(
    devtools((set, get) => ({
        phase: 'overview',
        currentStep: 1,
        restoreDraftModalOpen: false,
        isHydrated: false,

        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        shiftTeams: [],
        shiftTeamsStatus: 'idle',
        currentShiftTeamId: null,

        shiftStatus: 'idle',
        shiftExists: false,
        reloadToken: 0,

        startFromStep: ({step, openRestoreDraftModal}) => {
            set(() => ({
                phase: 'stepping',
                currentStep: step,
                restoreDraftModalOpen: openRestoreDraftModal,
            }));
            persistStep(step);
            const {year, month} = get();

            persistYearMonth(year, month);
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

            const nextStep = (currentStep - 1) as TMakeShiftStep;

            set(() => ({currentStep: nextStep}));
            persistStep(nextStep);
        },
        goNext: () => {
            const {phase, currentStep} = get();

            if (phase !== 'stepping') return;

            if (currentStep >= 5) return;

            const nextStep = (currentStep + 1) as TMakeShiftStep;

            set(() => ({currentStep: nextStep}));
            persistStep(nextStep);
        },
        goToStep: (step) => {
            const {phase, currentStep} = get();

            if (phase !== 'stepping') return;

            if (step > currentStep) return; // 선형 정책

            set(() => ({currentStep: step}));
            persistStep(step);
        },

        setYearMonth: ({year, month}) => {
            const nextMonth = Math.min(12, Math.max(1, month));

            set(() => ({
                year,
                month: nextMonth,
            }));
            persistYearMonth(year, nextMonth);
        },
        goPrevMonth: () => {
            const {year, month} = get();

            if (month <= 1) {
                set(() => ({year: year - 1, month: 12}));
                persistYearMonth(year - 1, 12);

                return;
            }

            set(() => ({month: month - 1}));
            persistYearMonth(year, month - 1);
        },
        goNextMonth: () => {
            const {year, month} = get();

            if (month >= 12) {
                set(() => ({year: year + 1, month: 1}));
                persistYearMonth(year + 1, 1);

                return;
            }

            set(() => ({month: month + 1}));
            persistYearMonth(year, month + 1);
        },
        setShiftTeams: (shiftTeams) => set(() => ({shiftTeams})),
        setShiftTeamsStatus: (shiftTeamsStatus) => set(() => ({shiftTeamsStatus})),
        setCurrentShiftTeamId: (currentShiftTeamId) => set(() => ({currentShiftTeamId})),

        setShiftStatus: (shiftStatus) => set(() => ({shiftStatus})),
        setShiftExists: (shiftExists) => set(() => ({shiftExists})),
        requestReload: () => set((state) => ({reloadToken: state.reloadToken + 1})),
        setHydrated: () => set(() => ({isHydrated: true})),
    })),
);

export function canGoPrev(state: Pick<TMakeShiftStore, 'phase' | 'currentStep'>): boolean {
    return state.phase === 'stepping' && state.currentStep > 1;
}

export function canGoNext(state: Pick<TMakeShiftStore, 'phase' | 'currentStep'>): boolean {
    return state.phase === 'stepping' && state.currentStep < 5;
}
