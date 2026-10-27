import {useQueryClient} from '@tanstack/react-query';
import {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {commercialError, legacyPost, type WardLink} from '@/features/commercial/api';
import {InfoTip} from './info-tip';
import './hospital-ward-invite.css';

export function HospitalWardInvite({ward, created, onClose}: {ward: WardLink; created: boolean; onClose: () => void}) {
    const {i18n} = useTranslation();
    const ko = i18n.language.startsWith('ko');
    const client = useQueryClient();
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const [sentEmail, setSentEmail] = useState('');
    const [copyNotice, setCopyNotice] = useState('');
    const submitting = useRef(false);
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (ward.canManageStaff) input.current?.focus();
    }, [ward.canManageStaff, ward.wardId]);

    if (!ward.canManageStaff) return null;

    const invite = async (form: HTMLFormElement) => {
        if (submitting.current || !form.reportValidity()) return;

        const normalizedEmail = email.trim().toLowerCase();

        if (!normalizedEmail) return;

        submitting.current = true;
        setBusy(true);
        setError(null);
        setSentEmail('');

        try {
            await legacyPost(`/admin/wards/${ward.wardId}/admin-emails`, {email: normalizedEmail, role: 'EDITOR'});
            setSentEmail(normalizedEmail);
            setEmail('');
            await client.invalidateQueries({queryKey: ['commercial']});
        } catch (cause) {
            setError(cause);
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    };

    return (
        <section className="hospital-ward-invite" aria-labelledby={`ward-invite-title-${ward.wardId}`}>
            <div className="hospital-ward-invite-heading">
                <div className="hospital-ward-invite-title">
                    {created ? <span className="hospital-ward-invite-ready">{ko ? '세팅 완료' : 'Setup complete'}</span> : null}
                    <h3 id={`ward-invite-title-${ward.wardId}`}>
                        {created
                            ? ko
                                ? `${ward.name ?? '병동'} 세팅이 완료됐어요`
                                : `${ward.name ?? 'Ward'} is ready`
                            : ko
                              ? `${ward.name ?? '병동'} 담당자 초대`
                              : `Invite staff to ${ward.name ?? 'ward'}`}
                    </h3>
                    <InfoTip label={ko ? '병동 담당자 권한 안내' : 'About ward staff permissions'}>
                        {ko
                            ? '초대를 수락한 담당자는 이 병동의 명단과 근무표를 관리합니다. 병원 관리자 권한은 별도로 설정합니다.'
                            : 'After accepting, staff can manage this ward’s roster and schedules. Hospital administration is assigned separately.'}
                    </InfoTip>
                </div>
                <button type="button" className="secondary" disabled={busy} onClick={onClose}>
                    {ko ? '닫기' : 'Close'}
                </button>
            </div>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    void invite(event.currentTarget);
                }}
            >
                <label className="hospital-ward-invite-field">
                    <span>{ko ? '초대할 담당자 이메일' : 'Staff email'}</span>
                    <input
                        ref={input}
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                        disabled={busy}
                        value={email}
                        placeholder="name@hospital.com"
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </label>
                <button disabled={busy || !email.trim()}>
                    {busy ? (ko ? '초대 중…' : 'Inviting…') : ko ? '초대 메일 보내기' : 'Send invitation'}
                </button>
            </form>
            {sentEmail ? (
                <p role="status" className="hospital-ward-invite-success">
                    {ko
                        ? `${sentEmail}에 초대 메일 발송을 요청했습니다. 같은 이메일 계정으로 수락해 주세요.`
                        : `Invitation requested for ${sentEmail}. Accept with the same email account.`}
                </p>
            ) : null}
            {error ? (
                <p role="alert" className="workspace-error">
                    {commercialError(error)}
                </p>
            ) : null}
            {ward.wardCode ? (
                <details className="hospital-ward-code">
                    <summary>{ko ? '병동 코드로 안내하기' : 'Share the ward code'}</summary>
                    <div className="hospital-ward-code-value">
                        <code>{ward.wardCode}</code>
                        <button
                            type="button"
                            className="secondary"
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(ward.wardCode!);
                                    setCopyNotice(ko ? '병동 코드를 복사했습니다.' : 'Ward code copied.');
                                } catch {
                                    setCopyNotice(
                                        ko
                                            ? '복사하지 못했습니다. 표시된 코드를 선택해 복사해 주세요.'
                                            : 'Could not copy. Select and copy the code above.',
                                    );
                                }
                            }}
                        >
                            {ko ? '코드 복사' : 'Copy code'}
                        </button>
                        <InfoTip label={ko ? '병동 코드 사용 방법' : 'How to use the ward code'}>
                            {ko
                                ? '이메일로 먼저 초대한 뒤 코드를 전달하세요. 초대받은 이메일로 로그인하고 ‘기존 병동 입장하기’에서 입력합니다.'
                                : 'Invite by email first, then share the code. Sign in with that email and enter the code under “Enter an existing ward”.'}
                        </InfoTip>
                    </div>
                    <p>{ko ? '코드만으로는 참여할 수 없습니다.' : 'A code alone does not grant access.'}</p>
                    {copyNotice ? <p role="status">{copyNotice}</p> : null}
                </details>
            ) : null}
        </section>
    );
}
