import type {TWardAdminInvitationResponse, TWardAdminMembershipResponse} from '@dutying/api/ward';
import {cn} from '@dutying/utils/style';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Mail, RefreshCw, ShieldCheck, Trash2, UserPlus, UserRound} from 'lucide-react';
import {type FormEvent, useState} from 'react';
import toast from 'react-hot-toast';
import useAuth from '@/features/auth';
import {WardAPI} from '@/shared/api';
import LoadingSpinner from '@/shared/ui/LoadingSpinner';
import PageState from '@/shared/ui/PageState';

type TAddMode = 'email' | 'loginId';

const FIELD_CLASS =
    'h-10 w-full rounded-[12px] border border-transparent bg-gray-7 px-3 text-sm font-medium text-sub-1 outline-none transition-colors placeholder:text-gray-4 focus-visible:bg-main-light';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const getRoleLabel = (role: string) => (role === 'OWNER' ? '최고 관리자' : '관리자');
const getInvitationStatusLabel = (status: TWardAdminInvitationResponse['status']) => {
    if (status === 'ACCEPTED') return '수락 완료';

    if (status === 'CANCELED') return '취소됨';

    if (status === 'EXPIRED') return '만료됨';

    return '초대 대기';
};

function ActiveAdminRow({admin, onRemove}: {admin: TWardAdminMembershipResponse; onRemove: (admin: TWardAdminMembershipResponse) => void}) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-[14px] bg-gray-7 px-4 py-3">
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-sub-1">{admin.name}</p>
                <p className="mt-0.5 truncate text-xs text-gray-3">
                    {[admin.loginId, admin.email].filter(Boolean).join(' · ') || `계정 #${admin.accountId}`}
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-main-1">{getRoleLabel(admin.role)}</span>
                {admin.role !== 'OWNER' ? (
                    <button
                        type="button"
                        aria-label={`${admin.name} 관리자 제거`}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-3 transition-colors hover:bg-white hover:text-red"
                        onClick={() => onRemove(admin)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                ) : null}
            </div>
        </div>
    );
}

function InvitationRow({
    invitation,
    onResend,
    onCancel,
}: {
    invitation: TWardAdminInvitationResponse;
    onResend: (invitation: TWardAdminInvitationResponse) => void;
    onCancel: (invitation: TWardAdminInvitationResponse) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-[14px] bg-gray-7 px-4 py-3">
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-sub-1">{invitation.invitedName ?? invitation.invitedEmail}</p>
                <p className="mt-0.5 truncate text-xs text-gray-3">{invitation.invitedEmail}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-3">
                    {getInvitationStatusLabel(invitation.status)}
                </span>
                {invitation.status === 'PENDING' ? (
                    <>
                        <button
                            type="button"
                            aria-label={`${invitation.invitedEmail} 초대 재발송`}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-3 transition-colors hover:bg-white hover:text-main-1"
                            onClick={() => onResend(invitation)}
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            aria-label={`${invitation.invitedEmail} 초대 취소`}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-3 transition-colors hover:bg-white hover:text-red"
                            onClick={() => onCancel(invitation)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </>
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
    const [mode, setMode] = useState<TAddMode>('email');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [loginId, setLoginId] = useState('');
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
                invitedEmail: email.trim(),
                invitedName: name.trim() || undefined,
                role: 'EDITOR',
            }),
        onSuccess: async () => {
            toast.success('관리자 초대 메일을 보냈어요.');
            setName('');
            setEmail('');
            await invalidateAdmins();
        },
    });
    const addByLoginIdMutation = useMutation({
        mutationFn: () => WardAPI.addWardAdminByLoginId(wardId ?? 0, {loginId: loginId.trim(), role: 'EDITOR'}),
        onSuccess: async () => {
            toast.success('관리자 권한을 추가했어요.');
            setLoginId('');
            await invalidateAdmins();
        },
    });
    const resendMutation = useMutation({
        mutationFn: (invitation: TWardAdminInvitationResponse) => WardAPI.resendWardAdminInvitation(wardId ?? 0, invitation.invitationId),
        onSuccess: async () => {
            toast.success('초대 메일을 다시 보냈어요.');
            await invalidateAdmins();
        },
    });
    const cancelMutation = useMutation({
        mutationFn: (invitation: TWardAdminInvitationResponse) => WardAPI.cancelWardAdminInvitation(wardId ?? 0, invitation.invitationId),
        onSuccess: async () => {
            toast.success('초대를 취소했어요.');
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
    const isSubmitting = inviteByEmailMutation.isPending || addByLoginIdMutation.isPending;
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        if (mode === 'email') {
            if (!EMAIL_PATTERN.test(email.trim())) {
                setError('초대할 이메일을 올바르게 입력해 주세요.');

                return;
            }

            inviteByEmailMutation.mutate();

            return;
        }

        if (loginId.trim().length < 4) {
            setError('추가할 관리자의 아이디를 입력해 주세요.');

            return;
        }

        addByLoginIdMutation.mutate();
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

    if (accountMe?.role && accountMe.role !== 'OWNER') {
        return (
            <PageState
                tone="empty"
                title="최고 관리자만 사용할 수 있어요"
                description="관리자 추가, 초대, 제거는 병동 최고 관리자에게 요청해 주세요."
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
    const invitations = adminsQuery.data?.invitations ?? [];

    return (
        <div className="h-full overflow-y-auto bg-main-bg px-5 py-8 md:px-8">
            <div className="mx-auto flex w-full max-w-[960px] flex-col">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-main-light px-3 py-1 text-sm font-semibold text-main-1">
                        <ShieldCheck className="h-4 w-4" />
                        최고 관리자 전용
                    </div>
                    <h1 className="mt-4 text-[30px] font-semibold text-sub-1">관리자 관리</h1>
                    <p className="mt-2 text-sm leading-6 text-gray-3">
                        이메일은 초대 메일을 보내고, 아이디는 이미 가입된 계정에 바로 관리자 권한을 추가합니다.
                    </p>
                </div>

                <section className="mt-6 rounded-[20px] bg-white p-5">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-main-light text-main-1">
                            <UserPlus className="h-5 w-5" />
                        </span>
                        <div>
                            <h2 className="text-[20px] font-semibold text-sub-1">관리자 추가</h2>
                            <p className="mt-1 text-xs text-gray-3">추가되는 관리자는 EDITOR 권한을 갖습니다.</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-5">
                        <div className="grid grid-cols-2 rounded-[14px] bg-gray-7 p-1">
                            {[
                                {value: 'email', label: '이메일 초대'},
                                {value: 'loginId', label: '아이디 추가'},
                            ].map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    aria-pressed={mode === item.value}
                                    className={cn(
                                        'h-10 cursor-pointer rounded-[11px] text-sm font-semibold transition-colors',
                                        mode === item.value ? 'bg-white text-main-1 shadow-sm' : 'text-gray-3 hover:text-sub-1',
                                    )}
                                    onClick={() => {
                                        setMode(item.value as TAddMode);
                                        setError(null);
                                    }}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[0.8fr_1.2fr_auto]">
                            {mode === 'email' ? (
                                <>
                                    <input
                                        value={name}
                                        className={FIELD_CLASS}
                                        placeholder="이름 선택"
                                        onChange={(event) => setName(event.target.value)}
                                    />
                                    <div className="relative">
                                        <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-4" />
                                        <input
                                            value={email}
                                            className={`${FIELD_CLASS} pl-9`}
                                            placeholder="초대할 이메일"
                                            onChange={(event) => setEmail(event.target.value)}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="relative md:col-span-2">
                                        <UserRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-4" />
                                        <input
                                            value={loginId}
                                            className={`${FIELD_CLASS} pl-9`}
                                            placeholder="이미 가입된 관리자 아이디"
                                            onChange={(event) => setLoginId(event.target.value)}
                                        />
                                    </div>
                                </>
                            )}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex h-10 min-w-32 cursor-pointer items-center justify-center rounded-[12px] bg-main-1 px-4 text-sm font-semibold text-white transition-colors hover:bg-[#5832E7] disabled:cursor-not-allowed disabled:bg-main-3"
                            >
                                {isSubmitting ? '처리 중' : mode === 'email' ? '초대 보내기' : '권한 추가'}
                            </button>
                        </div>
                        {error ? <p className="mt-2 text-xs text-red">{error}</p> : null}
                    </form>
                </section>

                <section className="mt-5 rounded-[20px] bg-white p-5">
                    <h2 className="text-[20px] font-semibold text-sub-1">활성 관리자</h2>
                    <div className="mt-4 flex flex-col gap-2">
                        {admins.length > 0 ? (
                            admins.map((admin) => (
                                <ActiveAdminRow key={admin.membershipId} admin={admin} onRemove={removeMutation.mutate} />
                            ))
                        ) : (
                            <p className="rounded-[14px] bg-gray-7 px-4 py-5 text-sm text-gray-3">아직 활성 관리자가 없어요.</p>
                        )}
                    </div>
                </section>

                <section className="mt-5 rounded-[20px] bg-white p-5">
                    <h2 className="text-[20px] font-semibold text-sub-1">초대 대기</h2>
                    <div className="mt-4 flex flex-col gap-2">
                        {invitations.length > 0 ? (
                            invitations.map((invitation) => (
                                <InvitationRow
                                    key={invitation.invitationId}
                                    invitation={invitation}
                                    onResend={resendMutation.mutate}
                                    onCancel={cancelMutation.mutate}
                                />
                            ))
                        ) : (
                            <p className="rounded-[14px] bg-gray-7 px-4 py-5 text-sm text-gray-3">대기 중인 이메일 초대가 없어요.</p>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}

export default WardAdminsPage;
