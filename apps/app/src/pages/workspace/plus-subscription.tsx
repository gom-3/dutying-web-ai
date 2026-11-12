import {useQuery} from '@tanstack/react-query';
import {useId, useRef, useState, type ReactNode} from 'react';
import useAuthStore from '@/features/auth/model/store';
import {commercialGet, commercialPost, commercialQueryKey, type Billing, type Entitlement, type Scope} from '@/features/commercial/api';
import {ActionsFeedback, useAction, useCopy} from './workspace-ui';
import './plus-subscription.css';

const money = (amount: number) => new Intl.NumberFormat('ko-KR', {style: 'currency', currency: 'KRW'}).format(amount);
const day = (value?: string) => {
    if (!value) return '—';

    const timestamp = new Date(/[Z+-]\d*:?.*$/.test(value.slice(10)) ? value : `${value}Z`);

    return Number.isNaN(timestamp.getTime())
        ? '—'
        : new Intl.DateTimeFormat('ko-KR', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'}).format(timestamp);
};

export function PlusSubscriptionOverview({
    billing,
    entitlement,
    children,
}: {
    billing: Billing;
    entitlement: Entitlement;
    children: ReactNode;
}) {
    const t = useCopy();
    const capacity = billing.customer?.capacity ?? entitlement.capacity.purchased;
    const policy = entitlement.policy;
    const price = (staff: number) => policy.baseGross + Math.max(0, staff - policy.includedStaff) * policy.extraStaffGross;
    const currentPrice = price(capacity);
    const nextCapacity = billing.scope.nextCapacity ?? capacity;
    const canceling = billing.scope.cancelAtPeriodEnd;

    return (
        <section className="workspace-section plus-subscription">
            <div className="plus-subscription__header">
                <h2>Plus</h2>
                <span className={canceling ? 'plus-subscription__status is-canceling' : 'plus-subscription__status'}>
                    {canceling ? t('해지 예정', 'Cancellation scheduled') : t('이용 중', 'Active')}
                </span>
            </div>
            <div className="plus-subscription__price">
                <strong>{Number.isFinite(currentPrice) ? money(currentPrice) : '—'}</strong>
                <span>{t('/ 월', '/ month')}</span>
            </div>
            <dl className="plus-subscription__facts">
                <div>
                    <dt>{canceling ? t('이용 종료일', 'Access ends') : t('다음 결제일', 'Next payment')}</dt>
                    <dd>{day(billing.scope.periodEnd)}</dd>
                </div>
                <div>
                    <dt>{t('계약 인원', 'Staff capacity')}</dt>
                    <dd>
                        {capacity}
                        {t('명', ' staff')}
                    </dd>
                </div>
                <div>
                    <dt>{t('이용 기간', 'Service period')}</dt>
                    <dd>
                        {day(billing.scope.periodStart).replace(/ /g, '')} ~ {day(billing.scope.periodEnd).replace(/ /g, '')}
                    </dd>
                </div>
                {!canceling && nextCapacity !== capacity ? (
                    <div>
                        <dt>{t('다음 결제 금액', 'Next payment amount')}</dt>
                        <dd>
                            {money(price(nextCapacity))} · {nextCapacity}
                            {t('명', ' staff')}
                        </dd>
                    </div>
                ) : null}
            </dl>
            {children}
        </section>
    );
}

export function PlusSubscriptionCancellation({scope, billing}: {scope: Scope; billing: Billing}) {
    const t = useCopy();
    const action = useAction();
    const [confirming, setConfirming] = useState(false);
    const titleId = useId();
    const cancelButton = useRef<HTMLButtonElement>(null);
    const canceling = billing.scope.cancelAtPeriodEnd;
    const accountId = useAuthStore((state) => state.accountId);
    const paymentMethod = useQuery({
        queryKey: commercialQueryKey(accountId, scope.type, scope.ref, 'payment-method'),
        queryFn: () =>
            commercialGet<{registered: boolean; termsVersion: string; maskedCard?: string}>(
                `/billing-scopes/${scope.scopeId}/payment-method`,
            ),
        enabled: canceling,
    });

    if (!billing.scope.periodEnd) return null;

    const update = (cancel: boolean) =>
        void action.run(async () => {
            const result = await commercialPost(`/billing-scopes/${scope.scopeId}/renewal`, {
                expectedVersion: billing.scope.version,
                cancel,
            });

            setConfirming(false);

            return result;
        });

    return (
        <div className="plus-subscription__footer">
            {canceling && paymentMethod.isSuccess && !paymentMethod.data.registered ? (
                <a className="plus-subscription__text-button" href="#plus-subscription-card">
                    {t('카드 등록 후 구독 유지', 'Register a card to keep your subscription')}
                </a>
            ) : (
                <button
                    ref={cancelButton}
                    type="button"
                    className="plus-subscription__text-button"
                    aria-expanded={canceling ? undefined : confirming}
                    disabled={action.busy || (canceling && (!paymentMethod.isSuccess || !paymentMethod.data.registered))}
                    onClick={() => (canceling ? update(false) : setConfirming(!confirming))}
                >
                    {canceling ? t('해지 예약 취소', 'Undo cancellation') : t('구독 해지', 'Cancel subscription')}
                </button>
            )}
            {confirming && !canceling ? (
                <div className="plus-subscription__confirmation" role="group" aria-labelledby={titleId}>
                    <h3 id={titleId}>{t('구독을 해지할까요?', 'Cancel your subscription?')}</h3>
                    <p>
                        {day(billing.scope.periodEnd)}
                        {t(
                            '까지 이용할 수 있으며, 다음 결제는 진행되지 않습니다.',
                            ' is your last day of access. Your next payment will be canceled.',
                        )}
                    </p>
                    <div className="plus-subscription__confirmation-actions">
                        <button
                            type="button"
                            className="secondary"
                            disabled={action.busy}
                            onClick={() => {
                                setConfirming(false);
                                cancelButton.current?.focus();
                            }}
                        >
                            {t('유지하기', 'Keep subscription')}
                        </button>
                        <button type="button" disabled={action.busy} onClick={() => update(true)}>
                            {t('해지하기', 'Confirm cancellation')}
                        </button>
                    </div>
                </div>
            ) : null}
            <ActionsFeedback action={action} />
        </div>
    );
}
