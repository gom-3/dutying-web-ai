import {useId, useState} from 'react';
import useAuthStore from '@/features/auth/model/store';
import {commercialPost, type Member, type Scope} from '@/features/commercial/api';
import {InfoTip} from './info-tip';
import {Reauthenticate} from './reauthentication';
import {ActionsFeedback, useAction, useCopy} from './workspace-ui';

const accountIdOf = (member: Member) => member.accountId ?? member.adminAccountId ?? member.wardAdminAccountId;

function OwnershipRequest({scope, members}: {scope: Scope; members: Member[]}) {
    const t = useCopy();
    const accountId = useAuthStore((state) => state.accountId);
    const action = useAction();
    const targetId = useId();
    const requestId = useId();
    const [target, setTarget] = useState('');
    const [proof, setProof] = useState<{token: string; expiresAt: number} | null>(null);
    const [verificationAttempt, setVerificationAttempt] = useState(0);
    const [sent, setSent] = useState(false);
    // The endpoint returns active memberships. Also exclude explicitly inactive rows for older/extended responses.
    const candidates = members.filter((member) => {
        const id = accountIdOf(member);
        const status = (member as Member & {status?: string}).status;

        return member.role === 'MANAGER' && id != null && id !== accountId && (!status || status === 'ACTIVE');
    });
    const selected = candidates.find((member) => String(accountIdOf(member)) === target);
    const canSubmit = !!selected && !!proof?.token && proof.expiresAt > Date.now() && !sent;

    if (sent)
        return (
            <div className="hospital-owner-transfer-result">
                <p role="status">
                    {t(
                        '인계 요청을 보냈습니다. 상대방이 수락하면 최고 관리자가 변경됩니다.',
                        'Transfer requested. Ownership changes after the recipient accepts.',
                    )}
                </p>
                <a href="/workspace/notices">{t('알림에서 요청 확인', 'View request in notifications')}</a>
            </div>
        );

    return (
        <div className="hospital-owner-transfer-form">
            {candidates.length ? (
                <>
                    <label htmlFor={targetId}>{t('새 최고 관리자', 'New owner')}</label>
                    <select
                        id={targetId}
                        form={requestId}
                        required
                        value={target}
                        disabled={action.busy}
                        onChange={(event) => {
                            setTarget(event.target.value);
                            setProof(null);
                            setVerificationAttempt((attempt) => attempt + 1);
                        }}
                    >
                        <option value="">{t('관리자 선택', 'Select administrator')}</option>
                        {candidates.map((member) => (
                            <option key={accountIdOf(member)} value={accountIdOf(member)}>
                                {member.name}
                                {member.email ? ` · ${member.email}` : ''}
                            </option>
                        ))}
                    </select>
                    {selected ? (
                        <Reauthenticate
                            key={verificationAttempt}
                            disabled={action.busy}
                            onVerified={(token, expiresAt) =>
                                setProof(token ? {token, expiresAt: expiresAt ?? Date.now() + 600_000} : null)
                            }
                        />
                    ) : null}
                    <form
                        id={requestId}
                        aria-label={t('최고 관리자 인계 요청', 'Request ownership transfer')}
                        onSubmit={(event) => {
                            event.preventDefault();

                            if (!canSubmit || action.busy || !proof || proof.expiresAt <= Date.now() || !selected) return;

                            void action.run(async () => {
                                try {
                                    await commercialPost(`/scopes/HOSPITAL/${scope.ref}/owner-transfers`, {
                                        targetAccountId: accountIdOf(selected),
                                        leaveAfter: false,
                                        reauthenticationToken: proof.token,
                                    });
                                    setProof(null);
                                    setSent(true);
                                } catch (cause) {
                                    if (
                                        cause instanceof Error &&
                                        'serverCode' in cause &&
                                        cause.serverCode === 'REAUTHENTICATION_REQUIRED'
                                    ) {
                                        setProof(null);
                                        setVerificationAttempt((attempt) => attempt + 1);
                                    }

                                    throw cause;
                                }
                            });
                        }}
                    >
                        <button type="submit" disabled={!canSubmit || action.busy}>
                            {action.busy ? t('요청 중…', 'Sending…') : t('인계 요청 보내기', 'Send transfer request')}
                        </button>
                    </form>
                </>
            ) : (
                <p>{t('인계할 관리자를 먼저 추가해 주세요.', 'Add another administrator before transferring ownership.')}</p>
            )}
            <ActionsFeedback action={action} />
        </div>
    );
}

export function HospitalOwnershipTransfer({scope, members}: {scope: Scope; members: Member[]}) {
    const t = useCopy();
    const [open, setOpen] = useState(false);

    if (scope.role !== 'OWNER') return null;

    return (
        <details className="hospital-owner-transfer" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
            <summary>{t('최고 관리자 인계', 'Transfer ownership')}</summary>
            {open ? (
                <div className="hospital-owner-transfer-content">
                    <div className="hospital-owner-transfer-help">
                        <span>{t('기존 관리자에게 최고 관리자 역할을 넘깁니다.', 'Transfer ownership to an existing administrator.')}</span>
                        <InfoTip label={t('최고 관리자 인계 안내', 'About ownership transfer')}>
                            {t(
                                '상대방이 7일 이내 본인 확인 후 수락해야 변경됩니다. 결제 카드는 인계되지 않으며, 인계 후에도 내 계정은 병원 관리자로 남습니다. 보낸 요청은 알림에서 취소할 수 있습니다.',
                                'The recipient must verify and accept within 7 days. Payment cards are not transferred. You remain a hospital administrator. Sent requests can be cancelled in notifications.',
                            )}
                        </InfoTip>
                    </div>
                    <OwnershipRequest scope={scope} members={members} />
                </div>
            ) : null}
        </details>
    );
}
