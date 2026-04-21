import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useEffect, useMemo, useRef} from 'react';
import {useNavigate, useSearchParams} from 'react-router';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import useLoadingUseCase from '@/features/loading';
import {
    buildWorkKeyMap,
    docToWardShiftsDTO,
    shiftToDoc,
    type TDutyDoc,
    useShiftEditorCommands,
    useShiftEditorKeyBindings,
    useShiftExcelExport,
    useShiftEditorStore,
} from '@/features/shift-editor';
import WardAPI from '@/shared/api/ward';
import {buildMakeShiftPath, getNextYearMonth} from './duty-navigation';
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
        fixedCells: {...doc.fixedCells},
        requestCells: {...doc.requestCells},
    };
}

const EMPTY_DUTY_DOC: TDutyDoc = {
    columns: [],
    rows: [],
    workerMeta: {},
    fixedCells: {},
    requestCells: {},
};

export function useDutyHook() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const {
        state: {wardId, isAuth, _loaded, accountMeStatus},
        actions: {handleGetAccountMe},
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
    const commands = useShiftEditorCommands();
    const doc = useShiftEditorStore((s) => s.doc);
    const editorRef = useRef<HTMLDivElement>(null);
    const snapshotRef = useRef<TDutyDoc | null>(null);
    const dutyQueryKey = wardQueryOptions.duty(wardId ?? -1, currentShiftTeamId ?? -1, year, month).queryKey;
    const queryYear = useMemo(() => parsePositiveInt(searchParams.get('year')), [searchParams]);
    const queryMonth = useMemo(() => parsePositiveInt(searchParams.get('month')), [searchParams]);
    const queryShiftTeamId = useMemo(() => parsePositiveInt(searchParams.get('shiftTeamId')), [searchParams]);
    const bootstrapStatus =
        !_loaded || (isAuth && wardId === null && (accountMeStatus === 'idle' || accountMeStatus === 'loading'))
            ? 'pending'
            : isAuth && wardId === null && accountMeStatus === 'error'
              ? 'error'
              : 'success';
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
    const {isExporting: isExportingExcel, exportExcel} = useShiftExcelExport({
        month,
        shift,
        disabled: !shift,
    });
    const currentShiftTeamName = shiftTeams.find((team) => team.shiftTeamId === currentShiftTeamId)?.name ?? '선택한 팀';
    const shiftTeamsStatus = shiftTeamsQuery.isPending ? 'pending' : shiftTeamsQuery.isError ? 'error' : 'success';

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
            commands.init(EMPTY_DUTY_DOC);
            commands.discardPersisted();

            return;
        }

        setStatus('success');

        const nextShift = dutyQuery.data ?? null;

        setShift(nextShift);

        if (!nextShift) {
            commands.init(EMPTY_DUTY_DOC);
            commands.discardPersisted();

            return;
        }

        commands.init(shiftToDoc(nextShift, year, month));
        commands.discardPersisted();
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
            commands.discardPersisted();
            await queryClient.invalidateQueries({queryKey: dutyQueryKey});
        } finally {
            setLoading(false);
        }
    };
    const handleCancelEdit = () => {
        if (snapshotRef.current) {
            commands.init(snapshotRef.current);
        }

        commands.discardPersisted();
        snapshotRef.current = null;
        setReadonly(true);
    };
    const navigateToMakeShift = (targetYear: number, targetMonth: number) => {
        navigate(buildMakeShiftPath({year: targetYear, month: targetMonth, shiftTeamId: currentShiftTeamId}));
    };
    const handleGoCurrentMonthMake = () => {
        navigateToMakeShift(year, month);
    };
    const handleGoNextMonthMake = () => {
        const {year: nextYear, month: nextMonth} = getNextYearMonth(year, month);

        navigateToMakeShift(nextYear, nextMonth);
    };
    const handlePostShift = async () => {
        if (!wardId || !currentShiftTeamId) return;

        await WardAPI.postShift(wardId, currentShiftTeamId, year, month);
        await queryClient.invalidateQueries({queryKey: dutyQueryKey});
    };
    const handleExportExcel = () => {
        void exportExcel();
    };
    const handleRetry = () => {
        if (wardId === null) {
            void handleGetAccountMe().catch(() => undefined);

            return;
        }

        void Promise.all([
            shiftTeamsQuery.refetch(),
            currentShiftTeamId !== null ? dutyQuery.refetch() : Promise.resolve(),
            currentShiftTeamId !== null ? constraintQuery.refetch() : Promise.resolve(),
        ]);
    };

    return {
        state: {
            year,
            month,
            bootstrapStatus,
            shiftTeams,
            currentShiftTeamId,
            currentShiftTeamName,
            shiftTeamsStatus,
            readonly,
            shift,
            status,
            isExportingExcel,
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
            goCurrentMonthMake: handleGoCurrentMonthMake,
            goNextMonthMake: handleGoNextMonthMake,
            postShift: handlePostShift,
            exportExcel: handleExportExcel,
            retry: handleRetry,
            onKeyDown,
            onPaste,
        },
    };
}

export type TDutyHook = ReturnType<typeof useDutyHook>;
