import {useEffect, useRef} from 'react';
import {useSearchParams} from 'react-router';
import {useShiftEditorCommands} from '@/features/shift-editor';
import WardAPI from '@/shared/api/ward';
import {loadPersistedStep, loadPersistedYearMonth, useMakeShiftStore} from './make-shift-store';

function parsePositiveInt(raw: string | null): number | null {
    if (!raw) return null;

    const n = Number(raw);

    return Number.isInteger(n) && n > 0 ? n : null;
}

export function useMakeShiftBootstrap(wardId: number | null) {
    const [searchParams] = useSearchParams();
    const editor = useShiftEditorCommands();
    const editorRef = useRef(editor);
    const initializedWardIdRef = useRef<number | null>(null);
    const initialQueryShiftTeamIdRef = useRef<number | null>(null);

    editorRef.current = editor;

    const setShiftStatus = useMakeShiftStore((s) => s.setShiftStatus);
    const setShiftExists = useMakeShiftStore((s) => s.setShiftExists);
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
    const startFromStep = useMakeShiftStore((s) => s.startFromStep);

    useEffect(() => {
        if (isHydrated || !wardId) return;

        const savedStep = loadPersistedStep();
        const savedYearMonth = loadPersistedYearMonth();

        if (savedYearMonth && !searchParams.has('year') && !searchParams.has('month')) {
            setYearMonth(savedYearMonth);
        }

        if (savedStep) {
            // 이전에 작업 중이던 단계가 있다면 해당 단계로 바로 진입하고 복구 모달을 띄운다.
            startFromStep({step: savedStep, openRestoreDraftModal: true});
        }

        setHydrated();
    }, [isHydrated, startFromStep, wardId, setHydrated, searchParams, setYearMonth]);

    useEffect(() => {
        if (!wardId) {
            initializedWardIdRef.current = null;
            initialQueryShiftTeamIdRef.current = null;

            return;
        }

        if (initializedWardIdRef.current === wardId) return;

        initializedWardIdRef.current = wardId;

        const now = new Date();
        const queryYear = parsePositiveInt(searchParams.get('year'));
        const queryMonth = parsePositiveInt(searchParams.get('month'));
        const queryShiftTeamId = parsePositiveInt(searchParams.get('shiftTeamId'));

        if (queryYear !== null || queryMonth !== null) {
            const hasValidQueryMonth = queryMonth !== null && queryMonth >= 1 && queryMonth <= 12;
            const nextYear = queryYear ?? now.getFullYear();
            const nextMonth = hasValidQueryMonth ? queryMonth : now.getMonth() + 1;

            setYearMonth({year: nextYear, month: nextMonth});
        }

        initialQueryShiftTeamIdRef.current = queryShiftTeamId;
    }, [searchParams, setYearMonth, wardId]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!wardId) {
                setShiftTeamsStatus('idle');
                setShiftStatus('idle');
                setShiftExists(false);
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
    }, [reloadToken, setCurrentShiftTeamId, setShiftExists, setShiftStatus, setShiftTeams, setShiftTeamsStatus, wardId]);

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
        let cancelled = false;

        const run = async () => {
            if (!wardId || !currentShiftTeamId) {
                setShiftStatus('idle');
                setShiftExists(false);

                return;
            }

            setShiftStatus('pending');
            setShiftExists(false);

            try {
                const shift = await WardAPI.getShift(wardId, currentShiftTeamId, year, month);

                if (cancelled) return;

                setShiftStatus('success');
                setShiftExists(Boolean(shift));
            } catch {
                if (!cancelled) setShiftStatus('error');
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [currentShiftTeamId, month, reloadToken, setShiftExists, setShiftStatus, wardId, year]);

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
