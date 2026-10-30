import {useQuery} from '@tanstack/react-query';
import {useId} from 'react';
import {Link} from 'react-router';
import useAuthStore from '@/features/auth/model/store';
import {commercialError, commercialGet, commercialQueryKey, type Order} from '@/features/commercial/api';
import {InfoTip} from './info-tip';
import {useCopy} from './workspace-ui';
import './workspace-receipts.css';

type TReceiptOrder = Order & {createdAt?: string};
type TStatusTone = 'complete' | 'waiting' | 'issue' | 'neutral';

const statuses: Record<string, {ko: string; en: string; tone: TStatusTone}> = {
    AWAITING_PAYMENT: {ko: '결제 대기', en: 'Awaiting payment', tone: 'waiting'},
    PROCESSING: {ko: '결제 처리 중', en: 'Processing payment', tone: 'waiting'},
    UNKNOWN: {ko: '결제 확인 중', en: 'Checking payment', tone: 'waiting'},
    PAID_PENDING_APPLICATION: {ko: '결제 완료 · 적용 대기', en: 'Paid · awaiting activation', tone: 'waiting'},
    APPLIED: {ko: '결제 완료', en: 'Payment complete', tone: 'complete'},
    PAID: {ko: '결제 완료', en: 'Payment complete', tone: 'complete'},
    FAILED: {ko: '결제 실패', en: 'Payment failed', tone: 'issue'},
    CANCELED: {ko: '결제 취소', en: 'Payment canceled', tone: 'neutral'},
    CANCELLED: {ko: '결제 취소', en: 'Payment canceled', tone: 'neutral'},
    EXPIRED: {ko: '결제 기한 만료', en: 'Payment expired', tone: 'neutral'},
    ABORTED: {ko: '결제 중단', en: 'Payment interrupted', tone: 'neutral'},
    REFUNDED: {ko: '환불 완료', en: 'Refund complete', tone: 'neutral'},
    PARTIALLY_REFUNDED: {ko: '일부 환불', en: 'Partially refunded', tone: 'neutral'},
};

function receiptDate(value: string | undefined, ko: boolean) {
    if (!value) return null;

    // Commercial timestamps are UTC LocalDateTime values; preserve explicit offsets when supplied.
    const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
    const parsed = new Date(normalized);

    if (!Number.isFinite(parsed.getTime())) return null;

    return {
        value: normalized,
        label: new Intl.DateTimeFormat(ko ? 'ko-KR' : 'en-US', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        }).format(parsed),
    };
}

function receiptAmount(order: TReceiptOrder, ko: boolean) {
    if (!Number.isFinite(order.gross) || order.gross < 0 || !/^[A-Z]{3}$/.test(order.currency ?? '')) {
        return ko ? '금액 확인 필요' : 'Amount unavailable';
    }

    try {
        return new Intl.NumberFormat(ko ? 'ko-KR' : 'en-US', {
            style: 'currency',
            currency: order.currency,
            maximumFractionDigits: order.currency === 'KRW' ? 0 : 2,
        }).format(order.gross);
    } catch {
        return ko ? '금액 확인 필요' : 'Amount unavailable';
    }
}

function ReceiptRow({order}: {order: TReceiptOrder}) {
    const t = useCopy();
    const ko = t('ko', 'en') === 'ko';
    const status = Object.prototype.hasOwnProperty.call(statuses, order.status)
        ? statuses[order.status]
        : {ko: '상태 확인 필요', en: 'Status unavailable', tone: 'neutral' as const};
    const paidAt = receiptDate(order.verifiedAt, ko);
    const requestedAt = receiptDate(order.createdAt, ko);
    const when = paidAt ?? requestedAt;
    const amount = receiptAmount(order, ko);

    return (
        <li className="workspace-receipts-row">
            <div className="workspace-receipts-date">
                <span className="workspace-receipts-mobile-label">{paidAt ? t('결제일', 'Paid on') : t('요청일', 'Requested on')}</span>
                {when ? <time dateTime={when.value}>{when.label}</time> : <span>{t('일자 확인 중', 'Date unavailable')}</span>}
            </div>
            <strong className="workspace-receipts-amount">{amount}</strong>
            <span className="workspace-receipts-status" data-tone={status.tone}>
                {ko ? status.ko : status.en}
            </span>
            <Link
                className="workspace-receipts-detail"
                to={`/workspace/payment-return?orderId=${encodeURIComponent(order.id)}`}
                aria-label={t(`${amount} 결제 내역 상세 보기`, `View ${amount} payment details`)}
            >
                {t('상세 보기', 'View details')}
                <span aria-hidden="true">→</span>
            </Link>
        </li>
    );
}

/** Original-payer receipts stay account scoped even when a workspace changes or membership ends. */
export function Receipts() {
    const t = useCopy();
    const heading = useId();
    const accountId = useAuthStore((state) => state.accountId);
    const q = useQuery({
        queryKey: commercialQueryKey(accountId, 'receipts'),
        queryFn: () => commercialGet<TReceiptOrder[]>('/receipts'),
        enabled: accountId !== null,
    });

    return (
        <section className="workspace-receipts" aria-labelledby={heading}>
            <header className="workspace-receipts-heading">
                <div>
                    <h2 id={heading}>{t('결제 목록', 'Payment records')}</h2>
                    <p>{t('이 계정의 결제 진행 상황과 상세 내역을 확인하세요.', 'Review this account’s payments and their progress.')}</p>
                </div>
                <InfoTip label={t('결제 내역 안내', 'About payment history')}>
                    {t(
                        '직접 결제를 요청한 내역만 표시됩니다. 병동에서 나간 뒤에도 원결제자의 내역은 보존됩니다. 환불·이용권 반영 세부 내역은 상세 화면에서 확인하세요.',
                        'Only payments requested by this account appear here. Your original payment records remain available after leaving a ward. Open the details to check refunds and activation.',
                    )}
                </InfoTip>
            </header>
            {q.isPending ? (
                <div className="workspace-receipts-state" role="status">
                    {accountId === null
                        ? t('로그인 정보를 확인하고 있습니다.', 'Checking your account…')
                        : t('결제 내역을 불러오는 중입니다.', 'Loading payments…')}
                </div>
            ) : null}
            {q.isError ? (
                <div className="workspace-receipts-state workspace-receipts-state-error" role="alert">
                    <h3>{t('결제 내역을 불러오지 못했습니다', 'Unable to load payments')}</h3>
                    <p>{commercialError(q.error)}</p>
                    <button className="workspace-receipts-retry" type="button" disabled={q.isFetching} onClick={() => void q.refetch()}>
                        {t('다시 불러오기', 'Try again')}
                    </button>
                </div>
            ) : null}
            {q.isSuccess && q.data.length === 0 ? (
                <div className="workspace-receipts-state">
                    <h3>{t('아직 결제 내역이 없습니다', 'No payments yet')}</h3>
                    <p>
                        {t(
                            '이 계정으로 결제를 요청하면 내역이 여기에 표시됩니다.',
                            'Payments you request with this account will appear here.',
                        )}
                    </p>
                    <Link className="workspace-receipts-empty-link" to="/workspace/plans">
                        {t('요금제 살펴보기', 'Explore plans')}
                        <span aria-hidden="true">→</span>
                    </Link>
                </div>
            ) : null}
            {q.isSuccess && q.data.length > 0 ? (
                <div>
                    <div className="workspace-receipts-columns" aria-hidden="true">
                        <span>{t('결제일 · 요청일', 'Payment / request date')}</span>
                        <span>{t('결제 금액', 'Amount')}</span>
                        <span>{t('상태', 'Status')}</span>
                        <span>{t('상세', 'Details')}</span>
                    </div>
                    <ul className="workspace-receipts-list" aria-label={t('결제 목록', 'Payments')}>
                        {q.data.map((order) => (
                            <ReceiptRow key={order.id} order={order} />
                        ))}
                    </ul>
                </div>
            ) : null}
        </section>
    );
}
