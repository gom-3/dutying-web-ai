import {create} from 'zustand';
import {devtools} from 'zustand/middleware';
import {type TShiftTeam} from '@/entities';
import {
    bumpMaxReachedStep,
    loadDraftStep,
    loadMaxReachedStep,
    saveDraftStep,
} from './make-shift-progress-storage';

export type TMakeShiftStep = 1 | 2 | 3 | 4 | 5;
export type TFlowPhase = 'overview' | 'stepping';
export type TShiftStatus = 'idle' | 'pending' | 'success' | 'error';
export type TShiftTeamsStatus = 'idle' | 'pending' | 'success' | 'error';

const STEP_STORAGE_KEY = 'make-shift:draft-step';
const YEAR_STORAGE_KEY = 'make-shift:draft-year';
const MONTH_STORAGE_KEY = 'make-shift:draft-month';

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

export function loadPersistedStep(): TMakeShiftStep | null {
    if (typeof window === 'undefined') return null;

    const raw = window.localStorage.getItem(STEP_STORAGE_KEY);

    if (!raw) return null;

    const n = Number(raw);

    return n >= 1 && n <= 5 ? (n as TMakeShiftStep) : null;
}

/** 레거시 단일 draft-step 키만 제거 (연·월 로컬 키는 유지). */
export function clearPersistedStep() {
    if (typeof window === 'undefined') return;

    window.localStorage.removeItem(STEP_STORAGE_KEY);
}

export type TMakeShiftStore = {
    // flow
    phase: TFlowPhase;
    currentStep: TMakeShiftStep;
    /** 팀·연월 맥락에서 도달한 최대 스텝 (스토리지와 동기). */
    maxReachedStep: TMakeShiftStep;
    restoreDraftModalOpen: boolean;
    isHydrated: boolean;
    wardId: number | null;

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
    setWardId: (wardId: number | null) => void;
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

function readMaxReached(wardId: number | null, shiftTeamId: number | null, year: number, month: number): TMakeShiftStep {
    if (!wardId || !shiftTeamId) return 1;

    return loadMaxReachedStep(wardId, shiftTeamId, year, month);
}

/** 헤더로 연·월이 바뀌면 만들기 단계(stepping)를 끊고 개요로 보낸다(다른 달 플로우가 그대로 이어지지 않게). */
function exitingSteppingIfNeeded(phase: TFlowPhase): Partial<Pick<TMakeShiftStore, 'phase' | 'currentStep' | 'restoreDraftModalOpen'>> {
    if (phase !== 'stepping') return {};

    return {phase: 'overview', currentStep: 1, restoreDraftModalOpen: false};
}

export const useMakeShiftStore = create<TMakeShiftStore>()(
    devtools((set, get) => ({
        phase: 'overview',
        currentStep: 1,
        maxReachedStep: 1,
        restoreDraftModalOpen: false,
        isHydrated: false,
        wardId: null,

        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        shiftTeams: [],
        shiftTeamsStatus: 'idle',
        currentShiftTeamId: null,

        shiftStatus: 'idle',
        shiftExists: false,
        reloadToken: 0,

        setWardId: (wardId) => {
            const {currentShiftTeamId, year, month} = get();

            set(() => ({
                wardId,
                maxReachedStep: wardId ? readMaxReached(wardId, currentShiftTeamId, year, month) : 1,
            }));
        },

        startFromStep: ({step, openRestoreDraftModal}) => {
            const {wardId, currentShiftTeamId, year, month} = get();

            set(() => ({
                phase: 'stepping',
                currentStep: step,
                restoreDraftModalOpen: openRestoreDraftModal,
            }));
            persistYearMonth(year, month);

            if (wardId && currentShiftTeamId) {
                saveDraftStep(wardId, currentShiftTeamId, year, month, step);
                const max = bumpMaxReachedStep(wardId, currentShiftTeamId, year, month, step);

                set(() => ({maxReachedStep: max}));
            }
        },
        closeRestoreDraftModal: () => set(() => ({restoreDraftModalOpen: false})),
        resetToOverview: () => {
            const {wardId, currentShiftTeamId, year, month} = get();

            set(() => ({
                phase: 'overview',
                currentStep: 1,
                restoreDraftModalOpen: false,
                maxReachedStep: readMaxReached(wardId, currentShiftTeamId, year, month),
            }));
        },

        goPrev: () => {
            const {phase, currentStep, wardId, currentShiftTeamId, year, month} = get();

            if (phase !== 'stepping') return;

            if (currentStep <= 1) return;

            const nextStep = (currentStep - 1) as TMakeShiftStep;

            set(() => ({currentStep: nextStep}));

            if (wardId && currentShiftTeamId) {
                saveDraftStep(wardId, currentShiftTeamId, year, month, nextStep);
            }
        },
        goNext: () => {
            const {phase, currentStep, wardId, currentShiftTeamId, year, month} = get();

            if (phase !== 'stepping') return;

            if (currentStep >= 5) return;

            const nextStep = (currentStep + 1) as TMakeShiftStep;

            set(() => ({currentStep: nextStep}));

            if (wardId && currentShiftTeamId) {
                saveDraftStep(wardId, currentShiftTeamId, year, month, nextStep);
                const max = bumpMaxReachedStep(wardId, currentShiftTeamId, year, month, nextStep);

                set(() => ({maxReachedStep: max}));
            }
        },
        goToStep: (step) => {
            const {phase, wardId, currentShiftTeamId, year, month} = get();

            if (phase !== 'stepping') return;

            set(() => ({currentStep: step}));

            if (wardId && currentShiftTeamId) {
                saveDraftStep(wardId, currentShiftTeamId, year, month, step);
            }
        },

        setYearMonth: ({year, month}) => {
            const nextMonth = Math.min(12, Math.max(1, month));
            const {wardId, currentShiftTeamId, phase} = get();

            set(() => ({
                year,
                month: nextMonth,
                maxReachedStep: readMaxReached(wardId, currentShiftTeamId, year, nextMonth),
                ...exitingSteppingIfNeeded(phase),
            }));
            persistYearMonth(year, nextMonth);
        },
        goPrevMonth: () => {
            const {year, month, wardId, currentShiftTeamId, phase} = get();

            if (month <= 1) {
                const ny = year - 1;
                const nm = 12;

                set(() => ({
                    year: ny,
                    month: nm,
                    maxReachedStep: readMaxReached(wardId, currentShiftTeamId, ny, nm),
                    ...exitingSteppingIfNeeded(phase),
                }));
                persistYearMonth(ny, nm);

                return;
            }

            const nm = month - 1;

            set(() => ({
                month: nm,
                maxReachedStep: readMaxReached(wardId, currentShiftTeamId, year, nm),
                ...exitingSteppingIfNeeded(phase),
            }));
            persistYearMonth(year, nm);
        },
        goNextMonth: () => {
            const {year, month, wardId, currentShiftTeamId, phase} = get();

            if (month >= 12) {
                const ny = year + 1;
                const nm = 1;

                set(() => ({
                    year: ny,
                    month: nm,
                    maxReachedStep: readMaxReached(wardId, currentShiftTeamId, ny, nm),
                    ...exitingSteppingIfNeeded(phase),
                }));
                persistYearMonth(ny, nm);

                return;
            }

            const nm = month + 1;

            set(() => ({
                month: nm,
                maxReachedStep: readMaxReached(wardId, currentShiftTeamId, year, nm),
                ...exitingSteppingIfNeeded(phase),
            }));
            persistYearMonth(year, nm);
        },
        setShiftTeams: (shiftTeams) => set(() => ({shiftTeams})),
        setShiftTeamsStatus: (shiftTeamsStatus) => set(() => ({shiftTeamsStatus})),
        setCurrentShiftTeamId: (currentShiftTeamId) => {
            const {wardId, year, month} = get();

            if (!wardId || currentShiftTeamId === null) {
                set(() => ({
                    currentShiftTeamId,
                    maxReachedStep: 1,
                }));

                return;
            }

            const maxReached = readMaxReached(wardId, currentShiftTeamId, year, month);
            const saved = loadDraftStep(wardId, currentShiftTeamId, year, month);
            let currentStep: TMakeShiftStep = saved ?? 1;

            if (currentStep > maxReached) {
                currentStep = maxReached;
            }

            set(() => ({
                currentShiftTeamId,
                maxReachedStep: maxReached,
                currentStep,
            }));
        },

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
