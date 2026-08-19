import {WARD_ADMIN_MAX_COUNT, type TWardAdminMembershipResponse, type TWardReservedAdminEmailResponse} from '@dutying/api/ward';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Plus, Trash2} from 'lucide-react';
import {type FormEvent, useState} from 'react';
import toast from 'react-hot-toast';
import useAuth from '@/features/auth';
import {WardAPI} from '@/shared/api';
import wardAdminIcon from '@/shared/assets/images/ward-admin-icon.webp';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import PageState from '@/shared/ui/PageState';

const FIELD_CLASS =
    'h-11 w-full rounded-[12px] border border-transparent bg-gray-7 px-3.5 text-[15px] font-medium text-sub-1 outline-none transition-colors placeholder:text-gray-4 focus-visible:bg-main-light';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const compareAdminRolePriority = (a: TWardAdminMembershipResponse, b: TWardAdminMembershipResponse) =>
    Number(b.role === 'OWNER') - Number(a.role === 'OWNER');
const isEmail = (value: string) => EMAIL_PATTERN.test(value);
const getAdminCount = (members: TWardAdminMembershipResponse[], reservedEmails: TWardReservedAdminEmailResponse[]) =>
    members.length + reservedEmails.length;
const getWardAdminMembershipId = (admin: TWardAdminMembershipResponse) => admin.membershipId ?? admin.wardAdminMembershipId;
const canRemoveActiveAdmin = (admin: TWardAdminMembershipResponse, canRemoveAdmins: boolean) =>
    canRemoveAdmins && admin.role !== 'OWNER' && typeof getWardAdminMembershipId(admin) === 'number';

type TAccountRoleSource = {
    role?: string | null;
    wardId?: number | null;
    currentWardId?: number | null;
    memberships?: {
        wardId?: number | null;
        role?: string | null;
        status?: string | null;
    }[];
};

const getAccountRole = (account: unknown, currentWardId?: number | null) => {
    if (typeof account !== 'object' || account === null) return undefined;

    const roleSource = account as TAccountRoleSource;
    const memberships = Array.isArray(roleSource.memberships) ? roleSource.memberships : [];
    const wardId = currentWardId ?? roleSource.wardId ?? roleSource.currentWardId;
    const currentWardMembership =
        wardId === undefined || wardId === null
            ? undefined
            : (memberships.find((membership) => membership.status === 'ACTIVE' && membership.wardId === wardId) ??
              memberships.find((membership) => membership.wardId === wardId));
    const activeMembership = memberships.find((membership) => membership.status === 'ACTIVE');

    return currentWardMembership?.role ?? activeMembership?.role ?? roleSource.role ?? undefined;
};
const getApiErrorCode = (error: unknown) =>
    typeof error === 'object' && error !== null && 'code' in error ? (error as {code?: number}).code : undefined;

type TWardAdminRoleLabelKey = 'page.wardAdmins.role.owner' | 'page.wardAdmins.role.editor';

const getRoleLabelKey = (role: string): TWardAdminRoleLabelKey =>
    role === 'OWNER' ? 'page.wardAdmins.role.owner' : 'page.wardAdmins.role.editor';
const isActiveWardMembershipStatus = (status?: string | null) => status === undefined || status === null || status === 'ACTIVE';
const hasAccountWardMembership = (account: unknown, currentWardId?: number | null) => {
    if (typeof account !== 'object' || account === null || currentWardId === undefined || currentWardId === null) return false;

    const roleSource = account as TAccountRoleSource;
    const memberships = Array.isArray(roleSource.memberships) ? roleSource.memberships : [];
    const accountWardId = roleSource.wardId ?? roleSource.currentWardId;

    if (accountWardId === currentWardId) return true;

    if (memberships.length > 0) {
        return memberships.some((membership) => membership.wardId === currentWardId && isActiveWardMembershipStatus(membership.status));
    }

    if (accountWardId !== undefined && accountWardId !== null) return false;

    return Boolean(roleSource.role);
};

function showAdminActionError(
    error: unknown,
    fallbackMessage: string,
    copy: {
        ownerOnly: string;
        duplicateEmail: string;
    },
) {
    const code = getApiErrorCode(error);

    if (code === 403) {
        toast.error(copy.ownerOnly);

        return;
    }

    if (code === 409) {
        toast.error(copy.duplicateEmail);

        return;
    }

    toast.error(fallbackMessage);
}

function ActiveAdminRow({
    admin,
    canRemove,
    isRemoving,
    onRemove,
}: {
    admin: TWardAdminMembershipResponse;
    canRemove: boolean;
    isRemoving: boolean;
    onRemove: (admin: TWardAdminMembershipResponse) => void;
}) {
    const {t} = useTypedTranslation();
    const adminEmail = admin.email ?? t('page.wardAdmins.accountFallback', {accountId: admin.accountId});

    return (
        <div className="flex items-center justify-between gap-4 border-b border-gray-6 py-3 last:border-b-0">
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-sub-1">{adminEmail}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-gray-7 px-3 py-1 text-xs font-semibold text-main-1">{t(getRoleLabelKey(admin.role))}</span>
                {canRemove ? (
                    <button
                        type="button"
                        aria-label={t('page.wardAdmins.removeActiveAria', {email: adminEmail})}
                        disabled={isRemoving}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-3 transition-colors hover:bg-gray-7 hover:text-red disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => onRemove(admin)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                ) : null}
            </div>
        </div>
    );
}

function ReservedAdminEmailRow({
    admin,
    canRemove,
    isRemoving,
    onRemove,
}: {
    admin: TWardReservedAdminEmailResponse;
    canRemove: boolean;
    isRemoving: boolean;
    onRemove: (admin: TWardReservedAdminEmailResponse) => void;
}) {
    const {t} = useTypedTranslation();

    return (
        <div className="flex items-center justify-between gap-4 border-b border-gray-6 py-3 last:border-b-0">
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-sub-1">{admin.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-gray-7 px-3 py-1 text-xs font-semibold text-main-1">{t(getRoleLabelKey(admin.role))}</span>
                {canRemove ? (
                    <button
                        type="button"
                        aria-label={t('page.wardAdmins.removeReservedAria', {email: admin.email})}
                        disabled={isRemoving}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-3 transition-colors hover:bg-gray-7 hover:text-red disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => onRemove(admin)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                ) : null}
            </div>
        </div>
    );
}

function WardAdminsPage() {
    const {t} = useTypedTranslation();
    const {
        state: {accountMe, wardId},
    } = useAuth();
    const queryClient = useQueryClient();
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const adminsQuery = useQuery({
        queryKey: ['ward-admins', wardId],
        queryFn: () => WardAPI.getWardAdmins(wardId ?? 0),
        enabled: Boolean(wardId),
    });
    const invalidateAdmins = async () => {
        await queryClient.invalidateQueries({queryKey: ['ward-admins', wardId]});
    };
    const createAdminEmailMutation = useMutation({
        mutationFn: (normalizedEmail: string) =>
            WardAPI.createWardAdminEmail(wardId ?? 0, {
                email: normalizedEmail,
                role: 'EDITOR',
            }),
        onSuccess: async (result) => {
            toast.success(result.status === 'ACTIVE' ? t('page.wardAdmins.toast.createActive') : t('page.wardAdmins.toast.createReserved'));
            setEmail('');
            await invalidateAdmins();
        },
        onError: (mutationError) => {
            showAdminActionError(mutationError, t('page.wardAdmins.toast.createFailed'), {
                ownerOnly: t('page.wardAdmins.toast.createOwnerOnly'),
                duplicateEmail: t('page.wardAdmins.toast.duplicateEmail'),
            });
        },
    });
    const removeMemberMutation = useMutation({
        mutationFn: (admin: TWardAdminMembershipResponse) => {
            const membershipId = getWardAdminMembershipId(admin);

            if (typeof membershipId !== 'number') throw new Error('Ward admin membership id was not found.');

            return WardAPI.removeWardAdmin(wardId ?? 0, membershipId);
        },
        onSuccess: async () => {
            toast.success(t('page.wardAdmins.toast.removeActive'));
            await invalidateAdmins();
        },
        onError: (mutationError) => {
            showAdminActionError(mutationError, t('page.wardAdmins.toast.removeActiveFailed'), {
                ownerOnly: t('page.wardAdmins.toast.ownerOnly'),
                duplicateEmail: t('page.wardAdmins.toast.duplicateEmail'),
            });
        },
    });
    const removeReservedEmailMutation = useMutation({
        mutationFn: (admin: TWardReservedAdminEmailResponse) => WardAPI.removeWardAdminEmail(wardId ?? 0, admin.emailRegistrationId),
        onSuccess: async () => {
            toast.success(t('page.wardAdmins.toast.removeReserved'));
            await invalidateAdmins();
        },
        onError: (mutationError) => {
            showAdminActionError(mutationError, t('page.wardAdmins.toast.removeReservedFailed'), {
                ownerOnly: t('page.wardAdmins.toast.ownerOnly'),
                duplicateEmail: t('page.wardAdmins.toast.duplicateEmail'),
            });
        },
    });
    const canAddAdmins = hasAccountWardMembership(accountMe, wardId);
    const canRemoveAdmins = getAccountRole(accountMe, wardId) === 'OWNER';
    const isSubmitting = createAdminEmailMutation.isPending;
    const members = [...(adminsQuery.data?.members ?? [])].sort(compareAdminRolePriority);
    const reservedEmails = adminsQuery.data?.reservedEmails ?? [];
    const adminCount = getAdminCount(members, reservedEmails);
    const hasReachedAdminLimit = adminCount >= WARD_ADMIN_MAX_COUNT;
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        if (hasReachedAdminLimit) {
            setError(t('page.wardAdmins.error.maxAdmins', {count: WARD_ADMIN_MAX_COUNT}));

            return;
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (!normalizedEmail) {
            setError(t('page.wardAdmins.error.emailRequired'));

            return;
        }

        if (!isEmail(normalizedEmail)) {
            setError(t('page.wardAdmins.error.emailInvalid'));

            return;
        }

        createAdminEmailMutation.mutate(normalizedEmail);
    };

    if (!wardId) {
        return (
            <PageState
                tone="empty"
                title={t('page.wardAdmins.state.noWardTitle')}
                description={t('page.wardAdmins.state.noWardDescription')}
            />
        );
    }

    if (adminsQuery.isLoading) {
        return (
            <div className="flex h-full min-h-[420px] items-center justify-center">
                <LoadingSpinner size={56} />
            </div>
        );
    }

    if (adminsQuery.isError) {
        return (
            <PageState
                tone="error"
                title={t('page.wardAdmins.state.loadFailedTitle')}
                description={t('page.wardAdmins.state.retryDescription')}
                action={{label: t('page.wardAdmins.state.retry'), onClick: () => void adminsQuery.refetch()}}
            />
        );
    }

    const hasAdmins = members.length > 0 || reservedEmails.length > 0;

    return (
        <div className="mx-auto w-full">
            <section className="rounded-[24px] bg-white p-6">
                <h2 className="flex items-center gap-2 font-apple text-[20px] font-semibold text-sub-1">
                    <img src={wardAdminIcon} alt="" aria-hidden="true" className="h-6 w-6 shrink-0 object-contain" />
                    <span>{t('page.wardAdmins.title')}</span>
                </h2>

                {canAddAdmins ? (
                    <form onSubmit={handleSubmit} className="mt-4">
                        <div className="flex gap-2">
                            <input
                                value={email}
                                className={FIELD_CLASS}
                                placeholder={t('page.wardAdmins.emailPlaceholder')}
                                inputMode="email"
                                autoComplete="email"
                                disabled={hasReachedAdminLimit}
                                onChange={(event) => setEmail(event.target.value)}
                            />
                            <button
                                type="submit"
                                disabled={isSubmitting || hasReachedAdminLimit}
                                aria-label={t('page.wardAdmins.addAria')}
                                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[12px] bg-main-1 text-white transition-colors hover:bg-main-1-hover disabled:cursor-not-allowed disabled:bg-main-3"
                            >
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>
                        {error ? <p className="mt-2 text-xs text-red">{error}</p> : null}
                        {hasReachedAdminLimit ? (
                            <p className="mt-2 text-xs text-gray-3">
                                {t('page.wardAdmins.error.maxAdmins', {count: WARD_ADMIN_MAX_COUNT})}
                            </p>
                        ) : null}
                    </form>
                ) : (
                    <p className="mt-4 rounded-[12px] bg-gray-7 px-4 py-3 text-sm text-gray-3">
                        {t('page.wardAdmins.memberOnlyDescription')}
                    </p>
                )}

                <div className="mt-6 border-t border-gray-6 pt-5">
                    <h2 className="font-apple text-sm font-medium text-sub-2">{t('page.wardAdmins.registeredTitle')}</h2>
                </div>
                <div className="mt-3">
                    {hasAdmins ? (
                        <>
                            {members.map((admin) => (
                                <ActiveAdminRow
                                    key={`member-${getWardAdminMembershipId(admin) ?? admin.accountId}`}
                                    admin={admin}
                                    canRemove={canRemoveActiveAdmin(admin, canRemoveAdmins)}
                                    isRemoving={removeMemberMutation.isPending}
                                    onRemove={removeMemberMutation.mutate}
                                />
                            ))}
                            {reservedEmails.map((admin) => (
                                <ReservedAdminEmailRow
                                    key={`reserved-${admin.emailRegistrationId}`}
                                    admin={admin}
                                    canRemove={canRemoveAdmins}
                                    isRemoving={removeReservedEmailMutation.isPending}
                                    onRemove={removeReservedEmailMutation.mutate}
                                />
                            ))}
                        </>
                    ) : (
                        <p className="rounded-[12px] bg-gray-7 px-4 py-5 text-sm text-gray-3">{t('page.wardAdmins.emptyAdmins')}</p>
                    )}
                </div>
            </section>
        </div>
    );
}

export default WardAdminsPage;
