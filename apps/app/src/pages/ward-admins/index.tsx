import type {TWardAdminMembershipResponse} from '@dutying/api/ward';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Plus, Trash2, UserPlus} from 'lucide-react';
import {type FormEvent, useState} from 'react';
import toast from 'react-hot-toast';
import useAuth from '@/features/auth';
import {WardAPI} from '@/shared/api';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import PageState from '@/shared/ui/PageState';

const FIELD_CLASS =
    'h-11 w-full rounded-[12px] border border-transparent bg-gray-7 px-3.5 text-[15px] font-medium text-sub-1 outline-none transition-colors placeholder:text-gray-4 focus-visible:bg-main-light';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const getRoleLabel = (role: string) => (role === 'OWNER' ? '최고 관리자' : '관리자');
const isEmail = (value: string) => EMAIL_PATTERN.test(value);
const getFallbackInvitationName = (email: string) => email.split('@')[0] || email;

function ActiveAdminRow({
    admin,
    canRemove,
    onRemove,
}: {
    admin: TWardAdminMembershipResponse;
    canRemove: boolean;
    onRemove: (admin: TWardAdminMembershipResponse) => void;
}) {
    const adminName = admin.name || admin.loginId || admin.email || `계정 #${admin.accountId}`;

    return (
        <div className="flex items-center justify-between gap-4 border-b border-gray-6 py-3 last:border-b-0">
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-sub-1">{adminName}</p>
                <p className="mt-0.5 truncate text-xs text-gray-3">
                    {[admin.loginId, admin.email].filter(Boolean).join(' · ') || `계정 #${admin.accountId}`}
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-gray-7 px-3 py-1 text-xs font-semibold text-main-1">{getRoleLabel(admin.role)}</span>
                {canRemove && admin.role !== 'OWNER' ? (
                    <button
                        type="button"
                        aria-label={`${adminName} 관리자 제거`}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-3 transition-colors hover:bg-gray-7 hover:text-red"
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
    const {
        state: {accountMe, wardId},
    } = useAuth();
    const queryClient = useQueryClient();
    const [credential, setCredential] = useState('');
    const [error, setError] = useState<string | null>(null);
    const adminsQuery = useQuery({
        queryKey: ['ward-admins', wardId],
        queryFn: () => WardAPI.getWardAdmins(wardId ?? 0),
        enabled: Boolean(wardId),
    });
    const invalidateAdmins = async () => {
        await queryClient.invalidateQueries({queryKey: ['ward-admins', wardId]});
    };
    const inviteByEmailMutation = useMutation({
        mutationFn: () =>
            WardAPI.createWardAdminInvitation(wardId ?? 0, {
                invitedEmail: credential.trim(),
                invitedName: getFallbackInvitationName(credential.trim()),
                role: 'EDITOR',
            }),
        onSuccess: async () => {
            toast.success('관리자 초대 메일을 보냈어요.');
            setCredential('');
            await invalidateAdmins();
        },
    });
    const removeMutation = useMutation({
        mutationFn: (admin: TWardAdminMembershipResponse) => WardAPI.removeWardAdmin(wardId ?? 0, admin.membershipId),
        onSuccess: async () => {
            toast.success('관리자를 제거했어요.');
            await invalidateAdmins();
        },
    });
    const isOwner = accountMe?.role === 'OWNER';
    const isSubmitting = inviteByEmailMutation.isPending;
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        const normalizedCredential = credential.trim();

        if (!normalizedCredential) {
            setError('이메일을 입력해 주세요.');
            return;
        }

        if (isEmail(normalizedCredential)) {
            inviteByEmailMutation.mutate();

            return;
        }

        setError('올바른 이메일을 입력해 주세요.');
    };

    if (!wardId) {
        return (
            <PageState
                tone="empty"
                title="관리 중인 병동이 없어요"
                description="새 병동을 만들거나 기존 병동에 들어간 뒤 관리자 관리를 사용할 수 있어요."
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
                title="관리자 목록을 불러오지 못했어요"
                description="잠시 후 다시 시도해 주세요."
                action={{label: '다시 시도', onClick: () => void adminsQuery.refetch()}}
            />
        );
    }

    const admins = adminsQuery.data?.members ?? [];

    return (
        <div className="mx-auto w-full">
            <section className="rounded-[24px] bg-white p-6">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-main-light text-main-1">
                        <UserPlus className="h-5 w-5" />
                    </span>
                    <div>
                        <h2 className="text-lg font-semibold text-sub-1">병동 관리자</h2>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-4">
                    <div className="flex gap-2">
                        <input
                            value={credential}
                            className={FIELD_CLASS}
                            placeholder="이메일"
                            autoComplete="off"
                            onChange={(event) => setCredential(event.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            aria-label="관리자 추가"
                            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[12px] bg-main-1 text-white transition-colors hover:bg-main-2 disabled:cursor-not-allowed disabled:bg-main-3"
                        >
                            <Plus className="h-5 w-5" />
                        </button>
                    </div>
                    {error ? <p className="mt-2 text-xs text-red">{error}</p> : null}
                </form>

                <div className="mt-6 border-t border-gray-6 pt-5">
                    <h2 className="font-apple text-sm font-medium text-sub-2">등록된 관리자</h2>
                </div>
                <div className="mt-3">
                    {admins.length > 0 ? (
                        admins.map((admin) => (
                            <ActiveAdminRow
                                key={admin.membershipId}
                                admin={admin}
                                canRemove={isOwner}
                                onRemove={removeMutation.mutate}
                            />
                        ))
                    ) : (
                        <p className="rounded-[12px] bg-gray-7 px-4 py-5 text-sm text-gray-3">아직 등록된 관리자가 없어요.</p>
                    )}
                </div>
            </section>
        </div>
    );
}

export default WardAdminsPage;
