import useAuthStore from '@/features/auth/model/store';
import type {AccessContext} from '@/features/commercial/api';
import {WorkspaceInbox} from './workspace-inbox';
import {WorkspaceNotices} from './workspace-notices';
import './workspace-activity.css';

const isPending = (status: string, expiresAt: string) => {
    if (status !== 'PENDING') return false;

    if (!expiresAt) return true;

    const expiry = new Date(/[Z+-]\d*:?.*$/.test(expiresAt.slice(10)) ? expiresAt : `${expiresAt}Z`).getTime();

    return Number.isFinite(expiry) && expiry > Date.now();
};

/** Count only requests the signed-in account can act on, excluding requests they sent. */
export function countWorkspaceRequests(context?: AccessContext, accountId?: number | null) {
    if (!context?.enabled || accountId == null) return 0;

    return (
        (context.invitations ?? []).filter((entry) => isPending(entry.invitation.status, entry.invitation.expiresAt)).length +
        (context.transfers ?? []).filter((entry) => entry.toAccountId === accountId && isPending(entry.status, entry.expiresAt)).length
    );
}

export function WorkspaceActivity({context, onRetry}: {context: AccessContext; onRetry?: () => void}) {
    const accountId = useAuthStore((state) => state.accountId);

    return (
        <div className="workspace-activity">
            {context.enabled && accountId != null ? <WorkspaceInbox key={accountId} context={context} onRetry={onRetry} compact /> : null}
            <WorkspaceNotices />
        </div>
    );
}
