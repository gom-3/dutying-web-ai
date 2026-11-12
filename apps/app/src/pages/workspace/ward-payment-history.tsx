import {Link} from 'react-router';
import type {Billing, Order} from '@/features/commercial/api';
import {quoteTimestamp} from '@/features/commercial/quote-terms';
import {Section, useCopy} from './workspace-ui';
import './ward-payment-history.css';

type TPaymentRecord = {
    id: string;
    amount: number;
    refunded: number;
    kind?: string;
    paidAt?: string;
    orderId?: string;
};

const isAmount = (value: number) => Number.isSafeInteger(value) && value > 0;
const money = (value: number) =>
    new Intl.NumberFormat('ko-KR', {style: 'currency', currency: 'KRW', maximumFractionDigits: 0}).format(value);
const paymentDate = (order: Order) =>
    [order.verifiedAt, order.appliedAt].find(
        (value): value is string => typeof value === 'string' && Number.isFinite(quoteTimestamp(value)),
    );

function paidRecords({orders, invoices}: Billing): TPaymentRecord[] {
    const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
    const records = new Map<string, TPaymentRecord>();
    const seenOrders = new Set<string>();

    for (const order of orders) {
        if (!['APPLIED', 'PAID', 'PAID_PENDING_APPLICATION'].includes(order.status) || !isAmount(order.gross) || seenOrders.has(order.id))
            continue;

        seenOrders.add(order.id);

        const invoice = invoiceById.get(order.invoiceId);
        const key = order.invoiceId ? `invoice:${order.invoiceId}` : `order:${order.id}`;
        const paidAt = paymentDate(order);
        const existing = records.get(key);

        if (existing) {
            existing.amount += order.gross;

            if (paidAt && (!existing.paidAt || quoteTimestamp(paidAt) > quoteTimestamp(existing.paidAt))) {
                existing.paidAt = paidAt;
                existing.orderId = order.id;
            }
        } else {
            records.set(key, {
                id: key,
                amount: order.gross,
                refunded: invoice && isAmount(invoice.refundedGross) ? invoice.refundedGross : 0,
                kind: invoice?.kind ?? (order.subscriptionSummary ? 'SUBSCRIPTION' : undefined),
                paidAt,
                orderId: order.id,
            });
        }
    }

    for (const invoice of invoices) {
        const key = `invoice:${invoice.id}`;

        if (records.has(key) || !isAmount(invoice.allocated)) continue;

        records.set(key, {
            id: key,
            amount: invoice.allocated,
            refunded: isAmount(invoice.refundedGross) ? invoice.refundedGross : 0,
            kind: invoice.kind,
        });
    }

    return [...records.values()].sort((a, b) => (b.paidAt ? quoteTimestamp(b.paidAt) : 0) - (a.paidAt ? quoteTimestamp(a.paidAt) : 0));
}

export function WardPaymentHistory({
    billing,
    pendingOrder,
    paymentReturnPath,
}: {
    billing: Billing;
    pendingOrder?: Order;
    paymentReturnPath: string;
}) {
    const t = useCopy();
    const records = paidRecords(billing);
    const dateFormat = new Intl.DateTimeFormat(t('ko-KR', 'en-GB'), {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const product = (kind?: string) => {
        switch (kind) {
            case 'SUBSCRIPTION':
                return t('Plus 월 구독', 'Plus monthly');
            case 'CAPACITY':
                return t('추가 인원', 'Additional staff');
            case 'USAGE_PACK':
                return t('AI 이용권', 'AI uses');
            case 'SETUP':
                return t('도입 세팅', 'Initial setup');
            default:
                return t('서비스 이용', 'Service purchase');
        }
    };

    return (
        <>
            {pendingOrder ? (
                <div className="ward-payment-history__pending" role="status">
                    <span>
                        {pendingOrder.status === 'PAID_PENDING_APPLICATION'
                            ? t('결제는 완료됐고, 이용권을 적용하고 있어요.', 'Payment is complete. Your subscription is being activated.')
                            : t('결제 결과를 확인하고 있어요.', 'Your payment result is being checked.')}
                    </span>
                    <Link to={`${paymentReturnPath}?orderId=${encodeURIComponent(pendingOrder.id)}`}>
                        {t('결제 상태 확인', 'Check payment status')}
                    </Link>
                </div>
            ) : null}
            {records.length > 0 ? (
                <Section title={t('결제 내역', 'Payment history')} className="ward-payment-history">
                    <div className="ward-payment-history__table">
                        <table>
                            <thead>
                                <tr>
                                    <th scope="col">{t('결제일', 'Date')}</th>
                                    <th scope="col">{t('상품', 'Product')}</th>
                                    <th scope="col">{t('결제 금액', 'Amount')}</th>
                                    <th scope="col">{t('상태', 'Status')}</th>
                                    <th scope="col">{t('상세', 'Details')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map((record) => {
                                    const status =
                                        record.refunded >= record.amount ? 'refunded' : record.refunded > 0 ? 'partial-refund' : 'paid';

                                    return (
                                        <tr key={record.id} data-status={status}>
                                            <td className="ward-payment-history__date">
                                                {record.paidAt ? (
                                                    <time dateTime={record.paidAt}>{dateFormat.format(quoteTimestamp(record.paidAt))}</time>
                                                ) : (
                                                    t('일자 확인 중', 'Date unavailable')
                                                )}
                                            </td>
                                            <td className="ward-payment-history__product">{product(record.kind)}</td>
                                            <td className="ward-payment-history__amount">
                                                <strong>{money(record.amount)}</strong>
                                                {record.refunded > 0 ? (
                                                    <span className="ward-payment-history__refund">
                                                        {t('환불', 'Refund')} {money(record.refunded)}
                                                    </span>
                                                ) : null}
                                            </td>
                                            <td className="ward-payment-history__status">
                                                {status === 'refunded'
                                                    ? t('환불 완료', 'Refunded')
                                                    : status === 'partial-refund'
                                                      ? t('일부 환불', 'Partially refunded')
                                                      : t('결제 완료', 'Paid')}
                                            </td>
                                            <td className="ward-payment-history__detail">
                                                {record.orderId ? (
                                                    <Link to={`${paymentReturnPath}?orderId=${encodeURIComponent(record.orderId)}`}>
                                                        {t('상세 보기', 'View details')}
                                                    </Link>
                                                ) : null}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Section>
            ) : null}
        </>
    );
}
