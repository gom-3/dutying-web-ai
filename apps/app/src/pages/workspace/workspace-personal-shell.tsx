import type {ReactNode} from 'react';
import type {Scope} from '@/features/commercial/api';
import {WorkspaceShell} from './workspace-shell';
import './workspace-personal.css';

export type TPersonalWorkspacePage = 'invitations' | 'notices' | 'receipts' | 'plans' | 'profile' | 'workspaces';

export function WorkspacePersonalShell({
    page,
    scopes = [],
    accountId,
    accountName = '',
    pendingCount = 0,
    managementEnabled = true,
    children,
}: {
    page: TPersonalWorkspacePage;
    scopes?: Scope[];
    accountId?: number | null;
    accountName?: string;
    pendingCount?: number;
    managementEnabled?: boolean;
    children: ReactNode;
}) {
    return (
        <WorkspaceShell
            page={page}
            scopes={scopes}
            accountId={accountId}
            accountName={accountName}
            pendingCount={pendingCount}
            managementEnabled={managementEnabled}
            className="workspace-personal"
        >
            {children}
        </WorkspaceShell>
    );
}
