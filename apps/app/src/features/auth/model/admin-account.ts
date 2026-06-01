import type {TAccount} from '@/entities/account';
import type {TAdminMeResponse, TAdminMembershipResponse} from '@/shared/api/admin';

const LEGACY_ACCOUNT_STATUSES = new Set<string>([
    'INITIAL',
    'NURSE_INFO_PENDING',
    'WARD_SELECT_PENDING',
    'WARD_ENTRY_PENDING',
    'LINKED',
    'DEMO',
]);
const getActiveMembershipWardId = (memberships?: TAdminMembershipResponse[]) =>
    memberships?.find((membership) => membership.status === 'ACTIVE')?.wardId;

export const toAccountCompatibleAdminMe = (account: TAdminMeResponse, fallbackWardId?: number): TAccount => {
    const wardId = account.wardId ?? fallbackWardId ?? getActiveMembershipWardId(account.memberships) ?? null;
    const status =
        account.status === 'DISABLED'
            ? 'WARD_SELECT_PENDING'
            : account.status === 'WORKSPACE_SETUP_PENDING' && wardId
              ? 'LINKED'
              : LEGACY_ACCOUNT_STATUSES.has(account.status)
                ? account.status
                : account.status === 'WORKSPACE_SETUP_PENDING'
                  ? account.status
                  : 'LINKED';

    return {
        ...account,
        wardId,
        status,
    } as TAccount;
};
