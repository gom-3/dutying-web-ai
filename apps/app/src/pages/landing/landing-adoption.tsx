import {useEffect, useRef, useState, useSyncExternalStore, type FormEvent} from 'react';
import {Trans} from 'react-i18next';
import {SELLER} from '@/shared/business/profile';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {trackLandingAdoption} from './landing-adoption-analytics';
import {adoptionSignInUrl, saveAdoptionDraft, takeAdoptionDraft} from './landing-adoption-return';
import './landing-adoption.css';

type TAdoptionResult = 'idle' | 'sending' | 'accepted' | 'failed';

const adoptionFields = [
    {name: 'hospitalName', autoComplete: 'organization', maxLength: 100},
    {name: 'wardName', autoComplete: undefined, maxLength: 100},
    {name: 'contact', autoComplete: undefined, maxLength: 160},
] as const;
const personalSignInProviders = ['google', 'apple', 'kakao'] as const;

type TAdoptionField = (typeof adoptionFields)[number]['name'];
type TAdoptionError = {message: string; field?: TAdoptionField};

const subscribeToHydration = () => () => undefined;
const getClientHydration = () => true;
const getServerHydration = () => false;

function isContactValid(contact: string) {
    const phoneDigits = contact.replace(/\D/g, '');
    const isPhone = /^\+?[\d\s().-]+$/.test(contact) && phoneDigits.length >= 7 && phoneDigits.length <= 15;

    return isPhone || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
}

function readAdoptionForm(data: FormData) {
    return {
        hospitalName: String(data.get('hospitalName') ?? '').trim(),
        wardName: String(data.get('wardName') ?? '').trim(),
        contact: String(data.get('contact') ?? '').trim(),
    };
}

export function LandingAdoption() {
    const {t} = useTypedTranslation();
    // Render the form only once its submit handler can prevent a native POST to the landing page.
    const isHydrated = useSyncExternalStore(subscribeToHydration, getClientHydration, getServerHydration);
    const formStarted = useRef(false);
    const pending = useRef(false);
    const formRef = useRef<HTMLFormElement>(null);
    const confirmation = useRef<HTMLDivElement>(null);
    const [result, setResult] = useState<TAdoptionResult>('idle');
    const [error, setError] = useState<TAdoptionError | null>(null);
    const [signInRequired, setSignInRequired] = useState(false);

    useEffect(() => {
        if (result === 'accepted') confirmation.current?.focus();
    }, [result]);

    useEffect(() => {
        if (!isHydrated || !formRef.current || window.location.hash !== '#adoption') return;

        const draft = takeAdoptionDraft(window.location.pathname);

        if (!draft) return;

        for (const {name} of adoptionFields) {
            const input = formRef.current.elements.namedItem(name) as HTMLInputElement;

            input.value = draft[name];
        }
        (formRef.current.elements.namedItem('privacyConsent') as HTMLInputElement).checked = true;
    }, [isHydrated]);

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
        const values = readAdoptionForm(data);
        const {hospitalName, wardName, contact} = values;

        if (!data.has('privacyConsent')) return;

        setError(null);

        if (!hospitalName || !wardName || !isContactValid(contact)) {
            setResult('idle');

            const invalidField = !hospitalName ? 'hospitalName' : !wardName ? 'wardName' : 'contact';

            setError({field: invalidField, message: t(`page.landing.adoption.validation.${invalidField}`)});
            form.querySelector<HTMLInputElement>(`[name="${invalidField}"]`)?.focus();

            return;
        }

        pending.current = true;
        setResult('sending');
        setSignInRequired(false);

        try {
            const {submitLandingAdoption} = await import('./landing-adoption-api');
            const status = await submitLandingAdoption(values);

            if (status === 'signIn') {
                setResult('idle');
                setSignInRequired(true);

                return;
            }
            if (status === 'emailRequired') {
                setResult('idle');
                setError({field: 'contact', message: t('page.landing.adoption.emailRequired')});
                form.querySelector<HTMLInputElement>('[name="contact"]')?.focus();

                return;
            }

            setResult('accepted');
            trackLandingAdoption('form_success');
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
                        <form ref={formRef} method="post" onSubmit={(event) => void handleSubmit(event)} aria-busy={result === 'sending'}>
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
                                        {signInRequired && (
                                            <div className="landing-adoption__hint" role="status">
                                                <p>{t('page.landing.adoption.signInRequired')}</p>
                                                <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                    {personalSignInProviders.map((provider) => (
                                                        <a
                                                            key={provider}
                                                            href={adoptionSignInUrl(provider, window.location.pathname)}
                                                            onClick={() => {
                                                                if (!formRef.current) return;

                                                                const current = new FormData(formRef.current);

                                                                if (current.has('privacyConsent')) {
                                                                    saveAdoptionDraft(window.location.pathname, readAdoptionForm(current));
                                                                }
                                                            }}
                                                        >
                                                            {t(`page.landing.adoption.signIn.${provider}`)}
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
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
