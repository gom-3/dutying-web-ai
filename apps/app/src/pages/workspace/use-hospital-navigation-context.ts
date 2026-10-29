import {useEffect, useState} from 'react';
import type {Scope} from '@/features/commercial/api';

type TSelection = {accountId: number | null | undefined; ref?: string; scopeId?: string};

const storageKey = (accountId: number) => `dutying:workspace-navigation:${accountId}`;
const readSelection = (accountId: number | null | undefined): TSelection => {
    if (accountId == null) return {accountId};

    try {
        const stored = JSON.parse(sessionStorage.getItem(storageKey(accountId)) ?? 'null') as Partial<TSelection> | null;

        return {
            accountId,
            ref: typeof stored?.ref === 'string' ? stored.ref : undefined,
            scopeId: typeof stored?.scopeId === 'string' ? stored.scopeId : undefined,
        };
    } catch {
        return {accountId};
    }
};

export function useHospitalNavigationContext({
    accountId,
    scopes,
    currentScope,
}: {
    accountId: number | null | undefined;
    scopes: Scope[];
    currentScope?: Scope;
}) {
    const [selection, setSelection] = useState<TSelection>(() => readSelection(accountId));
    const hospitals = scopes.filter((scope) => scope.type === 'HOSPITAL');
    const saved = selection.accountId === accountId ? selection : readSelection(accountId);
    const matching = (candidate?: Pick<Scope, 'ref' | 'scopeId'>) =>
        candidate
            ? hospitals.find((scope) => String(scope.ref) === String(candidate.ref) && scope.scopeId === candidate.scopeId)
            : undefined;
    const routed = currentScope?.type === 'HOSPITAL' ? matching(currentScope) : undefined;
    const remembered = saved.ref && saved.scopeId ? matching({ref: saved.ref, scopeId: saved.scopeId}) : undefined;
    const hospital = routed ?? remembered ?? (hospitals.length === 1 ? hospitals[0] : undefined);
    const rememberHospital = (candidate: Scope) => {
        const authorized = candidate.type === 'HOSPITAL' ? matching(candidate) : undefined;

        if (!authorized) return false;

        const next = {accountId, ref: String(authorized.ref), scopeId: authorized.scopeId};

        setSelection(next);

        if (accountId != null) {
            try {
                sessionStorage.setItem(storageKey(accountId), JSON.stringify({ref: next.ref, scopeId: next.scopeId}));
            } catch {
                /* Navigation still works when browser storage is unavailable. */
            }
        }

        return true;
    };

    useEffect(() => {
        if (
            hospital &&
            (selection.accountId !== accountId || selection.ref !== String(hospital.ref) || selection.scopeId !== hospital.scopeId)
        )
            rememberHospital(hospital);
    }, [accountId, hospital?.ref, hospital?.scopeId]);

    return {hospital, hospitals, rememberHospital};
}
