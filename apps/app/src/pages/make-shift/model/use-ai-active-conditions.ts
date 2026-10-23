import type {TScheduleMonthRequestRes, TShiftConstraintRuleResponse} from '@dutying/api/ward';
import {useCallback, useEffect, useRef, useState} from 'react';
import i18n from '@/i18n';
import WardAPI from '@/shared/api/ward';

export type TAiWardCondition = {id: string; label: string};
type TScope = {
    wardId: number;
    teamId: number;
    year: number;
    month: number;
    enabled: boolean;
    onChanged?: () => Promise<void> | void;
};
type TState = {
    scope: string;
    wardRules: TAiWardCondition[];
    requests: TScheduleMonthRequestRes[];
    loading: boolean;
    error: boolean;
};

function wardConditions(rules: TShiftConstraintRuleResponse[]): TAiWardCondition[] {
    return rules
        .filter((rule) => rule.selected !== false)
        .map((rule, index) => ({
            id:
                rule.shiftConstraintRuleId != null
                    ? `rule:${rule.shiftConstraintRuleId}`
                    : `rule:${rule.templateCode}:${rule.sortOrder}:${index}`,
            label: rule.displayText?.trim().length ? rule.displayText.trim() : i18n.t('aiAutofillUi.activeConditions.scheduleCondition'),
        }));
}

/** The two sources retain their own identifiers; removing an AI request never edits ward rules. */
export function useAiActiveConditions({wardId, teamId, year, month, enabled, onChanged}: TScope) {
    const scope = `${wardId}:${teamId}:${year}:${month}:${enabled}`;
    const currentScope = useRef(scope);
    const sequence = useRef(0);
    const mounted = useRef(true);
    const changed = useRef(onChanged);
    const removed = useRef(new Map<string, Set<number>>());
    const mutation = useRef<{scope: string; id: number; promise?: Promise<void>} | null>(null);
    const [removal, setRemoval] = useState<{scope: string; id: number} | null>(null);
    const [state, setState] = useState<TState>({scope: '', wardRules: [], requests: [], loading: enabled, error: false});

    currentScope.current = scope;
    changed.current = onChanged;

    const reloadWithResult = useCallback(async () => {
        if (!enabled || !mounted.current || currentScope.current !== scope) return false;

        const request = ++sequence.current;

        setState((previous) => ({
            ...(previous.scope === scope ? previous : {scope, wardRules: [], requests: []}),
            loading: true,
            error: false,
        }));

        const [wardResult, requestResult] = await Promise.allSettled([
            Promise.resolve()
                .then(() => WardAPI.getShiftConstraintRules(wardId, teamId))
                .then((result) => {
                    if (!result || !Array.isArray(result.rules)) throw new Error('Conditions are unavailable');

                    return result;
                }),
            Promise.resolve()
                .then(() => WardAPI.getScheduleMonthRequests(wardId, teamId, year, month))
                .then((result) => {
                    if (!result || !Array.isArray(result.requests)) throw new Error('AI conditions are unavailable');

                    return result;
                }),
        ]);

        if (!mounted.current || currentScope.current !== scope || sequence.current !== request) return false;

        if (requestResult.status === 'fulfilled') {
            const hidden = removed.current.get(scope);

            hidden?.forEach((id) => {
                if (!requestResult.value.requests.some((condition) => condition.id === id && condition.status === 'ACTIVE'))
                    hidden.delete(id);
            });
        }

        setState((previous) => ({
            scope,
            wardRules: wardResult.status === 'fulfilled' ? wardConditions(wardResult.value.rules ?? []) : previous.wardRules,
            requests: (requestResult.status === 'fulfilled' ? (requestResult.value.requests ?? []) : previous.requests).filter(
                (condition) => condition.status === 'ACTIVE' && !removed.current.get(scope)?.has(condition.id),
            ),
            loading: false,
            error: wardResult.status === 'rejected' || requestResult.status === 'rejected',
        }));

        return wardResult.status === 'fulfilled' && requestResult.status === 'fulfilled';
    }, [enabled, scope, wardId, teamId, year, month]);
    const reload = useCallback(async () => {
        await reloadWithResult();
    }, [reloadWithResult]);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
            sequence.current += 1;
        };
    }, []);
    useEffect(() => {
        mutation.current = null;
        setRemoval(null);
        setState({scope, wardRules: [], requests: [], loading: enabled, error: false});
        void reload();

        return () => {
            sequence.current += 1;
        };
    }, [scope, enabled, reload]);

    const removeRequest = useCallback(
        (id: number): Promise<void> => {
            if (!enabled || !mounted.current || currentScope.current !== scope)
                return Promise.reject(new Error('Condition scope is unavailable'));

            if (mutation.current?.scope === scope) {
                if (mutation.current.id === id && mutation.current.promise) return mutation.current.promise;

                return Promise.reject(new Error('Another condition is being removed'));
            }

            const pending = {scope, id} as {scope: string; id: number; promise?: Promise<void>};

            mutation.current = pending;
            setRemoval({scope, id});

            const promise = (async () => {
                try {
                    await WardAPI.updateScheduleMonthRequest(wardId, teamId, id, {status: 'DISABLED'});

                    const hidden = removed.current.get(scope) ?? new Set<number>();

                    hidden.add(id);
                    removed.current.set(scope, hidden);

                    if (!mounted.current || currentScope.current !== scope) return;

                    setState((previous) =>
                        previous.scope === scope
                            ? {...previous, requests: previous.requests.filter((condition) => condition.id !== id)}
                            : previous,
                    );

                    const updates = await Promise.allSettled([
                        reload(),
                        Promise.resolve().then(() => {
                            if (mounted.current && currentScope.current === scope) return changed.current?.();
                        }),
                    ]);

                    if (updates.some((result) => result.status === 'rejected') && mounted.current && currentScope.current === scope)
                        setState((previous) => (previous.scope === scope ? {...previous, error: true} : previous));
                } finally {
                    if (mutation.current === pending) mutation.current = null;

                    if (mounted.current && currentScope.current === scope) setRemoval(null);
                }
            })();

            pending.promise = promise;

            return promise;
        },
        [enabled, scope, wardId, teamId, reload],
    );
    const refreshAfterRuleChange = useCallback(async () => {
        if (!enabled || !mounted.current || currentScope.current !== scope) return;

        const updates = await Promise.allSettled([reloadWithResult(), Promise.resolve().then(() => changed.current?.())]);
        const failed = updates.find((result) => result.status === 'rejected');

        if (failed?.status === 'rejected') throw failed.reason;

        if (updates[0].status === 'fulfilled' && !updates[0].value) throw new Error('Could not refresh applied conditions');
    }, [enabled, reloadWithResult, scope]);
    const visible = enabled && state.scope === scope;

    return {
        wardRules: visible ? state.wardRules : [],
        requests: visible ? state.requests : [],
        loading: enabled && (!visible || state.loading),
        error: visible && state.error,
        reload,
        refreshAfterRuleChange,
        removeRequest,
        removingId: enabled && removal?.scope === scope ? removal.id : null,
    };
}
