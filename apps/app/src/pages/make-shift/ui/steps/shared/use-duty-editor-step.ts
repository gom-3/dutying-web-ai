import {useQuery} from '@tanstack/react-query';
import {useEffect, useMemo, useRef} from 'react';
import {type TShift} from '@/entities';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {
    buildWorkKeyMap,
    getShiftEditorDraftStorageKey,
    isDutyShiftFullyAssigned,
    shiftToDoc,
    workspaceCellsToFixedCells,
    type TCellValue,
    type TDutyDoc,
    useShiftEditorCommands,
    useShiftEditorKeyBindings,
    useShiftEditorStore,
    useViolationMap,
} from '@/features/shift-editor';
import WardAPI from '@/shared/api/ward';
import {useMakeShiftStore} from '../../../model/make-shift-store';

function isSameDutyDocShape(a: TDutyDoc, b: TDutyDoc): boolean {
    if (a.columns.length !== b.columns.length || a.rows.length !== b.rows.length) return false;

    for (let i = 0; i < a.columns.length; i += 1) {
        if (a.columns[i] !== b.columns[i]) return false;
    }

    for (let i = 0; i < a.rows.length; i += 1) {
        if (a.rows[i]?.workerId !== b.rows[i]?.workerId) return false;
    }

    return true;
}

function getPreviousYearMonth(year: number, month: number): {year: number; month: number} {
    return month === 1 ? {year: year - 1, month: 12} : {year, month: month - 1};
}

function mergeLastCells(persisted: TCellValue[] | undefined, base: TCellValue[] | undefined): TCellValue[] | undefined {
    if (!persisted) return base?.slice();
    if (!base || base.length === 0) return persisted.slice();

    return base.map((_cell, index) => persisted[index] ?? null);
}

function deriveRequestCells(
    shift: TShift | undefined,
    year: number,
    month: number,
): Map<string, string> {
    if (!shift) return new Map();

    const idToShortName = new Map<number, string>();

    for (const t of shift.wardShiftTypes) {
        idToShortName.set(t.wardShiftTypeId, t.shortName);
    }

    const monthStr = String(month).padStart(2, '0');
    const result = new Map<string, string>();

    for (const division of shift.divisionShiftNurses) {
        for (const row of division) {
            if (!row.shiftNurse.isWorker) continue;

            const workerId = String(row.shiftNurse.shiftNurseId);

            row.wardReqShiftList.forEach((wardShiftTypeId, idx) => {
                if (wardShiftTypeId !== null) {
                    const day = String(shift.days[idx].day).padStart(2, '0');
                    const shortName = idToShortName.get(wardShiftTypeId);

                    if (shortName) {
                        result.set(`${workerId}|${year}-${monthStr}-${day}`, shortName);
                    }
                }
            });
        }
    }

    return result;
}

type TUseDutyEditorStepOptions = {
    onContextChanged?: () => void;
    hydratePreviousLastShifts?: boolean;
    editorInputDisabled?: boolean;
};

export function focusEditorWithoutScrolling(editor: HTMLDivElement | null) {
    editor?.focus({preventScroll: true});
}

export function useDutyEditorStep({
    onContextChanged,
    hydratePreviousLastShifts = false,
    editorInputDisabled = false,
}: TUseDutyEditorStepOptions = {}) {
    const {
        state: {wardId},
    } = useAuth();
    const year = useMakeShiftStore((s) => s.year);
    const month = useMakeShiftStore((s) => s.month);
    const currentShiftTeamId = useMakeShiftStore((s) => s.currentShiftTeamId);
    const enabled = wardId !== null && currentShiftTeamId !== null;

    const dutyQuery = useQuery({
        ...wardQueryOptions.duty(wardId ?? -1, currentShiftTeamId ?? -1, year, month),
        enabled,
    });

    const workspaceQuery = useQuery({
        queryKey: ['ward', wardId, 'shift-team', currentShiftTeamId, 'schedule-workspace', year, month],
        queryFn: () => WardAPI.getWorkspaceSchedule(wardId ?? -1, currentShiftTeamId ?? -1, year, month),
        enabled,
    });
    const previousYearMonth = useMemo(() => getPreviousYearMonth(year, month), [year, month]);
    const previousDutyQuery = useQuery({
        ...wardQueryOptions.duty(wardId ?? -1, currentShiftTeamId ?? -1, previousYearMonth.year, previousYearMonth.month),
        enabled: enabled && hydratePreviousLastShifts,
    });
    const previousConfirmedShift =
        hydratePreviousLastShifts && previousDutyQuery.data && isDutyShiftFullyAssigned(previousDutyQuery.data)
            ? previousDutyQuery.data
            : null;
    const isHydratingLastShifts = hydratePreviousLastShifts && previousDutyQuery.isLoading;
    const isHydratingWorkspace = enabled && workspaceQuery.isLoading && workspaceQuery.data === undefined;
    const isHydratingEditor = isHydratingLastShifts || isHydratingWorkspace;

    const setRulesHash = useShiftEditorStore((s) => s.setRulesHash);

    const editorDoc = useShiftEditorStore((s) => s.doc);
    const commands = useShiftEditorCommands();
    const editorRef = useRef<HTMLDivElement>(null);
    const workKeyMap = useMemo(() => buildWorkKeyMap(dutyQuery.data), [dutyQuery.data]);
    const {onKeyDown, onPasteCapture} = useShiftEditorKeyBindings({workKeyMap, disabled: editorInputDisabled});
    const {violationMap, teamViolations} = useViolationMap(editorDoc);
    const hydratedContextKeyRef = useRef<string | null>(null);
    const initialHydrationDoneRef = useRef(false);
    const lastHydratedDutyDataRef = useRef<typeof dutyQuery.data | null>(null);
    const currentContextKey = `${wardId ?? 'none'}:${currentShiftTeamId ?? 'none'}:${year}:${month}`;

    useEffect(() => {
        if (workspaceQuery.data?.rulesHash) {
            setRulesHash(workspaceQuery.data.rulesHash);
        }
    }, [workspaceQuery.data?.rulesHash, setRulesHash]);

    useEffect(() => {
        if (!dutyQuery.data || wardId === null || currentShiftTeamId === null || isHydratingEditor) return;

        const nextPersistenceKey = getShiftEditorDraftStorageKey({wardId, shiftTeamId: currentShiftTeamId, year, month});
        const currentPersistenceKey = commands.getCurrentPersistenceKey();

        if (currentPersistenceKey !== nextPersistenceKey) {
            commands.setPersistenceKey(nextPersistenceKey);
        }

        const hasContextChanged = hydratedContextKeyRef.current !== currentContextKey;
        const hasDutyDataChanged = lastHydratedDutyDataRef.current !== dutyQuery.data;
        const isStoreEmpty = editorDoc.columns.length === 0;

        if (!hasContextChanged && !hasDutyDataChanged && !isStoreEmpty && initialHydrationDoneRef.current) return;

        const baseDoc = shiftToDoc(dutyQuery.data, year, month, {previousConfirmedShift});
        const workspaceFixedCells = workspaceQuery.data ? workspaceCellsToFixedCells(workspaceQuery.data.wardShiftBase) : {};
        const requestValueMap = deriveRequestCells(dutyQuery.data, year, month);
        const requestCells: Record<string, true> = {};

        for (const [key, value] of requestValueMap.entries()) {
            requestCells[key] = true;

            const [workerId, date] = key.split('|');
            const row = baseDoc.rows.find((r) => r.workerId === workerId);
            const colIdx = baseDoc.columns.indexOf(date!);

            if (row && colIdx !== -1 && row.cells[colIdx] === null) {
                row.cells[colIdx] = value;
            }
        }

        const nextDoc: TDutyDoc = {...baseDoc, fixedCells: {...workspaceFixedCells}, requestCells};
        const persisted = commands.getPersisted();

        if (persisted && isSameDutyDocShape(persisted.doc, nextDoc)) {
            const mergedRows = persisted.doc.rows.map((row, rowIdx) => {
                const baseRow = baseDoc.rows[rowIdx];

                return {
                    ...row,
                    lastCells: mergeLastCells(row.lastCells, baseRow?.lastCells),
                    cells: row.cells.map((cell, colIdx) => {
                        const date = persisted.doc.columns[colIdx];
                        if (!date) return cell;

                        const key = `${row.workerId}|${date}`;
                        const requestValue = requestValueMap.get(key);

                        if (requestValue !== undefined) return requestValue;

                        if (persisted.doc.requestCells[key] === true && !requestCells[key]) {
                            return baseRow?.cells[colIdx] ?? null;
                        }

                        return cell;
                    }),
                };
            });

            commands.hydrate({
                ...persisted,
                doc: {
                    ...persisted.doc,
                    rows: mergedRows,
                    fixedCells: persisted.doc.fixedCells ?? {},
                    requestCells,
                },
            });

            commands.persistImmediate();
        } else {
            commands.init(nextDoc);
        }

        if (workspaceQuery.data?.rulesHash) {
            setRulesHash(workspaceQuery.data.rulesHash);
        }

        if (hasContextChanged) onContextChanged?.();

        hydratedContextKeyRef.current = currentContextKey;
        lastHydratedDutyDataRef.current = dutyQuery.data;
        initialHydrationDoneRef.current = true;
    }, [
        commands,
        currentContextKey,
        currentShiftTeamId,
        dutyQuery.data,
        workspaceQuery.data,
        isHydratingEditor,
        month,
        onContextChanged,
        previousConfirmedShift,
        setRulesHash,
        wardId,
        year,
        editorDoc.columns.length,
    ]);

    const focusEditor = () => {
        focusEditorWithoutScrolling(editorRef.current);
    };

    return {
        dutyQuery,
        editorDoc,
        editorRef,
        onKeyDown,
        onPasteCapture,
        violationMap,
        teamViolations,
        focusEditor,
        isHydratingLastShifts,
        isHydratingEditor,
    };
}
