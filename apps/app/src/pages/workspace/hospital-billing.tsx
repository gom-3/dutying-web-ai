import {useQuery} from '@tanstack/react-query';
import useAuthStore from '@/features/auth/model/store';
import {aiFillUsage} from '@/features/commercial/ai-fill-usage';
import {
    commercialGet,
    commercialPost,
    commercialQueryKey,
    type Billing,
    type Entitlement,
    type Organization,
    type Scope,
} from '@/features/commercial/api';
import {ChannelTalkLink} from '@/shared/ui/channel-talk-link';
import {InfoTip} from './info-tip';
import {ActionsFeedback, ErrorView, useAction, useCopy} from './workspace-ui';
import './hospital-billing.css';

type TContract = {
    capacity?: number;
    setupStaff?: number;
    startsAt?: string;
    endsAt?: string;
    termsRef?: string;
    paymentMode?: string;
};

const validNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const count = (value: unknown) => (validNumber(value) ? value.toLocaleString() : '—');
const money = (value: unknown, currency = 'KRW') =>
    validNumber(value) ? `${value.toLocaleString()}${currency === 'KRW' ? '원' : ` ${currency}`}` : '—';
const iconPaths = {
    contract: 'M5 2h9l5 5v15H5V2zm9 2v4h4l-4-4zM8 11v2h8v-2H8zm0 5v2h6v-2H8z',
    staff: 'M9 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM1 21v-3a8 8 0 0 1 16 0v3H1zM17 3a4 4 0 0 1 0 8 6 6 0 0 0 0-8zM19 13a7 7 0 0 1 4 6v2h-4v-8z',
    generate: 'm12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2zM20 1l.8 2.2L23 4l-2.2.8L20 7l-.8-2.2L17 4l2.2-.8L20 1z',
    adjust: 'M3 5h10V3h3v2h5v3h-5v2h-3V8H3V5zm0 11h5v-2h3v2h10v3H11v2H8v-2H3v-3z',
    receipt: 'M5 2h14v20l-3-2-4 2-4-2-3 2V2zm3 5v2h8V7H8zm0 5v2h8v-2H8z',
    check: 'm9 18-6-6 2-2 4 4L19 4l2 2L9 18z',
    support: 'M4 3h16v14H9l-5 4V3zm4 5v2h8V8H8zm0 5v2h5v-2H8z',
};

function BillingIcon({name}: {name: keyof typeof iconPaths}) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d={iconPaths[name]} />
        </svg>
    );
}

function UsageMeter({value, total, label}: {value?: number; total?: number; label: string}) {
    if (!validNumber(value) || !validNumber(total) || total <= 0) return null;

    return <meter className="hospital-billing-meter" min={0} max={total} value={Math.min(value, total)} aria-label={label} />;
}

function calendarDate(value?: string) {
    if (!value) return '—';

    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) || /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
    const date = new Date(normalized);

    return Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat('ko-KR', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'}).format(date);
}

function readContract(snapshot?: string): TContract | null {
    if (!snapshot) return null;

    try {
        const parsed: unknown = JSON.parse(snapshot);

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

        const source = parsed as Record<string, unknown>;

        return {
            capacity: validNumber(source.capacity) ? source.capacity : undefined,
            setupStaff: validNumber(source.setupStaff) ? source.setupStaff : undefined,
            startsAt: typeof source.startsAt === 'string' ? source.startsAt : undefined,
            endsAt: typeof source.endsAt === 'string' ? source.endsAt : undefined,
            termsRef: typeof source.termsRef === 'string' ? source.termsRef : undefined,
            paymentMode: typeof source.paymentMode === 'string' ? source.paymentMode : undefined,
        };
    } catch {
        return null;
    }
}

export function HospitalBilling({scope, e}: {scope: Scope; e: Entitlement}) {
    const t = useCopy();
    const action = useAction();
    const accountId = useAuthStore((state) => state.accountId);
    const owner = scope.role === 'OWNER';
    const ready = e.configurationReady !== false;
    const canReadBilling = owner && ready && e.canManageBilling;
    const organization = useQuery({
        queryKey: commercialQueryKey(accountId, 'HOSPITAL', scope.ref, 'overview'),
        queryFn: () => commercialGet<Organization>(`/organizations/${scope.ref}`),
        enabled: canReadBilling,
        staleTime: 10_000,
        refetchOnWindowFocus: 'always',
        retry: false,
    });
    const billing = useQuery({
        queryKey: commercialQueryKey(accountId, scope.type, scope.ref, 'billing'),
        queryFn: () => commercialGet<Billing>(`/billing-scopes/${scope.scopeId}`),
        enabled: canReadBilling,
        staleTime: 10_000,
        refetchOnWindowFocus: 'always',
        retry: false,
    });
    const details = organization.data?.organization;
    const contract = readContract(details?.quoteSnapshot);
    const estimate = organization.data?.contractEstimate;
    const setupReady = details?.adoptionStage === 'READY' && !!details.contractAcceptedAt && !details.setupAcceptedAt;
    const completeContract =
        contract &&
        validNumber(contract.capacity) &&
        validNumber(contract.setupStaff) &&
        calendarDate(contract.startsAt) !== '—' &&
        calendarDate(contract.endsAt) !== '—' &&
        !!contract.termsRef?.trim() &&
        ['PREPAID', 'POSTPAID'].includes(contract.paymentMode ?? '') &&
        validNumber(estimate?.monthlyGross) &&
        validNumber(estimate?.setupGross) &&
        !!details?.contractHash;
    const statusLabel = (status: string) =>
        ({
            OPEN: t('납부 대기', 'Awaiting payment'),
            ISSUED: t('납부 대기', 'Awaiting payment'),
            PARTIAL: t('일부 납부', 'Partially paid'),
            PAID: t('납부 완료', 'Paid'),
            OVERDUE: t('납부 기한 지남', 'Overdue'),
            VOID: t('청구 취소', 'Voided'),
            CANCELED: t('취소', 'Canceled'),
            CANCELLED: t('취소', 'Canceled'),
            REFUNDED: t('환불 완료', 'Refunded'),
            PARTIALLY_REFUNDED: t('일부 환불', 'Partially refunded'),
            CREATED: t('결제 대기', 'Pending'),
            READY: t('결제 대기', 'Pending'),
            PROCESSING: t('확인 중', 'Processing'),
            UNKNOWN: t('확인 중', 'Checking'),
            PAID_PENDING_APPLICATION: t('납부 확인 · 적용 중', 'Paid · applying'),
            APPLIED: t('납부 완료', 'Paid'),
            FAILED: t('결제 실패', 'Failed'),
        })[status] ?? t('상태 확인 필요', 'Status unavailable');
    const accept = (kind: 'CONTRACT' | 'SETUP') =>
        void action.run(async () => {
            if (!completeContract || !canReadBilling) return;

            await commercialPost(`/organizations/${scope.ref}/accept/${kind}`, {contractHash: details!.contractHash});
            action.setNotice(
                kind === 'CONTRACT'
                    ? t('계약에 동의했습니다.', 'Contract accepted.')
                    : t('초기 세팅 확인을 완료했습니다.', 'Setup accepted.'),
            );
        });

    return (
        <div className="hospital-billing">
            {!ready ? (
                <p className="hospital-billing-message" role="status">
                    {t(
                        '이용 조건을 설정 중입니다. 설정이 완료되면 계약과 청구 내역을 확인할 수 있습니다.',
                        'Service terms are being configured. Contract and invoice details will be available when ready.',
                    )}
                </p>
            ) : null}
            {canReadBilling ? (
                <section className="hospital-billing-contract" aria-labelledby="hospital-billing-contract-title">
                    <div className="hospital-billing-heading">
                        <h2 id="hospital-billing-contract-title">{t('계약 정보', 'Contract')}</h2>
                        <InfoTip label={t('계약·납부 안내', 'About contract and payment')}>
                            {t(
                                '병원은 개별 계약에 따라 계좌이체로 납부합니다. 계약 변경이나 입금 확인은 문의해 주세요. 아래 금액은 부가세 포함입니다.',
                                'Hospitals pay by bank transfer under their individual contract. Contact us for changes or payment confirmation. Amounts include VAT.',
                            )}
                        </InfoTip>
                        {contract && !organization.isError ? (
                            <span className="hospital-billing-contract-status" data-complete={!!details?.contractAcceptedAt}>
                                {details?.contractAcceptedAt
                                    ? t('동의 완료', 'Accepted')
                                    : completeContract
                                      ? t('동의 대기', 'Awaiting acceptance')
                                      : t('확인 필요', 'Needs review')}
                            </span>
                        ) : null}
                    </div>
                    {organization.isPending ? (
                        <p role="status" className="hospital-billing-empty">
                            {t('계약을 불러오는 중입니다.', 'Loading contract…')}
                        </p>
                    ) : organization.isError ? (
                        <div className="hospital-billing-load-error">
                            <ErrorView error={organization.error} />
                            <button
                                type="button"
                                className="secondary"
                                disabled={organization.isFetching}
                                onClick={() => void organization.refetch()}
                            >
                                {t('다시 불러오기', 'Retry')}
                            </button>
                        </div>
                    ) : contract ? (
                        <div className="hospital-billing-contract-layout">
                            <div className="hospital-billing-contract-summary">
                                <div className="hospital-billing-plan">
                                    <span className="hospital-billing-plan-icon">
                                        <BillingIcon name="contract" />
                                    </span>
                                    <div>
                                        <strong>Hospital</strong>
                                        <span>{t('병원 단위 이용 계약', 'Hospital service agreement')}</span>
                                    </div>
                                </div>
                                <dl className="hospital-billing-prices">
                                    <div>
                                        <dt>{t('월 이용료', 'Monthly fee')}</dt>
                                        <dd>{money(estimate?.monthlyGross)}</dd>
                                    </div>
                                    <div>
                                        <dt>{t('초기 도입비 · 1회', 'One-time setup')}</dt>
                                        <dd>{money(estimate?.setupGross)}</dd>
                                    </div>
                                </dl>
                                <p className="hospital-billing-tax-note">{t('부가세 포함', 'VAT included')}</p>
                                <dl className="hospital-billing-facts">
                                    <div className="hospital-billing-period">
                                        <dt>{t('계약 기간', 'Contract period')}</dt>
                                        <dd>
                                            {calendarDate(contract.startsAt)} ~ {calendarDate(contract.endsAt)} (KST)
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>{t('계약 인원', 'Contracted capacity')}</dt>
                                        <dd>
                                            {count(contract.capacity)}
                                            {t('명', ' staff')}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>{t('초기 세팅 인원', 'Setup staff')}</dt>
                                        <dd>
                                            {count(contract.setupStaff)}
                                            {t('명', ' staff')}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>{t('납부 방식', 'Payment method')}</dt>
                                        <dd>
                                            {contract.paymentMode === 'PREPAID'
                                                ? t('계좌이체 · 선불', 'Bank transfer · prepaid')
                                                : contract.paymentMode === 'POSTPAID'
                                                  ? t('계좌이체 · 후불', 'Bank transfer · postpaid')
                                                  : t('확인 필요', 'To be confirmed')}
                                        </dd>
                                    </div>
                                    <div className="hospital-billing-document">
                                        <dt>{t('계약 문서', 'Contract reference')}</dt>
                                        <dd>{contract.termsRef?.trim() ? contract.termsRef : '—'}</dd>
                                    </div>
                                </dl>
                                {!completeContract ? (
                                    <p className="hospital-billing-message">
                                        {t(
                                            '계약 정보를 확인 중입니다. 누락된 내용은 담당자에게 문의해 주세요.',
                                            'Contract details need review. Contact your representative about missing information.',
                                        )}
                                    </p>
                                ) : null}
                            </div>
                            <div className="hospital-billing-next-step">
                                <p className="hospital-billing-eyebrow">{t('계약 진행', 'Agreement progress')}</p>
                                <h3>
                                    {setupReady
                                        ? t('초기 세팅을 확인해 주세요', 'Review your initial setup')
                                        : details?.contractAcceptedAt
                                          ? t('계약 동의를 완료했어요', 'Your agreement is accepted')
                                          : t('계약 내용을 확인해 주세요', 'Review your agreement')}
                                </h3>
                                <ol className="hospital-billing-steps" aria-label={t('계약 확인 절차', 'Agreement checklist')}>
                                    <li
                                        data-complete={!!details?.contractAcceptedAt}
                                        aria-current={!details?.contractAcceptedAt ? 'step' : undefined}
                                    >
                                        <span className="hospital-billing-step-number" aria-hidden="true">
                                            {details?.contractAcceptedAt ? <BillingIcon name="check" /> : '1'}
                                        </span>
                                        <span>{t('계약 조건 확인·동의', 'Review and accept terms')}</span>
                                    </li>
                                    <li data-complete={!!details?.setupAcceptedAt} aria-current={setupReady ? 'step' : undefined}>
                                        <span className="hospital-billing-step-number" aria-hidden="true">
                                            {details?.setupAcceptedAt ? <BillingIcon name="check" /> : '2'}
                                        </span>
                                        <span>{t('초기 세팅 확인', 'Review initial setup')}</span>
                                    </li>
                                </ol>
                                <p className="hospital-billing-next-description">
                                    {setupReady
                                        ? t('병원에 적용된 세팅을 확인한 뒤 완료해 주세요.', 'Check the hospital setup before confirming.')
                                        : details?.contractAcceptedAt
                                          ? t(
                                                '담당자가 계약 조건에 따라 도입을 진행해요.',
                                                'Your representative will proceed under the agreed terms.',
                                            )
                                          : t(
                                                '금액과 이용 조건을 확인한 뒤 동의해 주세요.',
                                                'Check the fees and service terms before accepting.',
                                            )}
                                </p>
                                <div className="hospital-billing-acceptance">
                                    {details?.contractAcceptedAt ? (
                                        <p>
                                            <BillingIcon name="check" />
                                            {t('계약 동의 완료', 'Contract accepted')} · {calendarDate(details.contractAcceptedAt)}
                                        </p>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={action.busy || !completeContract}
                                            onClick={() => accept('CONTRACT')}
                                        >
                                            {t('계약 조건에 동의', 'Accept contract terms')}
                                        </button>
                                    )}
                                    {setupReady ? (
                                        <button type="button" disabled={action.busy || !completeContract} onClick={() => accept('SETUP')}>
                                            {t('초기 세팅 확인 완료', 'Confirm initial setup')}
                                        </button>
                                    ) : null}
                                    {details?.setupAcceptedAt ? (
                                        <p>
                                            <BillingIcon name="check" />
                                            {t('초기 세팅 확인 완료', 'Setup accepted')} · {calendarDate(details.setupAcceptedAt)}
                                        </p>
                                    ) : null}
                                </div>
                                <ActionsFeedback action={action} />
                            </div>
                        </div>
                    ) : (
                        <div className="hospital-billing-empty-state">
                            <span className="hospital-billing-empty-icon">
                                <BillingIcon name="contract" />
                            </span>
                            <div>
                                <p>
                                    {details?.quoteSnapshot
                                        ? t(
                                              '계약 정보를 읽을 수 없습니다. 담당자에게 문의해 주세요.',
                                              'Contract details could not be read. Contact your representative.',
                                          )
                                        : t('아직 등록된 계약이 없습니다.', 'No contract registered yet.')}
                                </p>
                                <span>
                                    {t(
                                        '담당자가 견적을 등록하면 이곳에서 조건을 확인하고 동의할 수 있어요.',
                                        'Once your representative registers a quote, you can review and accept it here.',
                                    )}
                                </span>
                            </div>
                        </div>
                    )}
                </section>
            ) : null}

            <section className="hospital-billing-usage-section" aria-labelledby="hospital-billing-usage-title">
                <div className="hospital-billing-section-heading">
                    <div className="hospital-billing-heading">
                        <h2 id="hospital-billing-usage-title">{t('이용 현황', 'Usage')}</h2>
                        <InfoTip label={t('이용 현황 안내', 'About usage')}>
                            {t(
                                '병원에 소속된 병동의 편성 인원과 AI 사용량을 합산합니다. 처리 중인 AI 요청은 완료될 때까지 횟수가 예약됩니다.',
                                'Scheduling staff and AI usage are shared across hospital wards. In-progress AI requests reserve uses until completion.',
                            )}
                        </InfoTip>
                    </div>
                    {ready && (e.scope?.periodStart || e.scope?.periodEnd) ? (
                        <p className="hospital-billing-caption">
                            {calendarDate(e.scope.periodStart)} ~ {calendarDate(e.scope.periodEnd)} (KST)
                        </p>
                    ) : null}
                </div>
                <dl className="hospital-billing-usage">
                    <div>
                        <dt>
                            <span className="hospital-billing-metric-icon">
                                <BillingIcon name="staff" />
                            </span>
                            {t('편성 인원', 'Scheduling staff')}
                        </dt>
                        <dd>
                            {count(e.capacity?.used)}
                            <span>
                                {' '}
                                / {ready ? count(e.capacity?.purchased) : '—'}
                                {t('명', ' staff')}
                            </span>
                        </dd>
                        <dd className="hospital-billing-usage-meta">
                            {ready
                                ? t('현재 인원 / 계약 인원', 'Active / contracted')
                                : t('계약 인원 설정 중', 'Capacity being configured')}
                        </dd>
                        <dd className="hospital-billing-usage-visual" data-warning={e.capacity?.overLimit}>
                            <UsageMeter
                                value={e.capacity?.used}
                                total={ready ? e.capacity?.purchased : undefined}
                                label={t('편성 인원 사용 비율', 'Scheduling capacity used')}
                            />
                        </dd>
                    </div>
                    {[aiFillUsage(e)].map((item) => {
                        const meter = 'AI_FILL';
                        const usage = ready ? item : undefined;
                        const disabled = usage?.enforced === false;
                        const label = t('AI 채우기', 'AI fill');
                        const total =
                            usage && validNumber(usage.remaining) && validNumber(usage.used) && validNumber(usage.reserved)
                                ? usage.remaining + usage.used + usage.reserved
                                : undefined;

                        return (
                            <div key={meter}>
                                <dt>
                                    <span className="hospital-billing-metric-icon">
                                        <BillingIcon name="generate" />
                                    </span>
                                    {label}
                                </dt>
                                <dd>
                                    {disabled ? (
                                        t('제한 해제', 'Limit disabled')
                                    ) : usage ? (
                                        <>
                                            {count(usage.remaining)}
                                            <span>{t('회 남음', ' remaining')}</span>
                                        </>
                                    ) : (
                                        '—'
                                    )}
                                </dd>
                                <dd className="hospital-billing-usage-meta">
                                    {usage ? (
                                        <>
                                            {t('사용', 'Used')} {count(usage.used)} · {t('처리 중', 'In progress')} {count(usage.reserved)}
                                        </>
                                    ) : (
                                        t('제공량 확인 대기', 'Allowance pending')
                                    )}
                                </dd>
                                <dd className="hospital-billing-usage-visual">
                                    {!disabled && usage ? (
                                        <UsageMeter
                                            value={usage.used + usage.reserved}
                                            total={total}
                                            label={`${label} ${t('사용·처리 중', 'used and in progress')}`}
                                        />
                                    ) : null}
                                </dd>
                            </div>
                        );
                    })}
                </dl>
                {e.capacity?.overLimit ? (
                    <p className="hospital-billing-message">
                        {t(
                            '계약 인원을 초과했습니다. 인원 변경은 문의해 주세요.',
                            'Contracted capacity exceeded. Contact us to update it.',
                        )}
                    </p>
                ) : null}
            </section>

            {canReadBilling ? (
                <section aria-labelledby="hospital-billing-invoices-title">
                    <div className="hospital-billing-heading">
                        <h2 id="hospital-billing-invoices-title">{t('청구·납부 내역', 'Invoices and payments')}</h2>
                    </div>
                    {billing.isPending ? (
                        <p role="status" className="hospital-billing-empty">
                            {t('청구 내역을 불러오는 중입니다.', 'Loading invoices…')}
                        </p>
                    ) : billing.isError ? (
                        <div className="hospital-billing-load-error">
                            <ErrorView error={billing.error} />
                            <button
                                type="button"
                                className="secondary"
                                disabled={billing.isFetching}
                                onClick={() => void billing.refetch()}
                            >
                                {t('다시 불러오기', 'Retry')}
                            </button>
                        </div>
                    ) : (
                        <>
                            {billing.data?.invoices?.length ? (
                                <table className="hospital-billing-records">
                                    <caption>{t('병원 청구 및 납부 내역', 'Hospital invoices and payments')}</caption>
                                    <thead>
                                        <tr>
                                            <th>{t('이용 기간', 'Service period')}</th>
                                            <th>{t('청구 금액', 'Invoiced')}</th>
                                            <th>{t('납부 금액', 'Paid')}</th>
                                            <th>{t('상태', 'Status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {billing.data.invoices.map((invoice) => (
                                            <tr key={invoice.id}>
                                                <td data-label={t('이용 기간', 'Service period')}>
                                                    {calendarDate(invoice.periodStart)} ~ {calendarDate(invoice.periodEnd)}
                                                    <span className="hospital-billing-record-meta">
                                                        {t('납부 기한', 'Due')} {calendarDate(invoice.dueAt)}
                                                    </span>
                                                </td>
                                                <td data-label={t('청구 금액', 'Invoiced')}>{money(invoice.gross)}</td>
                                                <td data-label={t('납부 금액', 'Paid')}>
                                                    {money(invoice.allocated)}
                                                    {validNumber(invoice.refundedGross) && invoice.refundedGross > 0 ? (
                                                        <span className="hospital-billing-record-meta">
                                                            {t('환불', 'Refunded')} {money(invoice.refundedGross)}
                                                        </span>
                                                    ) : null}
                                                </td>
                                                <td data-label={t('상태', 'Status')}>
                                                    <span className="hospital-billing-invoice-status" data-status={invoice.status}>
                                                        {statusLabel(invoice.status)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="hospital-billing-empty-state">
                                    <span className="hospital-billing-empty-icon">
                                        <BillingIcon name="receipt" />
                                    </span>
                                    <div>
                                        <p>{t('아직 청구 내역이 없습니다.', 'No invoices yet.')}</p>
                                        <span>
                                            {t(
                                                '청구서가 등록되면 이용 기간과 납부 상태를 확인할 수 있어요.',
                                                'Service periods and payment status will appear when invoices are issued.',
                                            )}
                                        </span>
                                    </div>
                                </div>
                            )}
                            {billing.data?.orders?.length ? (
                                <details className="hospital-billing-payment-records">
                                    <summary>
                                        {t('결제 기록', 'Payment records')} <span>{billing.data.orders.length}</span>
                                    </summary>
                                    <ul>
                                        {billing.data.orders.map((order) => (
                                            <li key={order.id}>
                                                <span>
                                                    {calendarDate(order.appliedAt ?? order.verifiedAt)}
                                                    <small>{statusLabel(order.status)}</small>
                                                </span>
                                                <strong>{money(order.gross, order.currency)}</strong>
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            ) : null}
                        </>
                    )}
                </section>
            ) : owner && ready ? (
                <p className="hospital-billing-caption">
                    {t(
                        '계약 설정이 완료되면 청구 내역을 확인할 수 있습니다.',
                        'Invoices will be available when contract setup is complete.',
                    )}
                </p>
            ) : null}

            <div className="hospital-billing-contact">
                <span className="hospital-billing-contact-icon">
                    <BillingIcon name="support" />
                </span>
                <span>
                    {owner
                        ? t('계약 변경이나 납부 확인이 필요하세요?', 'Need a contract change or payment confirmation?')
                        : t('계약·요금은 최고 관리자가 확인할 수 있습니다.', 'The owner can view contract and billing details.')}
                </span>
                <ChannelTalkLink className="hospital-billing-contact-link">{t('문의하기', 'Contact us')}</ChannelTalkLink>
            </div>
        </div>
    );
}
