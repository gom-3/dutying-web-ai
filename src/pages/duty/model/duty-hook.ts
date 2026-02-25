import {useQuery} from '@tanstack/react-query';
import {useEffect, useMemo, useRef} from 'react';
import {useNavigate, useSearchParams} from 'react-router';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth/useAuth';
import {type TDutyDoc, useShiftEditorCommands, useShiftEditorKeyBindings, useShiftEditorStore} from '@/features/shift-editor';
import useLoadingUseCase from '@/features/ui/useLoading';
import {useMakeShiftStore} from '@/pages/make-shift/model/make-shift-store';
import {buildWorkKeyMap, docToWardShiftsDTO, shiftToDoc} from '@/pages/make-shift/model/shift-editor-adapter';
import WardAPI from '@/shared/api/ward';
import ROUTE from '@/shared/constant/path';
import {shiftToExcel} from '@/shared/util/shiftToExcel';
import {useDutyStore} from './duty-store';

function parsePositiveInt(raw: string | null): number | null {
    if (!raw) return null;

    const n = Number(raw);

    return Number.isInteger(n) && n > 0 ? n : null;
}

function cloneDoc(doc: TDutyDoc): TDutyDoc {
    return {
        columns: [...doc.columns],
        rows: doc.rows.map((row) => ({
            workerId: row.workerId,
            cells: [...row.cells],
        })),
        workerMeta: Object.fromEntries(Object.entries(doc.workerMeta).map(([workerId, meta]) => [workerId, {name: meta.name}])),
    };
}

export function useDutyHook() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const {
        state: {wardId},
    } = useAuth();
    const {setLoading} = useLoadingUseCase();
    const year = useDutyStore((s) => s.year);
    const month = useDutyStore((s) => s.month);
    const shiftTeams = useDutyStore((s) => s.shiftTeams);
    const currentShiftTeamId = useDutyStore((s) => s.currentShiftTeamId);
    const readonly = useDutyStore((s) => s.readonly);
    const shift = useDutyStore((s) => s.shift);
    const status = useDutyStore((s) => s.status);
    const setYearMonth = useDutyStore((s) => s.setYearMonth);
    const goPrevMonth = useDutyStore((s) => s.goPrevMonth);
    const goNextMonth = useDutyStore((s) => s.goNextMonth);
    const setShiftTeams = useDutyStore((s) => s.setShiftTeams);
    const setCurrentShiftTeamId = useDutyStore((s) => s.setCurrentShiftTeamId);
    const setReadonly = useDutyStore((s) => s.setReadonly);
    const setShift = useDutyStore((s) => s.setShift);
    const setStatus = useDutyStore((s) => s.setStatus);
    const setMakeShiftYearMonth = useMakeShiftStore((s) => s.setYearMonth);
    const setMakeShiftTeamId = useMakeShiftStore((s) => s.setCurrentShiftTeamId);
    const commands = useShiftEditorCommands();
    const doc = useShiftEditorStore((s) => s.doc);
    const editorRef = useRef<HTMLDivElement>(null);
    const snapshotRef = useRef<TDutyDoc | null>(null);
    const queryYear = useMemo(() => parsePositiveInt(searchParams.get('year')), [searchParams]);
    const queryMonth = useMemo(() => parsePositiveInt(searchParams.get('month')), [searchParams]);
    const queryShiftTeamId = useMemo(() => parsePositiveInt(searchParams.get('shiftTeamId')), [searchParams]);
    const shiftTeamsQuery = useQuery({
        ...wardQueryOptions.shiftTeams(wardId ?? -1),
        enabled: wardId !== null,
        staleTime: 1000 * 60 * 5,
    });
    const dutyQuery = useQuery({
        ...wardQueryOptions.duty(wardId ?? -1, currentShiftTeamId ?? -1, year, month),
        enabled: wardId !== null && currentShiftTeamId !== null,
        refetchOnWindowFocus: false,
    });
    const constraintQuery = useQuery({
        ...wardQueryOptions.constraint(wardId ?? -1, currentShiftTeamId ?? -1),
        enabled: wardId !== null && currentShiftTeamId !== null,
        staleTime: 1000 * 60 * 5,
    });
    const workKeyMap = useMemo(() => buildWorkKeyMap(shift ?? undefined), [shift]);
    const {onKeyDown, onPaste} = useShiftEditorKeyBindings({workKeyMap});
    const currentShiftTeamName = shiftTeams.find((team) => team.shiftTeamId === currentShiftTeamId)?.name ?? '선택한 팀';

    useEffect(() => {
        if (!queryYear || !queryMonth) return;

        setYearMonth({year: queryYear, month: queryMonth});
    }, [queryMonth, queryYear, setYearMonth]);

    useEffect(() => {
        if (!shiftTeamsQuery.data) return;

        setShiftTeams(shiftTeamsQuery.data);

        const prevSelectedId = useDutyStore.getState().currentShiftTeamId;
        const hasPrevSelected = prevSelectedId !== null && shiftTeamsQuery.data.some((team) => team.shiftTeamId === prevSelectedId);
        const hasQuerySelected = queryShiftTeamId !== null && shiftTeamsQuery.data.some((team) => team.shiftTeamId === queryShiftTeamId);
        const firstTeamId = shiftTeamsQuery.data[0]?.shiftTeamId ?? null;
        const nextTeamId = hasQuerySelected ? queryShiftTeamId : hasPrevSelected ? prevSelectedId : firstTeamId;

        setCurrentShiftTeamId(nextTeamId);
    }, [queryShiftTeamId, setCurrentShiftTeamId, setShiftTeams, shiftTeamsQuery.data]);

    useEffect(() => {
        if (dutyQuery.isPending) {
            setStatus('pending');

            return;
        }

        if (dutyQuery.isError) {
            setStatus('error');
            setShift(null);
            commands.init({columns: [], rows: [], workerMeta: {}});

            return;
        }

        if (!dutyQuery.data) return;

        setStatus('success');
        setShift(dutyQuery.data);
        commands.init(shiftToDoc(dutyQuery.data, year, month));
    }, [commands, dutyQuery.data, dutyQuery.isError, dutyQuery.isPending, month, setShift, setStatus, year]);
    useEffect(() => {
        if (!constraintQuery.data) {
            commands.setDutyValidationInput(null);

            return;
        }

        commands.setDutyValidationInput({wardConstraint: constraintQuery.data});
    }, [commands, constraintQuery.data]);

    const handleGoPrevMonth = () => {
        goPrevMonth();
        setReadonly(true);
    };
    const handleGoNextMonth = () => {
        goNextMonth();
        setReadonly(true);
    };
    const handleSelectShiftTeam = (shiftTeamId: number) => {
        setCurrentShiftTeamId(shiftTeamId);
        setReadonly(true);
    };
    const handleEnableEdit = () => {
        snapshotRef.current = cloneDoc(doc);
        setReadonly(false);
        editorRef.current?.focus();
    };
    const handleSaveEdit = async () => {
        if (!wardId || !shift) return;

        setLoading(true);

        try {
            const dto = docToWardShiftsDTO(doc, shift);

            await WardAPI.updateShifts(wardId, dto);
            snapshotRef.current = null;
            setReadonly(true);
            await dutyQuery.refetch();
        } finally {
            setLoading(false);
        }
    };
    const handleCancelEdit = () => {
        if (snapshotRef.current) {
            commands.init(snapshotRef.current);
        }

        snapshotRef.current = null;
        setReadonly(true);
    };
    const handleGoNextMonthMake = () => {
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;

        setMakeShiftYearMonth({year: nextYear, month: nextMonth});
        setMakeShiftTeamId(currentShiftTeamId);
        navigate(ROUTE.MAKE);
    };
    const handlePostShift = async () => {
        if (!wardId || !currentShiftTeamId) return;

        await WardAPI.postShift(wardId, currentShiftTeamId, year, month);
    };
    const handleExportExcel = () => {
        if (!shift) return;

        shiftToExcel(month, shift);
    };

    return {
        state: {
            year,
            month,
            shiftTeams,
            currentShiftTeamId,
            currentShiftTeamName,
            readonly,
            shift,
            status,
            doc,
        },
        refs: {
            editorRef,
        },
        handlers: {
            goPrevMonth: handleGoPrevMonth,
            goNextMonth: handleGoNextMonth,
            selectShiftTeam: handleSelectShiftTeam,
            enableEdit: handleEnableEdit,
            saveEdit: handleSaveEdit,
            cancelEdit: handleCancelEdit,
            goNextMonthMake: handleGoNextMonthMake,
            postShift: handlePostShift,
            exportExcel: handleExportExcel,
            onKeyDown,
            onPaste,
        },
    };
}

export type TDutyHook = ReturnType<typeof useDutyHook>;
