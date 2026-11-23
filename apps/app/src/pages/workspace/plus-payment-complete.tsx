import {useEffect, useId, useRef} from 'react';
import {Link} from 'react-router';
import type {Order} from '@/features/commercial/api';
import {parseSubscriptionSummary, quoteTimestamp} from '@/features/commercial/quote-terms';
import {useCopy} from './workspace-ui';
import './plus-payment-complete.css';

export function PlusPaymentComplete({order, backPath}: {order: Order; backPath: string}) {
    const t = useCopy();
    const headingId = useId();
    const heading = useRef<HTMLHeadingElement>(null);
    const summary = parseSubscriptionSummary(order.subscriptionSummary);
    const validAmount = Number.isSafeInteger(order.gross) && order.gross > 0 && order.currency === 'KRW';
    const money = (amount: number) => `${new Intl.NumberFormat(t('ko-KR', 'en-GB')).format(amount)}${t('원', ' KRW')}`;
    const day = (value: string) =>
        new Intl.DateTimeFormat(t('ko-KR', 'en-GB'), {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(quoteTimestamp(value));

    useEffect(() => {
        // Checkout controls disappear on success; move focus to the confirmed result.
        heading.current?.focus({preventScroll: true});
    }, []);

    return (
        <section className="workspace-section plus-payment-complete" aria-labelledby={headingId}>
            <header className="plus-payment-complete__header">
                <svg className="plus-payment-complete__icon" viewBox="0 0 56 56" fill="none" aria-hidden="true">
                    <circle cx="28" cy="28" r="28" fill="currentColor" />
                    <path d="m23.5 37.5-9-9 3.5-3.5 5.5 5.5 14-14L41 20 23.5 37.5Z" fill="white" />
                </svg>
                <h2 id={headingId} ref={heading} tabIndex={-1}>
                    {t('Plus 구독이 시작됐어요', 'Your Plus subscription is active')}
                </h2>
                <p>{t('이제 Plus 기능을 이용할 수 있어요.', 'You can now use Plus in your ward.')}</p>
            </header>

            <div className="plus-payment-complete__receipt">
                <dl>
                    {validAmount ? (
                        <div className="plus-payment-complete__total">
                            <dt>{t('결제금액', 'Amount paid')}</dt>
                            <dd>
                                <strong>{money(order.gross)}</strong>
                                <small>{t('부가세 포함', 'VAT included')}</small>
                            </dd>
                        </div>
                    ) : null}
                    {summary ? (
                        <>
                            <div className="plus-payment-complete__detail">
                                <dt>{t('이용 병동', 'Ward')}</dt>
                                <dd>{summary.scopeName}</dd>
                            </div>
                            <div className="plus-payment-complete__detail">
                                <dt>{t('이용기간', 'Service period')}</dt>
                                <dd className="plus-payment-complete__period">
                                    <time dateTime={summary.periodStart}>{day(summary.periodStart)}</time>
                                    <span> ~ </span>
                                    <time dateTime={summary.periodEnd}>{day(summary.periodEnd)}</time>
                                </dd>
                            </div>
                            <div className="plus-payment-complete__detail">
                                <dt>{t('다음 결제일', 'Next payment')}</dt>
                                <dd>
                                    <time dateTime={summary.periodEnd}>{day(summary.periodEnd)}</time>
                                    <small>
                                        {t('월 ', 'Monthly · ')}
                                        {money(summary.monthlyGross)}
                                        {t(' · 부가세 포함', ' · VAT included')}
                                    </small>
                                </dd>
                            </div>
                        </>
                    ) : null}
                </dl>
                {!summary || !validAmount ? (
                    <p className="plus-payment-complete__fallback">
                        {t('상세 내역은 구독 관리에서 확인해 주세요.', 'View your subscription management page for full details.')}
                    </p>
                ) : null}
            </div>

            <p className="plus-payment-complete__renewal">
                {t('해지 전까지 매월 자동결제돼요.', 'Your subscription renews monthly until canceled.')}
            </p>
            <Link className="workspace-button plus-payment-complete__action" to={backPath}>
                {t('구독 관리하기', 'Manage subscription')}
            </Link>
        </section>
    );
}
