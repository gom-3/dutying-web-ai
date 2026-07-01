import {useEffect, useMemo, useRef} from 'react';
import {useSearchParams} from 'react-router';
import {isDutyShiftFullyAssigned, isDutyShiftWithoutAssignments, useShiftEditorCommands} from '@/features/shift-editor';
import WardAPI from '@/shared/api/ward';
import {getNextCalendarYearMonth} from '@/shared/lib/shift-calendar-month-policy';
import {getShiftWorkflowStatus, getShiftWorkflowStep, getWorkflowStatusFromStep} from '@/shared/lib/shift-workflow-status';
import {bumpMaxReachedStep, clearMakeShiftProgress, loadDraftStep, saveDraftStep, saveMaxReachedStep} from './make-shift-progress-storage';
import {clearPersistedStep, isMakeShiftTeamReadyForWard, loadPersistedStep, loadPersistedYearMonth, useMakeShiftStore} from './make-shift-store';

function parsePositiveInt(raw: string | null): number | null {
    if (!raw) return null;

    const n = Number(raw);

    return Number.isInteger(n) && n > 0 ? n : null;
}

type TInitialScheduleTarget = {
    year: number;
    month: number;
    shiftTeamId?: number;
};

type TUseMakeShiftBootstrapOptions = {
    initialScheduleTarget?: TInitialScheduleTarget | null;
    initialScheduleTargets?: TInitialScheduleTarget[] | null;
};

const getInitialScheduleTargetsKey = (targets: TInitialScheduleTarget[]) =>
    targets.map((target) => `${target.year}:${target.month}:${target.shiftTeamId ?? '*'}`).join('|');

function isInitialScheduleTarget(
    targets: TInitialScheduleTarget[],
    year: number,
    month: number,
    shiftTeamId: number | null,
): boolean {
    if (shiftTeamId === null) return false;

    return targets.some(
        (target) =>
            target.year === year &&
            target.month === month &&
            (target.shiftTeamId === undefined || target.shiftTeamId === shiftTeamId),
    );
}

export function useMakeShiftBootstrap(wardId: number | null, options: TUseMakeShiftBootstrapOptions = {}) {
    const [searchParams] = useSearchParams();
    const {initialScheduleTarget = null, initialScheduleTargets = null} = options;
    const onboardingScheduleTargets = useMemo(() => {
        if (initialScheduleTargets && initialScheduleTargets.length > 0) {
            return initialScheduleTargets;
        }

        return initialScheduleTarget ? [initialScheduleTarget] : [];
    }, [initialScheduleTarget, initialScheduleTargets]);
    const primaryOnboardingScheduleTarget = onboardingScheduleTargets[0] ?? null;
    const onboardingScheduleTargetsKey = getInitialScheduleTargetsKey(onboardingScheduleTargets);
    const onboardingScheduleTargetsRef = useRef(onboardingScheduleTargets);
    const editor = useShiftEditorCommands();
    const editorRef = useRef(editor);
    const initializedWardIdRef = useRef<number | null>(null);
    const initialQueryShiftTeamIdRef = useRef<number | null>(null);

    onboardingScheduleTargetsRef.current = onboardingScheduleTargets;
    editorRef.current = editor;

    const setShiftStatus = useMakeShiftStore((s) => s.setShiftStatus);
    const setShiftExists = useMakeShiftStore((s) => s.setShiftExists);
    const setShiftFullyAssigned = useMakeShiftStore((s) => s.setShiftFullyAssigned);
    const setShiftTeams = useMakeShiftStore((s) => s.setShiftTeams);
    const setShiftTeamsStatus = useMakeShiftStore((s) => s.setShiftTeamsStatus);
    const setCurrentShiftTeamId = useMakeShiftStore((s) => s.setCurrentShiftTeamId);
    const setYearMonth = useMakeShiftStore((s) => s.setYearMonth);
    const shiftTeams = useMakeShiftStore((s) => s.shiftTeams);
    const shiftTeamsStatus = useMakeShiftStore((s) => s.shiftTeamsStatus);
    const year = useMakeShiftStore((s) => s.year);
    const month = useMakeShiftStore((s) => s.month);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const shiftStatus = useMakeShiftStore((s) => s.shiftStatus);
    const reloadToken = useMakeShiftStore((s) => s.reloadToken);
    const isHydrated = useMakeShiftStore((s) => s.isHydrated);
    const setHydrated = useMakeShiftStore((s) => s.setHydrated);
    const setWardId = useMakeShiftStore((s) => s.setWardId);
    const confirmSchedule = useMakeShiftStore((s) => s.confirmSchedule);
    const shiftExists = useMakeShiftStore((s) => s.shiftExists);
    const shiftFullyAssigned = useMakeShiftStore((s) => s.shiftFullyAssigned);
    const storeWardId = useMakeShiftStore((s) => s.wardId);
    const isCurrentShiftTeamReady = isMakeShiftTeamReadyForWard(
        {wardId: storeWardId, shiftTeams, shiftTeamsStatus},
        wardId,
        currentShiftTeamId,
    );

    useEffect(() => {
        setWardId(wardId);
    }, [wardId, setWardId]);

    useEffect(() => {
        if (isHydrated || !wardId) return;

        const hasExplicitYearMonth = searchParams.has('year') || searchParams.has('month');

        if (primaryOnboardingScheduleTarget) {
            setYearMonth({year: primaryOnboardingScheduleTarget.year, month: primaryOnboardingScheduleTarget.month});
        } else if (!hasExplicitYearMonth) {
            setYearMonth(getNextCalendarYearMonth());
        }

        setHydrated();
    }, [isHydrated, primaryOnboardingScheduleTarget, wardId, setHydrated, searchParams, setYearMonth]);

    useEffect(() => {
        if (!wardId || !isHydrated || !currentShiftTeamId || !isCurrentShiftTeamReady) return;

        const st = useMakeShiftStore.getState();
        const fromComposite = loadDraftStep(wardId, currentShiftTeamId, st.year, st.month);
        const fromLegacy = loadPersistedStep();
        const legacyYearMonth = loadPersistedYearMonth();
        const hasExplicitYearMonth = searchParams.has('year') || searchParams.has('month');
        const canMigrateLegacy =
            !hasExplicitYearMonth && legacyYearMonth !== null && legacyYearMonth.year === st.year && legacyYearMonth.month === st.month;

        if (!fromLegacy) return;

        if (fromComposite || !canMigrateLegacy) {
            clearPersistedStep();

            return;
        }

        saveDraftStep(wardId, currentShiftTeamId, st.year, st.month, fromLegacy);
        bumpMaxReachedStep(wardId, currentShiftTeamId, st.year, st.month, fromLegacy);
        clearPersistedStep();
        setCurrentShiftTeamId(currentShiftTeamId);
    }, [currentShiftTeamId, isCurrentShiftTeamReady, isHydrated, month, searchParams, setCurrentShiftTeamId, wardId, year]);

    useEffect(() => {
        if (!wardId) {
            initializedWardIdRef.current = null;
            initialQueryShiftTeamIdRef.current = null;

            return;
        }

        if (initializedWardIdRef.current === wardId) return;

        initializedWardIdRef.current = wardId;

        const defaultMakeShiftYearMonth = getNextCalendarYearMonth();
        const queryYear = parsePositiveInt(searchParams.get('year'));
        const queryMonth = parsePositiveInt(searchParams.get('month'));
        const queryShiftTeamId = parsePositiveInt(searchParams.get('shiftTeamId'));
        const targetYear = primaryOnboardingScheduleTarget?.year ?? queryYear;
        const targetMonth = primaryOnboardingScheduleTarget?.month ?? queryMonth;
        const targetShiftTeamId = primaryOnboardingScheduleTarget?.shiftTeamId ?? queryShiftTeamId;

        if (targetYear !== null || targetMonth !== null) {
            const hasValidTargetMonth = targetMonth !== null && targetMonth >= 1 && targetMonth <= 12;
            const nextYear = targetYear ?? defaultMakeShiftYearMonth.year;
            const nextMonth = hasValidTargetMonth ? targetMonth : defaultMakeShiftYearMonth.month;

            setYearMonth({year: nextYear, month: nextMonth});
        }

        initialQueryShiftTeamIdRef.current = targetShiftTeamId;
    }, [primaryOnboardingScheduleTarget, searchParams, setYearMonth, wardId]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!wardId) {
                setShiftTeamsStatus('idle');
                setShiftStatus('idle');
                setShiftExists(false);
                setShiftFullyAssigned(false);
                setShiftTeams([]);
                setCurrentShiftTeamId(null);

                return;
            }

            try {
                setShiftTeamsStatus('pending');

                const teams = await WardAPI.getShiftTeams(wardId);

                if (cancelled) return;

                setShiftTeams(teams);
                setShiftTeamsStatus('success');
            } catch {
                if (!cancelled) {
                    setShiftTeamsStatus('error');
                    setShiftStatus('error');
                }
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [
        reloadToken,
        setCurrentShiftTeamId,
        setShiftExists,
        setShiftFullyAssigned,
        setShiftStatus,
        setShiftTeams,
        setShiftTeamsStatus,
        wardId,
    ]);

    useEffect(() => {
        if (!wardId || storeWardId !== wardId || shiftTeamsStatus !== 'success') return;

        const firstTeamId = shiftTeams[0]?.shiftTeamId ?? null;
        const prevSelectedId = useMakeShiftStore.getState().currentShiftTeamId;
        const queryShiftTeamId = initialQueryShiftTeamIdRef.current;
        const hasPrevSelected = prevSelectedId !== null && shiftTeams.some((team) => team.shiftTeamId === prevSelectedId);
        const hasQuerySelected = queryShiftTeamId !== null && shiftTeams.some((team) => team.shiftTeamId === queryShiftTeamId);
        const nextTeamId = hasQuerySelected ? queryShiftTeamId : hasPrevSelected ? prevSelectedId : firstTeamId;

        setCurrentShiftTeamId(nextTeamId);
    }, [setCurrentShiftTeamId, shiftTeams, shiftTeamsStatus, storeWardId, wardId]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!wardId || !currentShiftTeamId || !isCurrentShiftTeamReady) {
                setShiftStatus('idle');
                setShiftExists(false);
                setShiftFullyAssigned(false);

                return;
            }

            setShiftStatus('pending');
            setShiftExists(false);
            setShiftFullyAssigned(false);

            try {
                const [shift, workspace] = await Promise.all([
                    WardAPI.getShift(wardId, currentShiftTeamId, year, month),
                    WardAPI.getWorkspaceSchedule(wardId, currentShiftTeamId, year, month).catch(() => null),
                ]);

                if (cancelled) return;

                const workspaceWorkflowStep = getShiftWorkflowStep(workspace);
                const shiftWorkflowStep = getShiftWorkflowStep(shift);
                const workspaceWorkflowStatus = getShiftWorkflowStatus(workspace);
                const shiftWorkflowStatus = getShiftWorkflowStatus(shift);
                const workflowStep = workspaceWorkflowStep ?? shiftWorkflowStep;
                const workflowStatus =
                    workspaceWorkflowStatus ??
                    shiftWorkflowStatus ??
                    getWorkflowStatusFromStep(workspaceWorkflowStep) ??
                    getWorkflowStatusFromStep(shiftWorkflowStep);
                const savedStep = loadDraftStep(wardId, currentShiftTeamId, year, month);
                const hasAssignments = !isDutyShiftWithoutAssignments(shift);
                const isOnboardingInitialSchedule = isInitialScheduleTarget(
                    onboardingScheduleTargetsRef.current,
                    year,
                    month,
                    currentShiftTeamId,
                );
                const shouldTreatAsConfirmed =
                    workflowStatus === 'CONFIRMED' ||
                    (isOnboardingInitialSchedule && hasAssignments) ||
                    (savedStep === 6 && hasAssignments && workflowStatus !== 'IN_PROGRESS');
                const nextShiftExists =
                    shouldTreatAsConfirmed
                        ? true
                        : workflowStatus === 'NOT_STARTED'
                        ? false
                        : workflowStatus === 'IN_PROGRESS' || workflowStatus === 'CONFIRMED'
                          ? true
                          : hasAssignments;
                const nextShiftFullyAssigned =
                    shouldTreatAsConfirmed
                        ? true
                        : workflowStatus === 'NOT_STARTED' || workflowStatus === 'IN_PROGRESS'
                          ? false
                          : isDutyShiftFullyAssigned(shift);

                let shouldRefreshProgress = false;

                if (shouldTreatAsConfirmed) {
                    saveDraftStep(wardId, currentShiftTeamId, year, month, 6);
                    bumpMaxReachedStep(wardId, currentShiftTeamId, year, month, 6);
                } else if (workflowStatus === 'NOT_STARTED') {
                    clearMakeShiftProgress(wardId, currentShiftTeamId, year, month);
                    shouldRefreshProgress = true;
                } else if (workflowStatus === 'IN_PROGRESS' && workflowStep !== null) {
                    const safeWorkflowStep = Math.min(workflowStep, 5) as 1 | 2 | 3 | 4 | 5;

                    saveDraftStep(wardId, currentShiftTeamId, year, month, safeWorkflowStep);
                    saveMaxReachedStep(wardId, currentShiftTeamId, year, month, safeWorkflowStep);
                    shouldRefreshProgress = true;
                }

                if (shouldRefreshProgress) {
                    setCurrentShiftTeamId(currentShiftTeamId);
                }

                setShiftExists(nextShiftExists);
                setShiftFullyAssigned(nextShiftFullyAssigned);
                setShiftStatus('success');
            } catch {
                if (!cancelled) {
                    setShiftStatus('error');
                    setShiftFullyAssigned(false);
                }
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [
        currentShiftTeamId,
        isCurrentShiftTeamReady,
        month,
        onboardingScheduleTargetsKey,
        reloadToken,
        setCurrentShiftTeamId,
        setShiftExists,
        setShiftFullyAssigned,
        setShiftStatus,
        wardId,
        year,
    ]);

    useEffect(() => {
        if (shiftStatus !== 'success' || !currentShiftTeamId) return;

        const saved = wardId && currentShiftTeamId ? loadDraftStep(wardId, currentShiftTeamId, year, month) : null;
        const shouldOpenConfirmedStep = shiftExists && shiftFullyAssigned;

        if (shouldOpenConfirmedStep) {
            const state = useMakeShiftStore.getState();

            if (state.phase !== 'stepping' || state.currentStep !== 6) {
                confirmSchedule();
            }

            return;
        }

        if (saved === 6 && !shiftFullyAssigned && wardId) {
            clearMakeShiftProgress(wardId, currentShiftTeamId, year, month);
            setCurrentShiftTeamId(currentShiftTeamId);
        }
    }, [
        confirmSchedule,
        currentShiftTeamId,
        month,
        shiftExists,
        shiftFullyAssigned,
        shiftStatus,
        setCurrentShiftTeamId,
        wardId,
        year,
    ]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!wardId || !currentShiftTeamId || !isCurrentShiftTeamReady) {
                editorRef.current.setDutyValidationInput(null);

                return;
            }

            try {
                const wardConstraint = await WardAPI.getWardConstraint(wardId, currentShiftTeamId);

                if (cancelled) return;

                editorRef.current.setDutyValidationInput({wardConstraint});
            } catch {
                if (!cancelled && shiftStatus !== 'pending') editorRef.current.setDutyValidationInput(null);
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [currentShiftTeamId, isCurrentShiftTeamReady, reloadToken, shiftStatus, wardId]);
}
