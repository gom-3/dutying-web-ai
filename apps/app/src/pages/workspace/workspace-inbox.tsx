import {useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import useAuthStore from '@/features/auth/model/store';
import {commercialPost, commercialQueryKey, type AccessContext, type Invitation, type Transfer} from '@/features/commercial/api';
import {workspaceRoleLabel} from '@/features/commercial/hospital-entry';
import {InfoTip} from './info-tip';
import {Reauthenticate} from './reauthentication';
import {ActionsFeedback, ErrorView, Section, useAction, useCopy} from './workspace-ui';
import './workspace-inbox.css';

type TInboxProps = {
    context?: AccessContext;
    loading?: boolean;
    error?: unknown;
    onRetry?: () => void;
    compact?: boolean;
};
type TProof = {token: string; expiresAt: number};

const epoch = (value: string) => new Date(/[Z+-]\d*:?.*$/.test(value.slice(10)) ? value : `${value}Z`).getTime();
const expires = (value: string) => !!value && Number.isFinite(epoch(value)) && epoch(value) <= Date.now();
const pendingRequest = (status: string, expiresAt: string) =>
    status === 'PENDING' && (!expiresAt || (Number.isFinite(epoch(expiresAt)) && !expires(expiresAt)));
const dateLabel = (value: string, ko: boolean) =>
    value && Number.isFinite(epoch(value))
        ? new Date(epoch(value)).toLocaleString(ko ? 'ko-KR' : 'en-US', {
              timeZone: 'Asia/Seoul',
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
          })
        : ko
          ? '만료일 없음'
          : 'No expiry';
const invitationKey = (entry: Invitation) => `${entry.type}:${entry.invitation.id}:${entry.invitation.version ?? ''}`;
const transferKey = (entry: Transfer) => `${entry.id}:${entry.version}`;
const transferName = (entry: Transfer, context: AccessContext, ko: boolean) => {
    const name = context.scopes.find((scope) => scope.type === entry.scopeType && String(scope.ref) === String(entry.scopeRef))?.name;

    return name?.trim()
        ? name
        : `${entry.scopeType === 'HOSPITAL' ? (ko ? '병원' : 'Hospital') : ko ? '병동' : 'Ward'} · ${String(entry.scopeRef).slice(0, 8)}`;
};

function InvitationItem({
    entry,
    handled,
    onHandled,
}: {
    entry: Invitation;
    handled: boolean;
    onHandled: (key: string, message: string) => void;
}) {
    const t = useCopy();
    const action = useAction();
    const ko = t('ko', 'en') === 'ko';
    const expired = expires(entry.invitation.expiresAt);
    const pending = entry.invitation.status === 'PENDING' && !expired && !handled;
    const name =
        entry.name ||
        `${entry.type === 'HOSPITAL' ? t('병원', 'Hospital') : t('병동', 'Ward')} · ${entry.invitation.organizationId?.slice(0, 8) ?? entry.invitation.wardId ?? entry.invitation.id}`;

    return (
        <li className="workspace-inbox-item">
            <div className="workspace-inbox-item-content">
                <span className="workspace-inbox-type">
                    {entry.type === 'HOSPITAL' ? t('병원 초대', 'Hospital invitation') : t('병동 초대', 'Ward invitation')}
                </span>
                <h3>{name}</h3>
                <p>{workspaceRoleLabel(entry.invitation.role ?? (entry.type === 'HOSPITAL' ? 'MANAGER' : 'EDITOR'), ko)}</p>
                <p className="workspace-inbox-meta">
                    {entry.invitation.expiresAt
                        ? `${t('만료', 'Expires')} ${dateLabel(entry.invitation.expiresAt, ko)}`
                        : dateLabel('', ko)}
                </p>
            </div>
            {pending ? (
                <div className="workspace-inbox-actions">
                    <button
                        type="button"
                        disabled={action.busy}
                        onClick={() =>
                            void action.run(async () => {
                                await commercialPost(
                                    entry.type === 'WARD'
                                        ? `/ward-invitations/${entry.invitation.id}/ACCEPT`
                                        : `/invitations/${entry.invitation.id}/ACCEPT`,
                                    {expectedVersion: entry.invitation.version},
                                );
                                onHandled(
                                    invitationKey(entry),
                                    t(`${name} 초대를 수락했습니다.`, `You accepted the invitation to ${name}.`),
                                );
                            })
                        }
                    >
                        {t('수락하고 참여', 'Accept invitation')}
                    </button>
                    <button
                        type="button"
                        className="secondary"
                        disabled={action.busy}
                        onClick={() =>
                            void action.run(async () => {
                                await commercialPost(
                                    entry.type === 'WARD'
                                        ? `/ward-invitations/${entry.invitation.id}/DECLINE`
                                        : `/invitations/${entry.invitation.id}/DECLINE`,
                                    {expectedVersion: entry.invitation.version},
                                );
                                onHandled(invitationKey(entry), t('초대를 거절했습니다.', 'Invitation declined.'));
                            })
                        }
                    >
                        {t('거절', 'Decline')}
                    </button>
                </div>
            ) : (
                <span className="workspace-inbox-state">
                    {handled ? t('처리 완료', 'Completed') : expired ? t('만료됨', 'Expired') : t('종료된 초대', 'Closed invitation')}
                </span>
            )}
            <ActionsFeedback action={action} />
        </li>
    );
}

function TransferAcceptance({
    entry,
    name,
    onHandled,
    onCancel,
}: {
    entry: Transfer;
    name: string;
    onHandled: (key: string, message: string) => void;
    onCancel: () => void;
}) {
    const t = useCopy();
    const action = useAction();
    const [proof, setProof] = useState<TProof | null>(null);
    const [responsibility, setResponsibility] = useState(false);
    const [verificationAttempt, setVerificationAttempt] = useState(0);

    return (
        <div className="workspace-inbox-acceptance" role="group" aria-label={t(`${name} 인계 수락 절차`, `Accept ownership of ${name}`)}>
            <Reauthenticate
                key={verificationAttempt}
                disabled={action.busy}
                onVerified={(token, expiresAt) => {
                    setProof(token ? {token, expiresAt: expiresAt ?? Date.now() + 600_000} : null);
                    setResponsibility(false);
                }}
            />
            {proof ? (
                <form
                    className="workspace-inbox-responsibility"
                    onSubmit={(event) => {
                        event.preventDefault();

                        if (!responsibility || proof.expiresAt <= Date.now() || expires(entry.expiresAt)) return;

                        void action.run(async () => {
                            try {
                                await commercialPost(`/owner-transfers/${entry.id}/ACCEPT`, {
                                    expectedVersion: entry.version,
                                    reauthenticationToken: proof.token,
                                    stopRenewal: true,
                                    acceptContractResponsibility: true,
                                });
                                onHandled(
                                    transferKey(entry),
                                    t(`${name}의 최고 관리자 인계를 수락했습니다.`, `You accepted ownership of ${name}.`),
                                );
                            } catch (cause) {
                                if (cause instanceof Error && 'serverCode' in cause && cause.serverCode === 'REAUTHENTICATION_REQUIRED') {
                                    setProof(null);
                                    setResponsibility(false);
                                    setVerificationAttempt((attempt) => attempt + 1);
                                }

                                throw cause;
                            }
                        });
                    }}
                >
                    <div className="workspace-inbox-step-heading">
                        <strong>{t('2. 인계 조건 확인', '2. Review transfer terms')}</strong>
                        <InfoTip label={t('최고 관리자 책임 안내', 'About owner responsibilities')}>
                            {t(
                                '기존 결제 카드는 인계되지 않습니다. 유료 구독은 기존 카드 갱신을 중단하며, 후불 계약이 있다면 새 최고 관리자가 담당 책임을 인수합니다.',
                                'Payment cards are not transferred. Existing paid renewal mandates stop, and the new owner assumes any postpaid contract responsibilities.',
                            )}
                        </InfoTip>
                    </div>
                    <label className="workspace-inbox-consent">
                        <input
                            type="checkbox"
                            checked={responsibility}
                            disabled={action.busy}
                            onChange={(event) => setResponsibility(event.target.checked)}
                        />
                        <span>
                            {t(
                                '기존 카드 갱신 중단과 후불 계약이 있는 경우의 담당 책임 인수에 동의합니다.',
                                'I agree to stop the previous payment mandate and accept responsibility for any postpaid contract.',
                            )}
                        </span>
                    </label>
                    <button type="submit" disabled={!responsibility || action.busy}>
                        {t('동의하고 인계 수락', 'Agree & accept transfer')}
                    </button>
                </form>
            ) : null}
            <ActionsFeedback action={action} />
            <button type="button" className="secondary workspace-inbox-close" disabled={action.busy} onClick={onCancel}>
                {t('수락 절차 닫기', 'Close acceptance')}
            </button>
        </div>
    );
}

function TransferItem({
    entry,
    context,
    incoming,
    selected,
    handled,
    onSelect,
    onHandled,
}: {
    entry: Transfer;
    context: AccessContext;
    incoming: boolean;
    selected: boolean;
    handled: boolean;
    onSelect: (key: string | null) => void;
    onHandled: (key: string, message: string) => void;
}) {
    const t = useCopy();
    const action = useAction();
    const ko = t('ko', 'en') === 'ko';
    const name = transferName(entry, context, ko);
    const expired = expires(entry.expiresAt);
    const pending = entry.status === 'PENDING' && !expired && !handled;

    return (
        <li className="workspace-inbox-item">
            <div className="workspace-inbox-item-content">
                <span className="workspace-inbox-type">{entry.scopeType === 'HOSPITAL' ? t('병원', 'Hospital') : t('병동', 'Ward')}</span>
                <h3>{name}</h3>
                <p>
                    {incoming
                        ? t('최고 관리자 역할 인수 요청', 'Ownership offered to you')
                        : t('상대 관리자의 수락 대기', 'Waiting for the recipient to accept')}
                </p>
                <p className="workspace-inbox-meta">
                    {t('만료', 'Expires')} {dateLabel(entry.expiresAt, ko)}
                </p>
            </div>
            {pending ? (
                <div className="workspace-inbox-actions">
                    {incoming ? (
                        <button
                            type="button"
                            aria-expanded={selected}
                            disabled={action.busy}
                            onClick={() => onSelect(selected ? null : transferKey(entry))}
                        >
                            {selected ? t('수락 절차 열림', 'Acceptance open') : t('수락 절차 시작', 'Review & accept')}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className="secondary"
                        disabled={action.busy}
                        onClick={() =>
                            void action.run(async () => {
                                await commercialPost(`/owner-transfers/${entry.id}/${incoming ? 'DECLINE' : 'CANCEL'}`, {
                                    expectedVersion: entry.version,
                                    reauthenticationToken: 'not-required',
                                    stopRenewal: false,
                                    acceptContractResponsibility: false,
                                });
                                onHandled(
                                    transferKey(entry),
                                    incoming
                                        ? t('인계 요청을 거절했습니다.', 'Transfer declined.')
                                        : t('보낸 인계 요청을 취소했습니다.', 'Transfer request cancelled.'),
                                );
                            })
                        }
                    >
                        {incoming ? t('거절', 'Decline') : t('요청 취소', 'Cancel request')}
                    </button>
                </div>
            ) : (
                <span className="workspace-inbox-state">
                    {handled ? t('처리 완료', 'Completed') : expired ? t('만료됨', 'Expired') : t('종료된 요청', 'Closed request')}
                </span>
            )}
            {pending && incoming && selected ? (
                <TransferAcceptance
                    key={transferKey(entry)}
                    entry={entry}
                    name={name}
                    onHandled={onHandled}
                    onCancel={() => onSelect(null)}
                />
            ) : null}
            <ActionsFeedback action={action} />
        </li>
    );
}

export function WorkspaceInbox({context, loading = false, error, onRetry, compact = false}: TInboxProps) {
    const t = useCopy();
    const accountId = useAuthStore((state) => state.accountId);
    const client = useQueryClient();
    const [selected, setSelected] = useState<string | null>(null);
    const [handled, setHandled] = useState<Set<string>>(() => new Set());
    const [notice, setNotice] = useState('');
    const retry = onRetry ?? (() => void client.invalidateQueries({queryKey: commercialQueryKey(accountId, 'context')}));
    const complete = (key: string, message: string) => {
        setHandled((previous) => new Set(previous).add(key));
        setSelected(null);
        setNotice(message);
    };

    if (loading)
        return (
            <div className="workspace-inbox-page">
                <Section title={t('초대·인계', 'Invitations & transfers')}>
                    <p className="workspace-inbox-empty" role="status">
                        {t('받은 요청을 불러오는 중입니다.', 'Loading your requests…')}
                    </p>
                </Section>
            </div>
        );

    if (error || !context)
        return (
            <div className="workspace-inbox-page">
                <Section title={t('초대·인계', 'Invitations & transfers')}>
                    <ErrorView error={error} />
                    <p>{t('요청을 불러오지 못했습니다.', 'Could not load your requests.')}</p>
                    <button type="button" className="secondary" onClick={retry}>
                        {t('다시 불러오기', 'Try again')}
                    </button>
                </Section>
            </div>
        );

    const invitations = (context.invitations ?? []).filter(
        (entry) => !compact || (pendingRequest(entry.invitation.status, entry.invitation.expiresAt) && !handled.has(invitationKey(entry))),
    );
    const transfers = (context.transfers ?? []).filter(
        (entry) => !compact || (pendingRequest(entry.status, entry.expiresAt) && !handled.has(transferKey(entry))),
    );
    const incoming = transfers.filter((entry) => entry.toAccountId === accountId);
    const outgoing = transfers.filter((entry) => entry.fromAccountId === accountId && entry.toAccountId !== accountId);

    if (compact && !invitations.length && !incoming.length && !outgoing.length && !notice) return null;

    return (
        <div className="workspace-inbox-page">
            {notice ? (
                <p className="workspace-inbox-result" role="status">
                    {notice}
                </p>
            ) : null}
            {!compact || invitations.length ? (
                <Section
                    title={t('받은 초대', 'Received invitations')}
                    className="workspace-inbox-section"
                    help={t(
                        '병동과 병원에 관리자로 참여하는 초대입니다. 초대받은 이메일 계정으로 수락해야 합니다.',
                        'Invitations to administer a ward or hospital. Accept using the email account that was invited.',
                    )}
                    actions={<span className="workspace-inbox-count">{invitations.length}</span>}
                >
                    {invitations.length ? (
                        <ul className="workspace-inbox-list">
                            {invitations.map((entry) => (
                                <InvitationItem
                                    key={invitationKey(entry)}
                                    entry={entry}
                                    handled={handled.has(invitationKey(entry))}
                                    onHandled={complete}
                                />
                            ))}
                        </ul>
                    ) : (
                        <p className="workspace-inbox-empty">{t('받은 초대가 없습니다.', 'No invitations received.')}</p>
                    )}
                </Section>
            ) : null}
            {!compact || incoming.length || outgoing.length ? (
                <Section
                    title={t('최고 관리자 인계', 'Ownership transfers')}
                    className="workspace-inbox-section"
                    help={t(
                        '기존 최고 관리자가 권한을 넘기는 요청입니다. 받은 요청을 수락할 때만 본인 확인과 책임 동의가 필요합니다.',
                        'Requests to transfer ownership. Only accepting a received transfer requires verification and responsibility consent.',
                    )}
                >
                    {!compact || incoming.length ? (
                        <div className="workspace-inbox-group">
                            <h3>
                                {t('받은 인계 요청', 'Received transfer requests')}
                                <span aria-hidden="true">{incoming.length}</span>
                            </h3>
                            {incoming.length ? (
                                <ul className="workspace-inbox-list">
                                    {incoming.map((entry) => (
                                        <TransferItem
                                            key={transferKey(entry)}
                                            entry={entry}
                                            context={context}
                                            incoming
                                            selected={selected === transferKey(entry)}
                                            handled={handled.has(transferKey(entry))}
                                            onSelect={setSelected}
                                            onHandled={complete}
                                        />
                                    ))}
                                </ul>
                            ) : (
                                <p className="workspace-inbox-empty">{t('받은 인계 요청이 없습니다.', 'No transfer requests received.')}</p>
                            )}
                        </div>
                    ) : null}
                    {!compact || outgoing.length ? (
                        <div className="workspace-inbox-group">
                            <h3>
                                {t('보낸 인계 요청', 'Sent transfer requests')}
                                <span aria-hidden="true">{outgoing.length}</span>
                            </h3>
                            {outgoing.length ? (
                                <ul className="workspace-inbox-list">
                                    {outgoing.map((entry) => (
                                        <TransferItem
                                            key={transferKey(entry)}
                                            entry={entry}
                                            context={context}
                                            incoming={false}
                                            selected={false}
                                            handled={handled.has(transferKey(entry))}
                                            onSelect={setSelected}
                                            onHandled={complete}
                                        />
                                    ))}
                                </ul>
                            ) : (
                                <p className="workspace-inbox-empty">{t('보낸 인계 요청이 없습니다.', 'No transfer requests sent.')}</p>
                            )}
                        </div>
                    ) : null}
                </Section>
            ) : null}
        </div>
    );
}
