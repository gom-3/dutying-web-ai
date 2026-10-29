import {useEffect, useId, useState} from 'react';
import {commercialPost} from '@/features/commercial/api';
import {InfoTip} from './info-tip';
import {ActionsFeedback, useAction, useCopy} from './workspace-ui';
import './workspace-inbox.css';

/** The optional expiry argument keeps the existing onVerified(token) callers compatible. */
export function Reauthenticate({
    onVerified,
    disabled = false,
}: {
    onVerified: (token: string, expiresAt?: number) => void;
    disabled?: boolean;
}) {
    const t = useCopy();
    const action = useAction();
    const codeId = useId();
    const [requested, setRequested] = useState(false);
    const [code, setCode] = useState('');
    const [verifiedUntil, setVerifiedUntil] = useState<number | null>(null);
    const [expired, setExpired] = useState(false);
    const busy = disabled || action.busy;

    useEffect(() => {
        if (!verifiedUntil) return;

        const timer = window.setTimeout(
            () => {
                setVerifiedUntil(null);
                setRequested(false);
                setExpired(true);
                onVerified('');
            },
            Math.max(0, verifiedUntil - Date.now()),
        );

        return () => window.clearTimeout(timer);
    }, [verifiedUntil, onVerified]);

    return (
        <div className="workspace-inbox-reauth">
            <div className="workspace-inbox-step-heading">
                <strong>{t('이메일 본인 확인', 'Verify your email')}</strong>
                <InfoTip label={t('본인 확인 안내', 'About email verification')}>
                    {t(
                        '최고 관리자 인계와 같은 중요한 변경 전에 본인 이메일을 확인합니다. 인증은 10분 동안 유효합니다.',
                        'Verify your email before important changes such as accepting ownership. Verification lasts 10 minutes.',
                    )}
                </InfoTip>
            </div>
            {expired ? (
                <p className="workspace-inbox-meta" role="status">
                    {t('인증 시간이 지났습니다. 인증번호를 다시 받아 주세요.', 'Verification expired. Request a new code.')}
                </p>
            ) : null}
            {verifiedUntil ? (
                <p className="workspace-inbox-verified" role="status">
                    {t('이메일 본인 확인 완료', 'Email verified')}
                </p>
            ) : (
                <>
                    <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                            void action.run(async () => {
                                await commercialPost('/reauthentication/request');
                                setRequested(true);
                                setCode('');
                                setExpired(false);
                                onVerified('');
                                action.setNotice(t('본인 이메일로 인증번호를 보냈습니다.', 'A code was sent to your email.'));
                            })
                        }
                    >
                        {requested ? t('인증번호 다시 받기', 'Resend code') : t('인증번호 받기', 'Send code')}
                    </button>
                    {requested ? (
                        <form
                            className="workspace-inbox-verification"
                            onSubmit={(event) => {
                                event.preventDefault();

                                if (!/^\d{6}$/.test(code) || busy) return;

                                void action.run(async () => {
                                    const response = await commercialPost<{reauthenticationToken: string; expiresAt?: string}>(
                                        '/reauthentication/confirm',
                                        {code},
                                    );

                                    if (!response.reauthenticationToken)
                                        throw new Error(
                                            t(
                                                '인증을 완료하지 못했습니다. 다시 시도해 주세요.',
                                                'Verification could not be completed. Try again.',
                                            ),
                                        );

                                    const rawExpiry = response.expiresAt;
                                    const expiry = rawExpiry
                                        ? new Date(/[Z+-]\d*:?.*$/.test(rawExpiry.slice(10)) ? rawExpiry : `${rawExpiry}Z`).getTime()
                                        : Date.now() + 600_000;

                                    if (!Number.isFinite(expiry) || expiry <= Date.now())
                                        throw new Error(
                                            t(
                                                '인증 시간이 지났습니다. 인증번호를 다시 받아 주세요.',
                                                'Verification expired. Request a new code.',
                                            ),
                                        );

                                    const cappedExpiry = Math.min(expiry, Date.now() + 600_000);

                                    setVerifiedUntil(cappedExpiry);
                                    setCode('');
                                    onVerified(response.reauthenticationToken, cappedExpiry);
                                });
                            }}
                        >
                            <label htmlFor={codeId}>{t('이메일 인증번호', 'Email verification code')}</label>
                            <div>
                                <input
                                    id={codeId}
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="[0-9]{6}"
                                    maxLength={6}
                                    required
                                    value={code}
                                    disabled={busy}
                                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                                />
                                <button type="submit" disabled={busy || code.length !== 6}>
                                    {t('본인 확인', 'Verify')}
                                </button>
                            </div>
                        </form>
                    ) : null}
                </>
            )}
            <ActionsFeedback action={action} />
        </div>
    );
}
