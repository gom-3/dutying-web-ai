import {useQuery} from '@tanstack/react-query';
import {useEffect, useMemo, useRef} from 'react';
import {type TShift} from '@/entities';
import {wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {
    buildWorkKeyMap,
    buildViolationMap,
    shiftToDoc,
    type TDutyDoc,
    useShiftEditorCommands,
    useShiftEditorKeyBindings,
    useShiftEditorStore,
} from '@/features/shift-editor';
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
};

/**
 * `onContextChanged` should be passed as a stable reference such as `useCallback`.
 * This hook includes the callback in the hydration effect dependency list, so changing
 * the callback identity will re-run the effect that compares `hydratedContextKeyRef.current`.
 */
export function useDutyEditorStep({onContextChanged}: TUseDutyEditorStepOptions = {}) {
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
    const editorDoc = useShiftEditorStore((s) => s.doc);
    const violations = useShiftEditorStore((s) => s.violations);
    const commands = useShiftEditorCommands();
    const editorRef = useRef<HTMLDivElement>(null);
    const workKeyMap = useMemo(() => buildWorkKeyMap(dutyQuery.data), [dutyQuery.data]);
    const {onKeyDown, onPaste} = useShiftEditorKeyBindings({workKeyMap});
    const violationMap = useMemo(() => buildViolationMap(violations, editorDoc), [violations, editorDoc]);
    const hydratedContextKeyRef = useRef<string | null>(null);
    const currentContextKey = `${wardId ?? 'none'}:${currentShiftTeamId ?? 'none'}:${year}:${month}`;

    useEffect(() => {
        if (!dutyQuery.data) return;

        const baseDoc = shiftToDoc(dutyQuery.data, year, month);
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

        const nextDoc: TDutyDoc = {...baseDoc, requestCells};
        const persisted = commands.getPersisted();
        const hasContextChanged = hydratedContextKeyRef.current !== currentContextKey;

        if (persisted && isSameDutyDocShape(persisted.doc, nextDoc)) {
            // 보관된 데이터의 cells에도 신청 근무 데이터를 반영한다 (null인 경우만)
            for (const [key, value] of requestValueMap.entries()) {
                const [workerId, date] = key.split('|');
                const row = persisted.doc.rows.find((r) => r.workerId === workerId);
                const colIdx = persisted.doc.columns.indexOf(date!);

                if (row && colIdx !== -1 && row.cells[colIdx] === null) {
                    row.cells[colIdx] = value;
                }
            }

            commands.hydrate({
                ...persisted,
                doc: {...persisted.doc, requestCells},
            });

            if (hasContextChanged) onContextChanged?.();

            hydratedContextKeyRef.current = currentContextKey;

            return;
        }

        commands.init(nextDoc);

        if (hasContextChanged) onContextChanged?.();

        hydratedContextKeyRef.current = currentContextKey;
    }, [commands, currentContextKey, dutyQuery.data, month, onContextChanged, year]);

    const focusEditor = () => {
        editorRef.current?.focus();
    };

    return {
        dutyQuery,
        editorDoc,
        editorRef,
        onKeyDown,
        onPaste,
        violationMap,
        focusEditor,
    };
}
