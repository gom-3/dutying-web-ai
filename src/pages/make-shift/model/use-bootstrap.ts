import {useEffect, useRef} from 'react';
import {useShiftEditorCommands} from '@/features/shift-editor';
import WardAPI from '@/shared/api/ward';
import {useMakeShiftStore} from './make-shift-store';

export function useMakeShiftBootstrap(wardId: number | null) {
    const editor = useShiftEditorCommands();
    const editorRef = useRef(editor);

    editorRef.current = editor;

    const setShiftStatus = useMakeShiftStore((s) => s.setShiftStatus);
    const setShiftExists = useMakeShiftStore((s) => s.setShiftExists);
    const setShiftTeams = useMakeShiftStore((s) => s.setShiftTeams);
    const setCurrentShiftTeamId = useMakeShiftStore((s) => s.setCurrentShiftTeamId);
    const setYearMonth = useMakeShiftStore((s) => s.setYearMonth);
    const year = useMakeShiftStore((s) => s.year);
    const month = useMakeShiftStore((s) => s.month);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const shiftStatus = useMakeShiftStore((s) => s.shiftStatus);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!wardId) {
                setShiftStatus('idle');
                setShiftExists(false);
                setShiftTeams([]);
                setCurrentShiftTeamId(null);

                return;
            }

            try {
                const teams = await WardAPI.getShiftTeams(wardId);

                if (cancelled) return;

                setShiftTeams(teams);

                // init year/month to "now" once per ward entry (store already has defaults, but keep in sync)
                const now = new Date();

                setYearMonth({year: now.getFullYear(), month: now.getMonth() + 1});

                const firstTeamId = teams[0]?.shiftTeamId ?? null;
                const prevSelectedId = useMakeShiftStore.getState().currentShiftTeamId;
                const nextTeamId = prevSelectedId && teams.some((t) => t.shiftTeamId === prevSelectedId) ? prevSelectedId : firstTeamId;

                setCurrentShiftTeamId(nextTeamId);
            } catch {
                if (!cancelled) setShiftStatus('error');
            }
        };

        run();

        return () => {
            cancelled = true;
        };
    }, [setCurrentShiftTeamId, setShiftExists, setShiftStatus, setShiftTeams, setYearMonth, wardId]);

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

                setShiftStatus(shift ? 'success' : 'error');
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
