import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import useAuthStore from '@/features/auth/model/store';
import {
    commercialError,
    commercialGet,
    commercialPost,
    commercialPut,
    commercialQueryKey,
    isAdminSeatLimitReached,
    type Entitlement,
    type Member,
    type Members,
    type Scope,
} from '@/features/commercial/api';
import {workspaceRoleLabel} from '@/features/commercial/hospital-entry';
import {HospitalOwnershipTransfer} from './hospital-ownership-transfer';
import {InfoTip} from './info-tip';
import './hospital-members.css';

type TWardChoice = NonNullable<Members['availableWards']>[number];

function WardChoices({
    wards,
    selected,
    onChange,
    disabled,
}: {
    wards: TWardChoice[];
    selected: number[];
    onChange: (ids: number[]) => void;
    disabled: boolean;
}) {
    const {i18n} = useTranslation();
    const ko = i18n.language.startsWith('ko');

    return (
        <fieldset className="hospital-member-ward-choices" disabled={disabled}>
            <legend>
                <span>{ko ? '담당 병동' : 'Assigned wards'}</span>
                <span className="hospital-members-optional">{ko ? '선택' : 'Optional'}</span>
                <InfoTip label={ko ? '담당 병동 권한 안내' : 'About assigned ward access'}>
                    {ko
                        ? '일반 관리자는 선택한 병동의 명단과 근무표를 조회·수정할 수 있습니다. 선택하지 않으면 병원 요약만 볼 수 있으며, 기존 병동 권한은 유지됩니다.'
                        : 'Administrators can view and edit rosters and schedules in their assigned wards. Without assignments, only hospital summaries are available. Existing independent ward access is preserved.'}
                </InfoTip>
            </legend>
            {wards.length ? (
                <div className="hospital-member-ward-options">
                    {wards.map((ward) => (
                        <label key={ward.wardId} className="hospital-member-ward-option">
                            <input
                                type="checkbox"
                                checked={selected.includes(ward.wardId)}
                                onChange={(event) =>
                                    onChange(
                                        event.target.checked ? [...selected, ward.wardId] : selected.filter((id) => id !== ward.wardId),
                                    )
                                }
                            />
                            <span>{ward.name}</span>
                        </label>
                    ))}
                </div>
            ) : (
                <p className="hospital-members-empty-wards">
                    {ko ? '병동을 연결하면 담당자를 지정할 수 있습니다.' : 'Link a ward to assign administrators.'}
                </p>
            )}
        </fieldset>
    );
}

export function HospitalMembersPanel({scope, entitlement}: {scope: Scope; entitlement: Entitlement}) {
    const {i18n} = useTranslation();
    const ko = i18n.language.startsWith('ko');
    const accountId = useAuthStore((state) => state.accountId);
    const client = useQueryClient();
    const isOwner = scope.role === 'OWNER';
    const [adding, setAdding] = useState(false);
    const [email, setEmail] = useState('');
    const [wardIds, setWardIds] = useState<number[]>([]);
    const [editing, setEditing] = useState<Member | null>(null);
    const [editedWards, setEditedWards] = useState<number[]>([]);
    const [notice, setNotice] = useState('');
    const emailRef = useRef<HTMLInputElement>(null);
    const addButtonRef = useRef<HTMLButtonElement>(null);
    const restoreAddFocusRef = useRef(false);
    const query = useQuery({
        queryKey: commercialQueryKey(accountId, 'HOSPITAL', scope.ref, 'members'),
        queryFn: () => commercialGet<Members>(`/organizations/${scope.ref}/members`),
        retry: false,
        staleTime: 10_000,
        refetchOnWindowFocus: 'always',
    });
    const mutation = useMutation({
        mutationFn: (operation: () => Promise<unknown>) => operation(),
        onSuccess: async () => {
            await Promise.all([
                client.invalidateQueries({queryKey: commercialQueryKey(accountId, 'HOSPITAL', scope.ref)}),
                client.invalidateQueries({queryKey: commercialQueryKey(accountId, 'context')}),
            ]);
        },
        onError: async (error) => {
            if (('code' in error && error.code === 409) || ('serverCode' in error && error.serverCode === 'STATE_VERSION_CONFLICT')) {
                setEditing(null);
                await client.invalidateQueries({queryKey: commercialQueryKey(accountId, 'HOSPITAL', scope.ref, 'members')});
            }
        },
    });
    const wards = query.data?.availableWards ?? [];
    const busy = mutation.isPending;
    const ownPendingInvitations =
        query.data?.invitations.filter(
            (invitation) =>
                invitation.status === 'PENDING' &&
                (invitation.email ?? invitation.invitedEmailNormalized ?? invitation.invitedEmail)?.trim().toLowerCase() ===
                    email.trim().toLowerCase(),
        ).length ?? 0;
    const seatsFull =
        isAdminSeatLimitReached(entitlement) &&
        entitlement.adminSeats.active + entitlement.adminSeats.reserved - ownPendingInvitations >= entitlement.adminSeats.limit;
    const seatLimit =
        entitlement.restrictionStates?.ADMIN_SEATS === false ? (ko ? '제한 없음' : 'Unlimited') : entitlement.adminSeats.limit;

    useEffect(() => {
        if (adding) emailRef.current?.focus();
    }, [adding]);

    useEffect(() => {
        if (!busy && !adding && restoreAddFocusRef.current) {
            restoreAddFocusRef.current = false;
            addButtonRef.current?.focus();
        }
    }, [adding, busy]);

    function closeAddForm() {
        setAdding(false);
        mutation.reset();
        addButtonRef.current?.focus();
    }

    return (
        <section className="workspace-section hospital-members" aria-labelledby="hospital-members-heading">
            <div className="hospital-members-toolbar">
                <div className="hospital-members-heading">
                    <h2 id="hospital-members-heading">{ko ? '병원 관리자' : 'Hospital administrators'}</h2>
                    <span className="hospital-members-count">
                        {entitlement.adminSeats.active}
                        {ko ? '명' : ' active'}
                    </span>
                    <InfoTip label={ko ? '병원 관리자 권한 안내' : 'About hospital administrator access'}>
                        {ko
                            ? '최고 관리자는 운영 중인 모든 소속 병동의 명단과 근무표를 조회·수정할 수 있습니다. 일반 관리자는 병원 전체 요약과 지정된 병동을 볼 수 있으며, 기존 병동 권한은 유지됩니다.'
                            : 'The owner can view and edit rosters and schedules in all operational hospital wards. Administrators can view hospital summaries and access assigned wards. Existing independent ward access is preserved.'}
                    </InfoTip>
                </div>
                <div className="hospital-members-toolbar-actions">
                    <span className="hospital-members-seat-limit">
                        {ko ? '정원 ' : 'Seat limit '}
                        {seatLimit}
                        {typeof seatLimit === 'number' && ko ? '명' : ''}
                    </span>
                    {isOwner ? (
                        <button
                            ref={addButtonRef}
                            type="button"
                            className="hospital-members-add-button"
                            aria-expanded={adding}
                            aria-controls="hospital-member-add-form"
                            disabled={busy || query.isPending || !!query.error}
                            onClick={() => {
                                mutation.reset();
                                setNotice('');
                                setEditing(null);
                                setAdding(!adding);
                            }}
                        >
                            {ko ? '관리자 추가' : 'Add administrator'}
                        </button>
                    ) : null}
                </div>
            </div>
            {mutation.error ? (
                <p role="alert" className="workspace-error">
                    {commercialError(mutation.error)}
                </p>
            ) : null}
            {notice ? (
                <p role="status" className="workspace-notice">
                    {notice}
                </p>
            ) : null}
            {isOwner && adding ? (
                <form
                    id="hospital-member-add-form"
                    className="hospital-member-add-form"
                    aria-label={ko ? '관리자 추가' : 'Add administrator'}
                    onSubmit={(event) => {
                        event.preventDefault();

                        if (busy || query.isPending || query.error || seatsFull) return;

                        setNotice('');
                        mutation.mutate(async () => {
                            await commercialPost(`/organizations/${scope.ref}/members`, {email: email.trim(), wardIds});
                            setEmail('');
                            setWardIds([]);
                            restoreAddFocusRef.current = true;
                            setAdding(false);
                            setNotice(ko ? '관리자를 추가했습니다.' : 'Administrator added.');
                        });
                    }}
                >
                    <label className="hospital-member-email-field">
                        <span>{ko ? '가입된 계정 이메일' : 'Existing account email'}</span>
                        <input
                            ref={emailRef}
                            type="email"
                            required
                            maxLength={254}
                            autoComplete="off"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            disabled={busy}
                        />
                    </label>
                    <WardChoices wards={wards} selected={wardIds} onChange={setWardIds} disabled={busy} />
                    {seatsFull ? (
                        <p className="workspace-notice">
                            {ko
                                ? '관리자 정원이 가득 찼습니다. 기존 관리자를 제거하거나 정원을 변경해 주세요.'
                                : 'No administrator seats remain. Remove an administrator or request more seats.'}
                        </p>
                    ) : null}
                    {ownPendingInvitations > 0 && !seatsFull ? (
                        <p className="workspace-notice">
                            {ko
                                ? '이 이메일로 보낸 기존 초대를 관리자 등록으로 전환합니다.'
                                : 'The pending invitation for this email will become an active administrator.'}
                        </p>
                    ) : null}
                    <div className="hospital-members-form-actions">
                        <button disabled={busy || query.isPending || !!query.error || seatsFull}>
                            {busy ? (ko ? '등록 중…' : 'Adding…') : ko ? '관리자 등록' : 'Add administrator account'}
                        </button>
                        <button type="button" className="secondary" disabled={busy} onClick={closeAddForm}>
                            {ko ? '취소' : 'Cancel'}
                        </button>
                    </div>
                </form>
            ) : null}
            {query.isPending ? <p role="status">{ko ? '관리자를 불러오는 중입니다.' : 'Loading administrators…'}</p> : null}
            {query.error ? (
                <div className="hospital-members-query-error">
                    <p role="alert" className="workspace-error">
                        {commercialError(query.error)}
                    </p>
                    <button type="button" className="secondary" onClick={() => void query.refetch()}>
                        {ko ? '다시 불러오기' : 'Try again'}
                    </button>
                </div>
            ) : null}
            {query.data ? (
                <table className={isOwner ? 'hospital-members-table hospital-members-table-editable' : 'hospital-members-table'}>
                    <caption className="hospital-members-sr-only">{ko ? '병원 관리자 목록' : 'Hospital administrators'}</caption>
                    <thead>
                        <tr>
                            <th scope="col">{ko ? '관리자' : 'Administrator'}</th>
                            <th scope="col">{ko ? '권한' : 'Role'}</th>
                            <th scope="col">{ko ? '담당 병동' : 'Assigned wards'}</th>
                            {isOwner ? (
                                <th scope="col">
                                    <span className="hospital-members-sr-only">{ko ? '관리' : 'Actions'}</span>
                                </th>
                            ) : null}
                        </tr>
                    </thead>
                    {query.data.members.map((member) => {
                        const id = member.id ?? member.membershipId;
                        const editingThis = member.role !== 'OWNER' && (editing?.id ?? editing?.membershipId) === id && editing !== null;

                        return (
                            <tbody key={id} className="workspace-member-row hospital-member-group">
                                <tr className={editingThis ? 'hospital-member-selected' : undefined}>
                                    <td className="hospital-member-identity">
                                        <strong>{member.name}</strong>
                                        {member.accountId === accountId ? (
                                            <span className="hospital-member-self">{ko ? '내 계정' : 'You'}</span>
                                        ) : null}
                                        {member.email ? <span className="hospital-member-email">{member.email}</span> : null}
                                    </td>
                                    <td className="hospital-member-role" data-label={ko ? '권한' : 'Role'}>
                                        {workspaceRoleLabel(member.role, ko)}
                                    </td>
                                    <td className="hospital-member-wards" data-label={ko ? '담당 병동' : 'Assigned wards'}>
                                        {member.role === 'OWNER' ? (
                                            ko ? (
                                                '모든 소속 병동'
                                            ) : (
                                                'All hospital wards'
                                            )
                                        ) : member.wards?.length ? (
                                            member.wards.map((ward) => ward.name).join(', ')
                                        ) : (
                                            <span className="hospital-members-muted">{ko ? '미지정' : 'Unassigned'}</span>
                                        )}
                                    </td>
                                    {isOwner ? (
                                        <td className="hospital-member-actions">
                                            {member.role !== 'OWNER' ? (
                                                <button
                                                    type="button"
                                                    className="secondary hospital-member-edit"
                                                    aria-label={ko ? '담당 병동 변경' : 'Edit assigned wards'}
                                                    aria-expanded={editingThis}
                                                    disabled={busy || member.version == null}
                                                    onClick={() => {
                                                        mutation.reset();
                                                        setNotice('');
                                                        setAdding(false);
                                                        setEditing(editingThis ? null : member);
                                                        setEditedWards(
                                                            (member.wardIds ?? []).filter((wardId) =>
                                                                wards.some((ward) => ward.wardId === wardId),
                                                            ),
                                                        );
                                                    }}
                                                >
                                                    {ko ? '병동 변경' : 'Edit wards'}
                                                </button>
                                            ) : null}
                                            {member.role !== 'OWNER' ? (
                                                <button
                                                    type="button"
                                                    className="secondary danger hospital-member-remove"
                                                    aria-label={ko ? '관리자 제거' : 'Remove administrator'}
                                                    disabled={busy || member.version == null}
                                                    onClick={() => {
                                                        if (
                                                            !window.confirm(
                                                                ko
                                                                    ? `${member.name} 님의 병원 관리자 권한을 제거할까요? 병원에서 부여한 담당 병동 권한도 함께 해제됩니다.`
                                                                    : `Remove ${member.name} from this hospital and revoke ward access granted here?`,
                                                            )
                                                        )
                                                            return;

                                                        setNotice('');
                                                        mutation.mutate(async () => {
                                                            await commercialPost(`/organizations/${scope.ref}/members/${id}/REMOVE`, {
                                                                expectedVersion: member.version,
                                                            });
                                                            setNotice(ko ? '관리자 권한을 제거했습니다.' : 'Administrator access removed.');
                                                        });
                                                    }}
                                                >
                                                    {ko ? '제거' : 'Remove'}
                                                </button>
                                            ) : null}
                                        </td>
                                    ) : null}
                                </tr>
                                {isOwner && editingThis ? (
                                    <tr className="hospital-member-editor-row">
                                        <td colSpan={4}>
                                            <form
                                                className="hospital-member-editor"
                                                aria-label={`${member.name} ${ko ? '담당 병동 변경' : 'assigned wards'}`}
                                                onSubmit={(event) => {
                                                    event.preventDefault();

                                                    if (busy) return;

                                                    setNotice('');
                                                    mutation.mutate(async () => {
                                                        await commercialPut(`/organizations/${scope.ref}/members/${id}/wards`, {
                                                            expectedVersion: editing.version,
                                                            wardIds: editedWards,
                                                        });
                                                        setEditing(null);
                                                        setNotice(ko ? '담당 병동을 변경했습니다.' : 'Assigned wards updated.');
                                                    });
                                                }}
                                            >
                                                <WardChoices
                                                    wards={wards}
                                                    selected={editedWards}
                                                    onChange={setEditedWards}
                                                    disabled={busy}
                                                />
                                                <div className="hospital-members-form-actions">
                                                    <button disabled={busy}>
                                                        {busy ? (ko ? '저장 중…' : 'Saving…') : ko ? '변경 저장' : 'Save changes'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="secondary"
                                                        disabled={busy}
                                                        onClick={() => {
                                                            setEditing(null);
                                                            mutation.reset();
                                                        }}
                                                    >
                                                        {ko ? '취소' : 'Cancel'}
                                                    </button>
                                                </div>
                                            </form>
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        );
                    })}
                    {query.data.members.length === 0 ? (
                        <tbody>
                            <tr>
                                <td className="hospital-members-empty" colSpan={isOwner ? 4 : 3}>
                                    {ko ? '등록된 관리자가 없습니다.' : 'No administrators yet.'}
                                </td>
                            </tr>
                        </tbody>
                    ) : null}
                </table>
            ) : null}
            {isOwner && query.data && !query.error ? <HospitalOwnershipTransfer scope={scope} members={query.data.members} /> : null}
        </section>
    );
}
