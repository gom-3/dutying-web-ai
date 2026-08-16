import {type TWorkspaceScheduleResponse} from '@dutying/api/ward';
import {useQuery} from '@tanstack/react-query';
import {useEffect, useMemo, useRef, useState} from 'react';
import {type TShift, type TWardShiftClassification, type TWardShiftType} from '@/entities';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {
    buildWardShiftTypeMaps,
    buildDutyShiftTypeRefs,
    buildWorkKeyMap,
    getShiftEditorDraftStorageKey,
    isDutyShiftFullyAssigned,
    shiftToDoc,
    workspaceCellsToFixedCells,
    type TCellValue,
    type TDutyDoc,
    type TDutyShiftTypeRef,
    type THistoryState,
    useShiftEditorCommands,
    useShiftEditorKeyBindings,
    useShiftEditorStore,
    useViolationMap,
} from '@/features/shift-editor';
import WardAPI from '@/shared/api/ward';
import {isMakeShiftTeamReadyForWard, useMakeShiftStore} from '../../../model/make-shift-store';
import {getCurrentTeamNurses, sortDutyDocByTeamNurseOrder} from '../../../model/nurse-order-sync';

function isSameDutyDocShape(a: TDutyDoc, b: TDutyDoc): boolean {
    if (a.columns.length !== b.columns.length || a.rows.length !== b.rows.length) return false;

    for (let i = 0; i < a.columns.length; i += 1) {
        if (a.columns[i] !== b.columns[i]) return false;
    }

    const aWorkerIds = new Set(a.rows.map((row) => row.workerId));
    const bWorkerIds = new Set(b.rows.map((row) => row.workerId));

    if (aWorkerIds.size !== bWorkerIds.size) return false;

    for (const workerId of aWorkerIds) {
        if (!bWorkerIds.has(workerId)) return false;
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

type TShiftTypeRebaseContext = {
    currentIdToType: Map<number, TWardShiftType>;
    currentShortNames: Set<string>;
    currentShiftTypes: TWardShiftType[];
    persistedTypeIdByShortName: Map<string, number>;
};

const LEGACY_CORE_SHIFT: Partial<Record<string, {classification: TWardShiftClassification; rotationSystem: 'THREE' | 'NONE'}>> = {
    D: {classification: 'DAY', rotationSystem: 'THREE'},
    E: {classification: 'EVENING', rotationSystem: 'THREE'},
    N: {classification: 'NIGHT', rotationSystem: 'THREE'},
    O: {classification: 'OFF', rotationSystem: 'NONE'},
};

function persistedTypeIdMap(refs: TDutyShiftTypeRef[] | undefined): Map<string, number> {
    return new Map((refs ?? []).map((ref) => [ref.shortName, ref.wardShiftTypeId]));
}

function resolveLegacyCoreShift(cell: string, currentShiftTypes: TWardShiftType[]): string | null {
    const legacy = LEGACY_CORE_SHIFT[cell.trim().toUpperCase()];

    if (!legacy) return null;

    const candidates = currentShiftTypes.filter((shiftType) => {
        if (shiftType.isActive === false || shiftType.classification !== legacy.classification) return false;

        const rotationSystem = shiftType.rotationSystem ?? (shiftType.isOff ? 'NONE' : 'THREE');

        return rotationSystem === legacy.rotationSystem;
    });
    const defaultCandidates = candidates.filter((shiftType) => shiftType.isDefault);

    if (defaultCandidates.length === 1) return defaultCandidates[0]!.shortName;

    return candidates.length === 1 ? candidates[0]!.shortName : null;
}

function rebasePersistedCell(cell: TCellValue, baseCell: TCellValue, context: TShiftTypeRebaseContext): TCellValue {
    if (cell === null || context.currentShortNames.has(cell)) return cell;

    const persistedTypeId = context.persistedTypeIdByShortName.get(cell);
    const currentType = persistedTypeId === undefined ? undefined : context.currentIdToType.get(persistedTypeId);

    if (currentType) return currentType.shortName;

    if (baseCell !== null && context.currentShortNames.has(baseCell)) return baseCell;

    const legacyCoreShift = resolveLegacyCoreShift(cell, context.currentShiftTypes);

    if (legacyCoreShift !== null) return legacyCoreShift;

    return baseCell;
}

function buildLatestAppliedHistoryCellValues(historyRaw: string, rowCount: number): Map<string, TCellValue> {
    let history: THistoryState;

    try {
        history = JSON.parse(historyRaw) as THistoryState;
    } catch {
        return new Map();
    }

    if (!Array.isArray(history.past)) return new Map();

    const latestValues = new Map<string, TCellValue>();

    let historicalRowIndexByCurrentRow = Array.from({length: rowCount}, (_value, index) => index);

    for (let entryIndex = history.past.length - 1; entryIndex >= 0; entryIndex -= 1) {
        const operations = history.past[entryIndex]?.tx?.ops;

        if (!Array.isArray(operations)) continue;

        for (let operationIndex = operations.length - 1; operationIndex >= 0; operationIndex -= 1) {
            const operation = operations[operationIndex];

            if (!operation) continue;

            if (operation.kind === 'setCells') {
                const currentRowIndexByHistoricalRow = new Map(
                    historicalRowIndexByCurrentRow.map((historicalRowIndex, currentRowIndex) => [historicalRowIndex, currentRowIndex]),
                );

                for (let cellIndex = operation.cells.length - 1; cellIndex >= 0; cellIndex -= 1) {
                    const historyCell = operation.cells[cellIndex];

                    if (!historyCell) continue;

                    const currentRowIndex = currentRowIndexByHistoricalRow.get(historyCell.row);

                    if (currentRowIndex === undefined) continue;

                    const key = `${currentRowIndex}|${historyCell.col}`;

                    if (!latestValues.has(key)) latestValues.set(key, historyCell.next);
                }

                continue;
            }

            historicalRowIndexByCurrentRow = historicalRowIndexByCurrentRow.map((historicalRowIndex) => {
                const rowIdentity = operation.nextOrder[historicalRowIndex];

                return rowIdentity === undefined ? -1 : operation.prevOrder.indexOf(rowIdentity);
            });
        }
    }

    return latestValues;
}

function rebaseDocRowsToCurrentShiftTypes(
    doc: TDutyDoc,
    baseDoc: TDutyDoc,
    historyRaw: string,
    context: TShiftTypeRebaseContext,
): TDutyDoc | null {
    let changed = doc.shiftTypeRefs !== baseDoc.shiftTypeRefs;

    const baseRowByWorkerId = new Map(baseDoc.rows.map((row) => [row.workerId, row]));
    const latestHistoryCellValues = buildLatestAppliedHistoryCellValues(historyRaw, doc.rows.length);
    const rows = doc.rows.map((row, rowIdx) => {
        const baseRow = baseRowByWorkerId.get(row.workerId) ?? baseDoc.rows[rowIdx];
        const cells = row.cells.map((cell, colIdx) => {
            const recoveredCell = cell === null ? latestHistoryCellValues.get(`${rowIdx}|${colIdx}`) : undefined;
            const candidateCell = cell ?? recoveredCell ?? null;
            const nextCell = rebasePersistedCell(candidateCell, baseRow?.cells[colIdx] ?? null, context);

            if (nextCell !== cell) changed = true;

            return nextCell;
        });

        return changed ? {...row, cells} : row;
    });

    if (!changed) return null;

    return {
        ...doc,
        rows,
        shiftTypeRefs: baseDoc.shiftTypeRefs,
    };
}

function deriveRequestCells(
    shift: TShift | undefined,
    requestShifts: TWorkspaceScheduleResponse['requestShifts'] | undefined,
): Map<string, string> {
    if (!shift || !requestShifts) return new Map();

    const idToShortName = new Map<number, string>();
    const workerIds = new Set<string>();

    for (const t of shift.wardShiftTypes) {
        idToShortName.set(t.wardShiftTypeId, t.shortName);
    }

    for (const division of shift.divisionShiftNurses) {
        for (const row of division) {
            if (!row.shiftNurse.isWorker) continue;

            workerIds.add(String(row.shiftNurse.shiftNurseId));
        }
    }

    const result = new Map<string, string>();

    for (const requestShift of requestShifts) {
        if (requestShift.isAccepted !== true) continue;

        const workerId = String(requestShift.shiftNurseId);

        if (!workerIds.has(workerId)) continue;

        const shortName = idToShortName.get(requestShift.wardShiftTypeId) ?? requestShift.shiftCode;

        if (shortName) {
            result.set(`${workerId}|${requestShift.date}`, shortName);
        }
    }

    return result;
}

function excludeRequestCellsFromFixedCells(fixedCells: Record<string, true>, requestCells: Record<string, true>): Record<string, true> {
    const nextFixedCells: Record<string, true> = {};

    for (const key of Object.keys(fixedCells)) {
        if (requestCells[key] === true) continue;

        nextFixedCells[key] = true;
    }

    return nextFixedCells;
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
    const storeWardId = useMakeShiftStore((s) => s.wardId);
    const shiftTeams = useMakeShiftStore((s) => s.shiftTeams);
    const shiftTeamsStatus = useMakeShiftStore((s) => s.shiftTeamsStatus);
    const currentTeamNurses = useMemo(() => getCurrentTeamNurses(shiftTeams, currentShiftTeamId), [currentShiftTeamId, shiftTeams]);
    const enabled = isMakeShiftTeamReadyForWard({wardId: storeWardId, shiftTeams, shiftTeamsStatus}, wardId, currentShiftTeamId);
    const dutyQuery = useQuery({
        ...wardQueryOptions.duty(wardId ?? -1, currentShiftTeamId ?? -1, year, month),
        enabled,
    });
    const workspaceQuery = useQuery({
        queryKey: ['ward', wardId, 'shift-team', currentShiftTeamId, 'schedule-workspace', year, month],
        queryFn: () => WardAPI.getWorkspaceSchedule(wardId ?? -1, currentShiftTeamId ?? -1, year, month),
        enabled,
        // 확정 후 4단계로 돌아오면 캐시에는 확정 전 workspace가 남아 있을 수 있다.
        // 고정/신청근무 핀은 workspace가 최신 상태가 된 뒤에만 에디터에 반영한다.
        refetchOnMount: 'always',
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
    const hydratedDraftRevisionRef = useRef<number | null>(null);
    const currentContextKey = `${wardId ?? 'none'}:${currentShiftTeamId ?? 'none'}:${year}:${month}`;
    const [hydratedEditorContextKey, setHydratedEditorContextKey] = useState<string | null>(null);
    const isHydratingLastShifts = hydratePreviousLastShifts && previousDutyQuery.isLoading;
    const isHydratingWorkspace = enabled && workspaceQuery.isFetching;
    const isWaitingForEditorSources = isHydratingLastShifts || isHydratingWorkspace;
    const isAwaitingEditorHydration =
        enabled && dutyQuery.data !== undefined && !isWaitingForEditorSources && hydratedEditorContextKey !== currentContextKey;
    const isHydratingEditor = isWaitingForEditorSources || isAwaitingEditorHydration;

    useEffect(() => {
        if (workspaceQuery.data?.rulesHash) {
            setRulesHash(workspaceQuery.data.rulesHash);
        }
    }, [workspaceQuery.data?.rulesHash, setRulesHash]);

    useEffect(() => {
        if (!dutyQuery.data || wardId === null || currentShiftTeamId === null || isWaitingForEditorSources) return;

        const nextPersistenceKey = getShiftEditorDraftStorageKey({wardId, shiftTeamId: currentShiftTeamId, year, month});
        const currentPersistenceKey = commands.getCurrentPersistenceKey();

        if (currentPersistenceKey !== nextPersistenceKey) {
            commands.setPersistenceKey(nextPersistenceKey);
        }

        const hasContextChanged = hydratedContextKeyRef.current !== currentContextKey;
        const hasDutyDataChanged = lastHydratedDutyDataRef.current !== dutyQuery.data;
        const isStoreEmpty = editorDoc.columns.length === 0;
        const hasLocalChangesSinceHydration =
            !hasContextChanged &&
            initialHydrationDoneRef.current &&
            hydratedDraftRevisionRef.current !== null &&
            useShiftEditorStore.getState().draftRevision > hydratedDraftRevisionRef.current;
        const baseDoc = {
            ...sortDutyDocByTeamNurseOrder(shiftToDoc(dutyQuery.data, year, month, {previousConfirmedShift}), currentTeamNurses),
            shiftTypeRefs: buildDutyShiftTypeRefs(dutyQuery.data),
        };
        const currentTypeMaps = buildWardShiftTypeMaps(dutyQuery.data);
        const currentShortNames = new Set(currentTypeMaps.shortNameToType.keys());

        if (!hasContextChanged && hasDutyDataChanged && hasLocalChangesSinceHydration && !isStoreEmpty) {
            const rebasedDoc = rebaseDocRowsToCurrentShiftTypes(
                editorDoc,
                baseDoc,
                JSON.stringify(useShiftEditorStore.getState().history),
                {
                    currentIdToType: currentTypeMaps.idToType,
                    currentShortNames,
                    currentShiftTypes: dutyQuery.data.wardShiftTypes,
                    persistedTypeIdByShortName: persistedTypeIdMap(editorDoc.shiftTypeRefs),
                },
            );

            if (rebasedDoc) {
                const orderedRebasedDoc = sortDutyDocByTeamNurseOrder(rebasedDoc, currentTeamNurses);

                commands.hydrate({
                    doc: orderedRebasedDoc,
                    history: JSON.stringify(useShiftEditorStore.getState().history),
                    scheduleViolations: {validationSnapshot: null},
                    savedAt: Date.now(),
                });
                commands.persistImmediate();
            }

            lastHydratedDutyDataRef.current = dutyQuery.data;
            setHydratedEditorContextKey(currentContextKey);

            return;
        }

        if (!hasContextChanged && !hasDutyDataChanged && !isStoreEmpty && initialHydrationDoneRef.current) {
            setHydratedEditorContextKey(currentContextKey);

            return;
        }

        const requestValueMap = deriveRequestCells(dutyQuery.data, workspaceQuery.data?.requestShifts);
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

        const workspaceFixedCells = excludeRequestCellsFromFixedCells(
            workspaceQuery.data ? workspaceCellsToFixedCells(workspaceQuery.data.wardShiftBase) : {},
            requestCells,
        );
        const nextDoc: TDutyDoc = {...baseDoc, fixedCells: {...workspaceFixedCells}, requestCells};
        const persisted = commands.getPersisted();

        if (persisted && isSameDutyDocShape(persisted.doc, nextDoc)) {
            const rebaseContext: TShiftTypeRebaseContext = {
                currentIdToType: currentTypeMaps.idToType,
                currentShortNames,
                currentShiftTypes: dutyQuery.data.wardShiftTypes,
                persistedTypeIdByShortName: persistedTypeIdMap(persisted.doc.shiftTypeRefs),
            };
            const persistedRowByWorkerId = new Map(persisted.doc.rows.map((row) => [row.workerId, row]));
            const latestHistoryCellValues = buildLatestAppliedHistoryCellValues(persisted.history, persisted.doc.rows.length);
            const mergedRows = baseDoc.rows.map((baseRow) => {
                const row = persistedRowByWorkerId.get(baseRow.workerId);

                if (!row) return baseRow;

                return {
                    ...row,
                    lastCells: mergeLastCells(row.lastCells, baseRow.lastCells),
                    cells: row.cells.map((cell, colIdx) => {
                        const date = persisted.doc.columns[colIdx];

                        if (!date) return cell;

                        const key = `${row.workerId}|${date}`;
                        const requestValue = requestValueMap.get(key);

                        if (requestValue !== undefined) return requestValue;

                        if (persisted.doc.requestCells[key] === true && !requestCells[key]) {
                            return baseRow.cells[colIdx] ?? null;
                        }

                        const persistedRowIndex = persisted.doc.rows.indexOf(row);
                        const recoveredCell = cell === null ? latestHistoryCellValues.get(`${persistedRowIndex}|${colIdx}`) : undefined;

                        return rebasePersistedCell(cell ?? recoveredCell ?? null, baseRow.cells[colIdx] ?? null, rebaseContext);
                    }),
                };
            });

            commands.hydrate({
                ...persisted,
                doc: {
                    ...persisted.doc,
                    rows: mergedRows,
                    shiftTypeRefs: baseDoc.shiftTypeRefs,
                    fixedCells: excludeRequestCellsFromFixedCells(persisted.doc.fixedCells ?? {}, requestCells),
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
        hydratedDraftRevisionRef.current = useShiftEditorStore.getState().draftRevision;
        setHydratedEditorContextKey(currentContextKey);
    }, [
        commands,
        currentContextKey,
        currentShiftTeamId,
        dutyQuery.data,
        workspaceQuery.data,
        isWaitingForEditorSources,
        month,
        onContextChanged,
        previousConfirmedShift,
        setRulesHash,
        wardId,
        year,
        editorDoc.columns.length,
        currentTeamNurses,
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
