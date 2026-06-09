import {useEffect, useMemo, useRef} from 'react';
import {useSearchParams} from 'react-router';
import {isDutyShiftFullyAssigned, isDutyShiftWithoutAssignments, useShiftEditorCommands} from '@/features/shift-editor';
import WardAPI from '@/shared/api/ward';
import {getCalendarYearMonthNow} from '@/shared/lib/shift-calendar-month-policy';
import {bumpMaxReachedStep, clearMakeShiftProgress, loadDraftStep, saveDraftStep} from './make-shift-progress-storage';
import {clearPersistedStep, loadPersistedStep, loadPersistedYearMonth, useMakeShiftStore} from './make-shift-store';

function parsePositiveInt(raw: string | null): number | null {
    if (!raw) return null;

    const n = Number(raw);

    return Number.isInteger(n) && n > 0 ? n : null;
}

type TConfirmInitialScheduleTarget = {
    year: number;
    month: number;
    shiftTeamId?: number;
};

type TUseMakeShiftBootstrapOptions = {
    confirmInitialSchedule?: TConfirmInitialScheduleTarget | null;
    confirmInitialSchedules?: TConfirmInitialScheduleTarget[] | null;
};

const getInitialScheduleTargetsKey = (targets: TConfirmInitialScheduleTarget[]) =>
    targets.map((target) => `${target.year}:${target.month}:${target.shiftTeamId ?? '*'}`).join('|');

export function useMakeShiftBootstrap(wardId: number | null, options: TUseMakeShiftBootstrapOptions = {}) {
    const [searchParams] = useSearchParams();
    const {confirmInitialSchedule = null, confirmInitialSchedules = null} = options;
    const confirmInitialScheduleTargets = useMemo(() => {
        if (confirmInitialSchedules && confirmInitialSchedules.length > 0) {
            return confirmInitialSchedules;
        }

        return confirmInitialSchedule ? [confirmInitialSchedule] : [];
    }, [confirmInitialSchedule, confirmInitialSchedules]);
    const primaryConfirmInitialSchedule = confirmInitialScheduleTargets[0] ?? null;
    const confirmInitialScheduleTargetsKey = getInitialScheduleTargetsKey(confirmInitialScheduleTargets);
    const confirmInitialScheduleTargetsRef = useRef(confirmInitialScheduleTargets);
    const editor = useShiftEditorCommands();
    const editorRef = useRef(editor);
    const initializedWardIdRef = useRef<number | null>(null);
    const initialQueryShiftTeamIdRef = useRef<number | null>(null);

    confirmInitialScheduleTargetsRef.current = confirmInitialScheduleTargets;
    editorRef.current = editor;

    const setShiftStatus = useMakeShiftStore((s) => s.setShiftStatus);
    const setShiftExists = useMakeShiftStore((s) => s.setShiftExists);
    const setShiftFullyAssigned = useMakeShiftStore((s) => s.setShiftFullyAssigned);
    const setShiftTeams = useMakeShiftStore((s) => s.setShiftTeams);
    const setShiftTeamsStatus = useMakeShiftStore((s) => s.setShiftTeamsStatus);
    const setCurrentShiftTeamId = useMakeShiftStore((s) => s.setCurrentShiftTeamId);
    const setYearMonth = useMakeShiftStore((s) => s.setYearMonth);
    const shiftTeams = useMakeShiftStore((s) => s.shiftTeams);
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

    useEffect(() => {
        setWardId(wardId);
    }, [wardId, setWardId]);

    useEffect(() => {
        if (isHydrated || !wardId) return;

        const hasExplicitYearMonth = searchParams.has('year') || searchParams.has('month');

        if (primaryConfirmInitialSchedule) {
            setYearMonth({year: primaryConfirmInitialSchedule.year, month: primaryConfirmInitialSchedule.month});
        } else if (!hasExplicitYearMonth) {
            setYearMonth(getCalendarYearMonthNow());
        }

        setHydrated();
    }, [isHydrated, primaryConfirmInitialSchedule, wardId, setHydrated, searchParams, setYearMonth]);

    useEffect(() => {
        if (!wardId || !isHydrated || !currentShiftTeamId) return;

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
    }, [currentShiftTeamId, isHydrated, month, searchParams, setCurrentShiftTeamId, wardId, year]);

    useEffect(() => {
        if (!wardId) {
            initializedWardIdRef.current = null;
            initialQueryShiftTeamIdRef.current = null;

            return;
        }

        if (initializedWardIdRef.current === wardId) return;

        initializedWardIdRef.current = wardId;

        const currentCalendarYearMonth = getCalendarYearMonthNow();
        const queryYear = parsePositiveInt(searchParams.get('year'));
        const queryMonth = parsePositiveInt(searchParams.get('month'));
        const queryShiftTeamId = parsePositiveInt(searchParams.get('shiftTeamId'));
        const targetYear = primaryConfirmInitialSchedule?.year ?? queryYear;
        const targetMonth = primaryConfirmInitialSchedule?.month ?? queryMonth;
        const targetShiftTeamId = primaryConfirmInitialSchedule?.shiftTeamId ?? queryShiftTeamId;

        if (targetYear !== null || targetMonth !== null) {
            const hasValidTargetMonth = targetMonth !== null && targetMonth >= 1 && targetMonth <= 12;
            const nextYear = targetYear ?? currentCalendarYearMonth.year;
            const nextMonth = hasValidTargetMonth ? targetMonth : currentCalendarYearMonth.month;

            setYearMonth({year: nextYear, month: nextMonth});
        }

        initialQueryShiftTeamIdRef.current = targetShiftTeamId;
    }, [primaryConfirmInitialSchedule, searchParams, setYearMonth, wardId]);

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
        if (!wardId) return;

        const firstTeamId = shiftTeams[0]?.shiftTeamId ?? null;
        const prevSelectedId = useMakeShiftStore.getState().currentShiftTeamId;
        const queryShiftTeamId = initialQueryShiftTeamIdRef.current;
        const hasPrevSelected = prevSelectedId !== null && shiftTeams.some((team) => team.shiftTeamId === prevSelectedId);
        const hasQuerySelected = queryShiftTeamId !== null && shiftTeams.some((team) => team.shiftTeamId === queryShiftTeamId);
        const nextTeamId = hasQuerySelected ? queryShiftTeamId : hasPrevSelected ? prevSelectedId : firstTeamId;

        setCurrentShiftTeamId(nextTeamId);
    }, [setCurrentShiftTeamId, shiftTeams, wardId]);

    useEffect(() => {
        const targets = confirmInitialScheduleTargetsRef.current;

        if (!wardId || targets.length === 0 || shiftTeams.length === 0) return;

        const availableShiftTeamIds = new Set(shiftTeams.map((team) => team.shiftTeamId));

        let shouldRefreshCurrentTeamProgress = false;

        targets.forEach((target) => {
            if (typeof target.shiftTeamId !== 'number' || !availableShiftTeamIds.has(target.shiftTeamId)) {
                return;
            }

            saveDraftStep(wardId, target.shiftTeamId, target.year, target.month, 6);
            bumpMaxReachedStep(wardId, target.shiftTeamId, target.year, target.month, 6);

            const state = useMakeShiftStore.getState();

            if (
                state.currentShiftTeamId === target.shiftTeamId &&
                state.year === target.year &&
                state.month === target.month &&
                state.maxReachedStep !== 6
            ) {
                shouldRefreshCurrentTeamProgress = true;
            }
        });

        if (shouldRefreshCurrentTeamProgress) {
            setCurrentShiftTeamId(useMakeShiftStore.getState().currentShiftTeamId);
        }
    }, [confirmInitialScheduleTargetsKey, setCurrentShiftTeamId, shiftTeams, wardId]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!wardId || !currentShiftTeamId) {
                setShiftStatus('idle');
                setShiftExists(false);
                setShiftFullyAssigned(false);

                return;
            }

            setShiftStatus('pending');
            setShiftExists(false);
            setShiftFullyAssigned(false);

            try {
                const shift = await WardAPI.getShift(wardId, currentShiftTeamId, year, month);

                if (cancelled) return;

                setShiftStatus('success');
                // 근무표 존재: 최소 1칸 이상 배정이 있을 때만 true (`/duty`와 동일 — `isDutyShiftWithoutAssignments` 역).
                setShiftExists(!isDutyShiftWithoutAssignments(shift));
                setShiftFullyAssigned(isDutyShiftFullyAssigned(shift));
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
    }, [currentShiftTeamId, month, reloadToken, setShiftExists, setShiftFullyAssigned, setShiftStatus, wardId, year]);

    useEffect(() => {
        if (shiftStatus !== 'success' || !currentShiftTeamId) return;

        const saved = wardId && currentShiftTeamId ? loadDraftStep(wardId, currentShiftTeamId, year, month) : null;
        const isConfirmInitialScheduleTarget = confirmInitialScheduleTargetsRef.current.some(
            (target) =>
                target.year === year &&
                target.month === month &&
                (target.shiftTeamId === undefined || target.shiftTeamId === currentShiftTeamId),
        );

        if (isConfirmInitialScheduleTarget && shiftExists) {
            const state = useMakeShiftStore.getState();

            if (state.phase !== 'stepping' || state.currentStep !== 6) {
                confirmSchedule();
            }

            return;
        }

        if (saved === 6 && !shiftExists && !shiftFullyAssigned && wardId) {
            clearMakeShiftProgress(wardId, currentShiftTeamId, year, month);
            setCurrentShiftTeamId(currentShiftTeamId);
        }
    }, [
        confirmInitialScheduleTargetsKey,
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
            if (!wardId || !currentShiftTeamId) {
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
    }, [currentShiftTeamId, reloadToken, shiftStatus, wardId]);
}
