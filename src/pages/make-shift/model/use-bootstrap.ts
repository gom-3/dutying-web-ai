import {useEffect, useRef} from 'react';
import {useSearchParams} from 'react-router';
import {useShiftEditorCommands} from '@/features/shift-editor';
import WardAPI from '@/shared/api/ward';
import {useMakeShiftStore} from './make-shift-store';

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
        const hasValidQueryMonth = queryMonth !== null && queryMonth >= 1 && queryMonth <= 12;
        const nextYear = queryYear ?? now.getFullYear();
        const nextMonth = hasValidQueryMonth ? queryMonth : now.getMonth() + 1;

        initialQueryShiftTeamIdRef.current = queryShiftTeamId;
        setYearMonth({year: nextYear, month: nextMonth});
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

        run();

        return () => {
            cancelled = true;
        };
    }, [setCurrentShiftTeamId, setShiftExists, setShiftStatus, setShiftTeams, setShiftTeamsStatus, wardId]);

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

        run();

        return () => {
            cancelled = true;
        };
    }, [currentShiftTeamId, month, setShiftExists, setShiftStatus, wardId, year]);

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
                // constraint 로드는 실패해도 flow는 유지 (단, validator/constraints UI는 비활성화됨)
                if (!cancelled && shiftStatus !== 'pending') editorRef.current.setDutyValidationInput(null);
            }
        };

        run();

        return () => {
            cancelled = true;
        };
    }, [currentShiftTeamId, shiftStatus, wardId]);

    useEffect(() => {
        // MVP: 에디터 초기 doc은 데모 데이터로 시작 (이후 real shift->doc 빌드로 교체)
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const daysInMonth = new Date(year, month, 0).getDate();
        const columns = Array.from({length: daysInMonth}, (_, i) => {
            const d = String(i + 1).padStart(2, '0');
            const m = String(month).padStart(2, '0');

            return `${year}-${m}-${d}`;
        });
        const rows = Array.from({length: 8}, (_, idx) => ({
            workerId: String(idx + 1),
            cells: Array.from({length: daysInMonth}, () => null),
        }));
        const workerMeta: Record<string, {name: string}> = {};

        for (const r of rows) workerMeta[r.workerId] = {name: `간호사 ${r.workerId}`};

        editorRef.current.init({columns, rows, workerMeta});
        // validation input은 실제 wardConstraint 연결 시 editor.setDutyValidationInput(...)으로 주입
    }, [wardId]);
}
