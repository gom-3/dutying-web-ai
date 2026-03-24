import {useQuery} from '@tanstack/react-query';
import {useEffect, useMemo, useRef} from 'react';
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

        const nextDoc = shiftToDoc(dutyQuery.data, year, month);
        const persisted = commands.getPersisted();
        const hasContextChanged = hydratedContextKeyRef.current !== currentContextKey;

        if (persisted && isSameDutyDocShape(persisted.doc, nextDoc)) {
            commands.hydrate(persisted);

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
