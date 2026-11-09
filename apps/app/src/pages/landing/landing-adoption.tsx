import {useEffect, useRef, useState, useSyncExternalStore, type FormEvent} from 'react';
import {Trans} from 'react-i18next';
import {SELLER} from '@/shared/business/profile';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {trackLandingAdoption} from './landing-adoption-analytics';
import './landing-adoption.css';

type TAdoptionResult = 'idle' | 'sending' | 'accepted' | 'failed';

const adoptionFields = [
    {name: 'hospitalName', autoComplete: 'organization', maxLength: 100},
    {name: 'wardName', autoComplete: undefined, maxLength: 100},
    {name: 'contact', autoComplete: undefined, maxLength: 160},
] as const;

type TAdoptionField = (typeof adoptionFields)[number]['name'];
type TAdoptionError = {message: string; field?: TAdoptionField};

const subscribeToHydration = () => () => undefined;
const getClientHydration = () => true;
const getServerHydration = () => false;

function getAdoptionEndpoint(value: string | undefined) {
    if (!value?.trim()) return null;

    try {
        const url = new URL(value);

        return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch {
        return null;
    }
}

function isContactValid(contact: string) {
    const phoneDigits = contact.replace(/\D/g, '');
    const isPhone = /^\+?[\d\s().-]+$/.test(contact) && phoneDigits.length >= 7 && phoneDigits.length <= 15;

    return isPhone || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
}

export function LandingAdoption() {
    const {t} = useTypedTranslation();
    const endpoint = getAdoptionEndpoint(import.meta.env.VITE_LANDING_ADOPTION_ENDPOINT);
    // Render the form only once its submit handler can prevent a native POST to the landing page.
    const isHydrated = useSyncExternalStore(subscribeToHydration, getClientHydration, getServerHydration);
    const formStarted = useRef(false);
    const pending = useRef(false);
    const submission = useRef<{body: string; requestId: string} | null>(null);
    const confirmation = useRef<HTMLDivElement>(null);
    const [result, setResult] = useState<TAdoptionResult>('idle');
    const [error, setError] = useState<TAdoptionError | null>(null);

    useEffect(() => {
        if (result === 'accepted') confirmation.current?.focus();
    }, [result]);

    function trackFormStart() {
        if (formStarted.current) return;

        formStarted.current = true;
        trackLandingAdoption('form_start');
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (pending.current || result === 'accepted') return;

        const form = event.currentTarget;
        const data = new FormData(form);
        const hospitalName = String(data.get('hospitalName') ?? '').trim();
        const wardName = String(data.get('wardName') ?? '').trim();
        const contact = String(data.get('contact') ?? '').trim();

        if (!data.has('privacyConsent')) return;

        setError(null);

        if (!hospitalName || !wardName || !isContactValid(contact)) {
            setResult('idle');

            const invalidField = !hospitalName ? 'hospitalName' : !wardName ? 'wardName' : 'contact';

            setError({field: invalidField, message: t(`page.landing.adoption.validation.${invalidField}`)});
            form.querySelector<HTMLInputElement>(`[name="${invalidField}"]`)?.focus();

            return;
        }

        if (!endpoint) {
            const subject = t('page.landing.adoption.emailSubject');
            const body = [
                `${t('page.landing.adoption.fields.hospitalName')}: ${hospitalName}`,
                `${t('page.landing.adoption.fields.wardName')}: ${wardName}`,
                `${t('page.landing.adoption.fields.contact')}: ${contact}`,
                '',
                t('page.landing.adoption.emailConsent'),
            ].join('\r\n');

            trackLandingAdoption('email_handoff');
            window.location.assign(`mailto:${SELLER.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);

            return;
        }

        const values = {hospitalName, wardName, contact, privacyConsent: true};
        const body = JSON.stringify(values);

        pending.current = true;
        setResult('sending');

        try {
            // Reuse the ID when retrying an unchanged application after an uncertain response.
            if (submission.current?.body !== body) submission.current = {body, requestId: crypto.randomUUID()};

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'omit',
                redirect: 'error',
                signal: AbortSignal.timeout(15_000),
                body: JSON.stringify({...values, requestId: submission.current.requestId}),
            });

            if (!response.ok || (await response.json())?.accepted !== true) {
                throw new Error('Application was not acknowledged');
            }

            setResult('accepted');
            trackLandingAdoption('form_success');
            submission.current = null;
            form.reset();
        } catch {
            setResult('failed');
            setError({message: t('page.landing.adoption.submitError')});
        } finally {
            pending.current = false;
        }
    }

    return (
        <section className="landing-adoption" id="adoption" aria-labelledby="landing-adoption-title">
            <div className="landing-adoption__layout">
                <header className="landing-adoption__intro">
                    <h2 id="landing-adoption-title">{t('page.landing.adoption.title')}</h2>
                </header>

                <div className="landing-adoption__panel">
                    {isHydrated && result !== 'accepted' && (
                        <form method="post" onSubmit={(event) => void handleSubmit(event)} aria-busy={result === 'sending'}>
                            <fieldset disabled={result === 'sending'} className="landing-adoption__fields">
                                <legend className="sr-only">{t('page.landing.adoption.formLegend')}</legend>
                                <div className="landing-adoption__input-grid">
                                    {adoptionFields.map(({name, autoComplete, maxLength}) => {
                                        const id = `landing-adoption-${name}`;
                                        const fieldError = error?.field === name ? error.message : undefined;
                                        const isContact = name === 'contact';

                                        return (
                                            <div className="landing-adoption__field" key={name}>
                                                <label htmlFor={id}>{t(`page.landing.adoption.fields.${name}`)}</label>
                                                <input
                                                    id={id}
                                                    name={name}
                                                    autoComplete={autoComplete}
                                                    aria-invalid={Boolean(fieldError) || undefined}
                                                    aria-describedby={fieldError ? `${id}-error` : isContact ? `${id}-hint` : undefined}
                                                    placeholder={isContact ? t('page.landing.adoption.contactPlaceholder') : undefined}
                                                    maxLength={maxLength}
                                                    spellCheck={isContact ? false : undefined}
                                                    onFocus={trackFormStart}
                                                    onChange={() => {
                                                        if (fieldError) setError(null);
                                                    }}
                                                    required
                                                />
                                                {isContact && (
                                                    <span className="sr-only" id={`${id}-hint`}>
                                                        {t('page.landing.adoption.contactHint')}
                                                    </span>
                                                )}
                                                {fieldError && (
                                                    <p className="landing-adoption__error" id={`${id}-error`} role="alert">
                                                        {fieldError}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="landing-adoption__form-footer">
                                    <div className="landing-adoption__consent">
                                        <input
                                            id="landing-adoption-consent"
                                            name="privacyConsent"
                                            type="checkbox"
                                            aria-labelledby="landing-adoption-consent-copy"
                                            required
                                        />
                                        <span id="landing-adoption-consent-copy">
                                            <Trans
                                                i18nKey="page.landing.adoption.privacyConsent"
                                                components={{
                                                    policy: <a href={ROUTE.PRIVACY} />,
                                                    consent: <label htmlFor="landing-adoption-consent" />,
                                                }}
                                            />
                                        </span>
                                    </div>
                                    <div className="landing-adoption__action">
                                        <button type="submit" className="landing-adoption__submit">
                                            {result === 'sending' ? t('page.landing.adoption.sending') : t('page.landing.header.inquiry')}
                                        </button>
                                        {error && !error.field && (
                                            <p className="landing-adoption__error" role="alert">
                                                {error.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </fieldset>
                        </form>
                    )}
                    <div
                        className="landing-adoption__status"
                        ref={confirmation}
                        role="status"
                        tabIndex={result === 'accepted' ? -1 : undefined}
                    >
                        {result === 'accepted' && (
                            <>
                                <strong>{t('page.landing.adoption.acceptedTitle')}</strong>
                                <p>{t('page.landing.adoption.acceptedDescription')}</p>
                            </>
                        )}
                    </div>
                    {result !== 'accepted' && (
                        <p className="landing-adoption__hint landing-adoption__email">
                            {t(isHydrated ? 'page.landing.adoption.emailLabel' : 'page.landing.adoption.emailFallback')}{' '}
                            <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}
