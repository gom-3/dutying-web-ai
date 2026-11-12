import {Link} from 'react-router';
import type {Policy, QuoteTerms} from '@/features/commercial/api';
import {quoteTimestamp} from '@/features/commercial/quote-terms';
import {useCopy} from './workspace-ui';
import './plus-checkout.css';

type TPlusPricing = Pick<Policy, 'baseGross' | 'includedStaff' | 'extraStaffGross' | 'generate' | 'adjust' | 'adminSeats'>;

const money = (value: number) =>
    new Intl.NumberFormat('ko-KR', {style: 'currency', currency: 'KRW', maximumFractionDigits: 0}).format(value);
const benefitIcons = {
    staff: 'M9 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM1 21v-3a8 8 0 0 1 16 0v3H1zM17 3a4 4 0 0 1 0 8 6 6 0 0 0 0-8zM19 13a7 7 0 0 1 4 6v2h-4v-8z',
    generate: 'm12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2z',
    adjust: 'M3 5h10V3h3v2h5v3h-5v2h-3V8H3V5zm0 11h5v-2h3v2h10v3H11v2H8v-2H3v-3z',
    admins: 'M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM3 22v-2a9 9 0 0 1 18 0v2H3z',
};

export function PlusCheckoutPolicyChevron() {
    return (
        <svg className="plus-checkout-policy-chevron" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="m8.6 4-1.4 1.4 6.6 6.6-6.6 6.6L8.6 20l8-8-8-8Z" />
        </svg>
    );
}

export function PlusCheckoutTermsLinks() {
    const t = useCopy();

    return (
        <>
            {[
                {to: '/subscription-terms', label: t('정기결제 약관', 'Subscription terms')},
                {to: '/refund', label: t('환불 조건', 'Refund policy')},
            ].map(({to, label}) => (
                <Link
                    key={to}
                    className="plus-checkout-policy-row"
                    to={to}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} (${t('새 창', 'new window')})`}
                >
                    <span>{label}</span>
                    <PlusCheckoutPolicyChevron />
                </Link>
            ))}
        </>
    );
}

export function PlusCheckoutConsent({
    checked,
    onChange,
    disabled = false,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}) {
    const t = useCopy();

    return (
        <div className="plus-checkout-consent">
            <label className="plus-checkout-consent__choice">
                <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
                <span className="plus-checkout-consent__copy">
                    {t(
                        '결제금액·대상·기간 및 약관·환불 조건에 동의하며, 매월 자동결제를 신청합니다.',
                        'I agree to the payment amount, scope, period, subscription terms and refund policy, and authorize monthly automatic payments.',
                    )}{' '}
                    <span className="plus-checkout-consent__required">({t('필수', 'Required')})</span>
                </span>
            </label>
        </div>
    );
}

export function PlusCheckoutProgress({
    payment = false,
    emailVerificationRequired = false,
}: {
    payment?: boolean;
    reviewing?: boolean;
    emailVerificationRequired?: boolean;
}) {
    const t = useCopy();
    const steps = [
        emailVerificationRequired
            ? t('요금 확인·이메일 인증·카드 등록', 'Review, verify email & register card')
            : t('요금 확인·카드 등록', 'Review & register card'),
        t('첫 결제·Plus 시작', 'First payment & activation'),
    ];

    return (
        <ol className="plus-checkout-steps" aria-label={t('Plus 구독 절차', 'Plus subscription steps')}>
            {steps.map((step, index) => (
                <li key={step} aria-current={index === (payment ? 1 : 0) ? 'step' : undefined}>
                    <span aria-hidden="true">{index + 1}</span>
                    {step}
                </li>
            ))}
        </ol>
    );
}

export function PlusCheckoutPlan({pricing, scopeName, compact = false}: {pricing?: TPlusPricing; scopeName: string; compact?: boolean}) {
    const t = useCopy();
    const benefits = pricing
        ? [
              {
                  value: pricing.includedStaff,
                  unit: t('명', ' staff'),
                  label: t('기본 편성 인원', 'Included staff'),
                  icon: benefitIcons.staff,
              },
              {
                  value: pricing.generate,
                  unit: t('회', ' uses'),
                  label: t('AI 채우기 / 월', 'AI fill / month'),
                  icon: benefitIcons.generate,
              },
              {value: pricing.adminSeats, unit: t('명', ' seats'), label: t('관리자', 'Administrators'), icon: benefitIcons.admins},
          ]
        : [];

    return (
        <div className={compact ? 'plus-checkout-plan plus-checkout-compact' : 'plus-checkout-plan'}>
            {!compact ? (
                <>
                    <p className="plus-checkout-scope">
                        {scopeName} · {t('병동 1개 월 구독', 'Monthly subscription for one ward')}
                    </p>
                    <div className="plus-checkout-price">
                        <strong>{pricing ? money(pricing.baseGross) : '—'}</strong>
                        <span>{t('/ 월 · 부가세 포함', '/ month · VAT included')}</span>
                    </div>
                </>
            ) : null}
            {pricing ? (
                <>
                    <ul className="plus-checkout-benefits" aria-label={t('Plus 기본 제공', 'Included with Plus')}>
                        {benefits.map((benefit) => (
                            <li key={benefit.label}>
                                <span className="plus-checkout-benefit-icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path fillRule="evenodd" d={benefit.icon} />
                                    </svg>
                                </span>
                                <div>
                                    <strong>
                                        {benefit.value}
                                        <small>{benefit.unit}</small>
                                    </strong>
                                    <span className="plus-checkout-benefit-label">{benefit.label}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className="plus-checkout-extra" role="note" aria-label={t('추가 인원 요금', 'Additional staff pricing')}>
                        <span>{t('기본 인원 초과 시', 'Above the included capacity')}</span>{' '}
                        <strong>
                            {t('1명당 월', 'Per staff / month')} {money(pricing.extraStaffGross)}
                        </strong>
                    </div>
                </>
            ) : (
                <p className="plus-checkout-caption">{t('요금제 설정 중', 'Plan being configured')}</p>
            )}
        </div>
    );
}

export function PlusCheckoutReviewSummary({terms, expiresAt}: {terms: QuoteTerms; expiresAt: string}) {
    const t = useCopy();
    const formatDate = (value: string, exact = false) => {
        const timestamp = quoteTimestamp(value);

        if (!Number.isFinite(timestamp)) return '—';

        return new Intl.DateTimeFormat(t('ko-KR', 'en-GB'), {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            ...(exact ? {hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' as const} : {}),
        }).format(timestamp);
    };

    return (
        <div className="plus-checkout-summary">
            <div className="plus-checkout-total">
                <span>{t('이번 결제금액', 'Due now')}</span>
                <strong>{money(terms.totalAmount)}</strong>
                <small>{t('부가세 포함', 'VAT included')}</small>
                <p>
                    {terms.totalAmount === terms.recurring.monthlyGross ? (
                        t('매월 같은 금액으로 자동결제돼요.', 'Renews monthly at the same amount.')
                    ) : (
                        <>
                            {t('다음 주기부터 매월', 'From the next period, monthly')} <b>{money(terms.recurring.monthlyGross)}</b>
                            {t(' 자동결제돼요.', ' will be charged automatically.')}
                        </>
                    )}
                </p>
            </div>
            <dl className="plus-checkout-summary-facts">
                <div>
                    <dt>{t('이용기간', 'Service period')}</dt>
                    <dd>
                        {formatDate(terms.periodStart)} ~ {formatDate(terms.periodEnd)}
                    </dd>
                </div>
                <div>
                    <dt>{t('다음 결제일', 'Next payment date')}</dt>
                    <dd>{formatDate(terms.periodEnd)}</dd>
                </div>
                <div>
                    <dt>{t('편성 인원', 'Scheduling staff')}</dt>
                    <dd>
                        {Number.isSafeInteger(terms.request.capacity) ? terms.request.capacity : '—'}
                        {t('명', ' staff')}
                    </dd>
                </div>
            </dl>
            <div className="plus-checkout-allowances" aria-label={t('이번 제공량', 'Included uses')}>
                <span>
                    {t('AI 채우기', 'AI fill')}{' '}
                    <strong>
                        {terms.fullUnits}
                        {t('회', ' uses')}
                    </strong>
                </span>
            </div>
            <details className="plus-checkout-detail">
                <summary>{t('세금·결제 상세', 'Tax and payment details')}</summary>
                <dl>
                    <div>
                        <dt>{t('공급가액', 'Net amount')}</dt>
                        <dd>{money(terms.supplyAmount)}</dd>
                    </div>
                    <div>
                        <dt>{t('부가세', 'VAT')}</dt>
                        <dd>{money(terms.taxAmount)}</dd>
                    </div>
                    <div>
                        <dt>{t('정확한 이용기간', 'Exact service period')}</dt>
                        <dd>
                            {formatDate(terms.periodStart, true)} ~ {formatDate(terms.periodEnd, true)} (KST)
                        </dd>
                    </div>
                    <div>
                        <dt>{t('금액 확인 유효시간', 'Amount valid until')}</dt>
                        <dd>{formatDate(expiresAt, true)} (KST)</dd>
                    </div>
                </dl>
            </details>
        </div>
    );
}
