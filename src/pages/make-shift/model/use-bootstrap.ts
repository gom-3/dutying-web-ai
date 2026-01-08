import {useEffect, useRef} from 'react';
import {useShiftEditorCommands} from '@/features/shift-editor';
import WardAPI from '@/shared/api/ward';
import {useMakeShiftStore} from './store';

export function useMakeShiftBootstrap(wardId: number | null) {
    const editor = useShiftEditorCommands();
    const editorRef = useRef(editor);

    editorRef.current = editor;

    const setShiftStatus = useMakeShiftStore((s) => s.setShiftStatus);
    const setShiftExists = useMakeShiftStore((s) => s.setShiftExists);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!wardId) {
                setShiftStatus('idle');
                setShiftExists(false);

                return;
            }

            setShiftStatus('pending');
            setShiftExists(false);

            try {
                // MVP: 첫 shiftTeam 기준으로 "현재 월 근무표 존재 여부"만 확인
                const teams = await WardAPI.getShiftTeams(wardId);
                const teamId = teams[0]?.shiftTeamId;

                if (!teamId) {
                    if (!cancelled) setShiftStatus('error');

                    return;
                }

                const now = new Date();
                const year = now.getFullYear();
                const month = now.getMonth() + 1;
                const shift = await WardAPI.getShift(wardId, teamId, year, month);

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
    }, [setShiftExists, setShiftStatus, wardId]);

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
