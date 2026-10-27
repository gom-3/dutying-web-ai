import type {ReactNode} from 'react';
import type {Scope} from '@/features/commercial/api';
import {WorkspaceShell, type TWorkspacePage} from './workspace-shell';

export function HospitalWorkspaceShell({
    scope,
    scopes,
    tab,
    accountId,
    accountName,
    pendingCount = 0,
    busy,
    onSwitch,
    children,
}: {
    scope: Scope;
    scopes: Scope[];
    tab: string;
    accountId?: number | null;
    accountName: string;
    pendingCount?: number;
    busy: boolean;
    onSwitch: (scope: Scope) => void;
    children: ReactNode;
}) {
    const page: TWorkspacePage = ['overview', 'members', 'usage', 'support', 'billing'].includes(tab) ? (tab as TWorkspacePage) : 'usage';

    return (
        <WorkspaceShell
            page={page}
            scope={scope}
            scopes={scopes}
            accountId={accountId}
            accountName={accountName}
            pendingCount={pendingCount}
            busy={busy}
            onSwitchHospital={onSwitch}
            className="hospital-workspace"
        >
            {children}
        </WorkspaceShell>
    );
}
