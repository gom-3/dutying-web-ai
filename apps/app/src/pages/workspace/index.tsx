import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Link, Navigate, useLocation, useNavigate} from 'react-router';
import useAuth from '@/features/auth';
import useAuthStore from '@/features/auth/model/store';
import {
    isAdminSeatLimitReached,
    commercialGet,
    commercialDelete,
    type Policy,
    commercialPost,
    legacyGet,
    legacyPost,
    legacyDelete,
    commercialQueryKey,
    scopePath,
    useCommercialContext,
    type Scope,
    type Entitlement,
    type Organization,
    type Members,
    type Billing,
    type Quote,
    type QuoteTerms,
    type QuoteRequest,
    type Estimate,
    type Order,
} from '@/features/commercial/api';
import './workspace.css';
import type {CommercialBatchResult} from '@/features/commercial/batch-result';
import {clearBillingReturnPayload, readBillingReturnPayload} from '@/features/commercial/billing-return-payload';
import {HospitalChooser, useWorkspaceNavigation, workspaceRoleLabel} from '@/features/commercial/hospital-entry';
import {parseQuoteTerms, parseSubscriptionSummary, quoteTimestamp} from '@/features/commercial/quote-terms';
import {loadToss, openTossBilling} from '@/features/commercial/toss-sdk';
import {getOwnedWardLinkScope} from '@/features/commercial/ward-links';
import {RefundConditions, SubscriptionConditions, fetchPublicOffer} from '@/pages/subscription-info';
import {WardAPI} from '@/shared/api';
import logoWordmarkPurple from '@/shared/assets/images/logo-wordmark-purple.png';
import {sellerReady, SUBSCRIPTION_TERMS_VERSION} from '@/shared/business/profile';
import ROUTE from '@/shared/constant/path';
import {HospitalBilling} from './hospital-billing';
import {HospitalMembersPanel} from './hospital-members';
import {HospitalOverview} from './hospital-overview';
import {HospitalWorkspaceShell} from './hospital-workspace-shell';
import {InfoTip} from './info-tip';
import {Reauthenticate} from './reauthentication';
import {WardLinksPanel} from './ward-links-panel';
import {WorkspaceActivity, countWorkspaceRequests} from './workspace-activity';
import {WorkspaceHome} from './workspace-home';
import {WorkspacePersonalShell, type TPersonalWorkspacePage} from './workspace-personal-shell';
import {Plans} from './workspace-plans';
import {Receipts} from './workspace-receipts';
import {Section, Field, Notice, ErrorView, useAction, ActionsFeedback, useCopy} from './workspace-ui';
import './hospital-workspace.css';
import './hospital-secondary.css';

const money = (n: number) => new Intl.NumberFormat('ko-KR', {style: 'currency', currency: 'KRW', maximumFractionDigits: 0}).format(n);
const date = (s?: string | null) =>
    s ? new Date(/[Z+-]\d*:?.*$/.test(s.slice(10)) ? s : `${s}Z`).toLocaleString(undefined, {timeZone: 'Asia/Seoul', hour12: false}) : '—';
const hospitalDate = (s?: string | null, withTime = false) =>
    s
        ? new Intl.DateTimeFormat('ko-KR', {
              timeZone: 'Asia/Seoul',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              ...(withTime ? {hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const} : {}),
          }).format(new Date(/[Z+-]\d*:?.*$/.test(s.slice(10)) ? s : `${s}Z`))
        : '—';
const memberId = (m: Members['members'][number]) => m.id ?? m.membershipId ?? m.wardAdminMembershipId;
const accountIdOf = (m: Members['members'][number]) => m.accountId ?? m.adminAccountId ?? m.wardAdminAccountId;
const paymentStatusLabel = (status: string, t: ReturnType<typeof useCopy>) =>
    ({
        AWAITING_PAYMENT: t('결제 전', 'Awaiting payment'),
        PROCESSING: t('결제 처리 중', 'Processing payment'),
        UNKNOWN: t('결제 결과 확인 중', 'Checking payment result'),
        PAID_PENDING_APPLICATION: t('결제 완료 · 이용권 적용 중', 'Paid · activating subscription'),
        APPLIED: t('결제·이용권 적용 완료', 'Payment and activation complete'),
        FAILED: t('결제 미완료', 'Payment incomplete'),
    })[status] ?? t('상태 확인 필요', 'Review required');

function RequestForm({
    scope,
    invoices = [],
    kind = 'CAPACITY',
}: {
    scope: Scope;
    invoices?: Billing['invoices'];
    kind?: 'CAPACITY' | 'REFUND' | 'CLOSURE' | 'SUPPORT' | 'PAYMENT_METHOD';
}) {
    const t = useCopy();
    const action = useAction();
    const [description, setDescription] = useState('');
    const [invoiceId, setInvoiceId] = useState('');
    const [capacity, setCapacity] = useState(50);

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();

                const data = {kind, description, capacity, invoiceId: invoiceId || null};

                void action.run(async () => {
                    const r = await commercialPost(`/billing-scopes/${scope.scopeId}/requests`, data, action.keyFor('request', data));

                    action.setNotice(
                        t(
                            '요청을 접수했습니다. 처리 결과는 요금 관리에서 확인할 수 있습니다.',
                            'Your request was submitted. Check billing for updates.',
                        ),
                    );
                    setDescription('');

                    return r;
                });
            }}
        >
            {kind === 'REFUND' ? (
                <Field label={t('환불을 요청할 청구서', 'Invoice to review')}>
                    <select required value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
                        <option value="">{t('선택하세요', 'Select')}</option>
                        {invoices
                            .filter((i) => i.allocated > 0)
                            .map((i) => (
                                <option key={i.id} value={i.id}>
                                    {date(i.periodStart)} · {money(i.gross)} · {i.id.slice(0, 8)}
                                </option>
                            ))}
                    </select>
                </Field>
            ) : null}
            <Field label={t('요청 내용', 'Request details')}>
                <textarea required maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            {kind === 'CAPACITY' ? (
                <Field label={t('필요한 총 편성 인원', 'Total staff capacity needed')}>
                    <input
                        required
                        type="number"
                        min={1}
                        max={10000}
                        value={capacity}
                        onChange={(e) => setCapacity(Number(e.target.value))}
                    />
                </Field>
            ) : null}
            <button disabled={action.busy} type="submit">
                {t('요청 보내기', 'Submit request')}
            </button>
            <ActionsFeedback action={action} />
        </form>
    );
}

function HospitalDisclosure({active, title, help, children}: {active: boolean; title: string; help?: ReactNode; children: ReactNode}) {
    if (!active) return <>{children}</>;

    return (
        <details className="hospital-secondary-disclosure">
            <summary>
                <span className="hospital-secondary-label">
                    {title}
                    {help ? <InfoTip label={`${title} 도움말`}>{help}</InfoTip> : null}
                </span>
                <span className="hospital-secondary-disclosure-indicator" aria-hidden="true">
                    +
                </span>
            </summary>
            <div className="hospital-secondary-content">{children}</div>
        </details>
    );
}

function UsagePanel({scope, e}: {scope: Scope; e: Entitlement}) {
    const t = useCopy();
    const action = useAction();
    const accountId = useAuthStore((s) => s.accountId);
    const campaigns = useQuery({
        queryKey: commercialQueryKey(accountId, 'campaigns'),
        queryFn: () =>
            commercialGet<
                {id: string; name: string; days: number; capacity: number; generate: number; adjust: number; windowDays: number}[]
            >('/campaigns'),
        enabled: e.plan === 'FREE' && e.canManageBilling,
    });

    return (
        <>
            <Section
                title={
                    scope.type === 'HOSPITAL'
                        ? t('현재 이용 현황', 'Current usage')
                        : `${e.plan}${e.entitlementSource === 'EVENT' ? t(' · 무료 이벤트', ' · Trial') : ''}`
                }
                help={
                    scope.type === 'HOSPITAL'
                        ? t(
                              '편성 인원과 관리자 정원은 별도로 집계합니다. 부분 조정은 전체 생성과 별도로 사용하며, 결과가 없거나 확정된 실패에는 횟수를 차감하지 않습니다.',
                              'Staff capacity and administrator seats are counted separately. Partial adjustment has its own allowance. No result or a confirmed failure does not consume a use.',
                          )
                        : undefined
                }
                actions={
                    scope.type === 'HOSPITAL' ? (
                        <span className="hospital-current-plan">{t('병원 요금제', 'Hospital plan')}</span>
                    ) : undefined
                }
            >
                <div className="workspace-stats">
                    <div>
                        <strong>
                            {e.capacity.used} / {e.capacity.purchased}
                        </strong>
                        <span>{t('활성 편성 인원', 'Active scheduling staff')}</span>
                    </div>
                    <div>
                        <strong>
                            {e.adminSeats.active} + {e.adminSeats.reserved} /{' '}
                            {e.restrictionStates?.ADMIN_SEATS === false ? t('제한 해제', 'No plan limit') : e.adminSeats.limit}
                        </strong>
                        <span>{t('활성 관리자 + 대기 초대', 'Active admins + pending invitations')}</span>
                    </div>
                </div>
                {e.capacity.overLimit ? (
                    <Notice>
                        {t(
                            '기존 근무표의 편집·확정·내보내기는 계속 사용할 수 있습니다. 새 월과 AI를 사용하려면 활성 편성 인원을 줄이거나 계약 인원을 늘려 주세요.',
                            'Existing schedules remain editable, confirmable and exportable. Reduce active staff or increase capacity to start a new month or use AI.',
                        )}
                    </Notice>
                ) : null}
                <div className="workspace-grid">
                    {e.usage.map((u) => (
                        <article className="workspace-usage" key={u.meter}>
                            <div className="workspace-heading-label">
                                <h3>
                                    {u.meter === 'FULL_GENERATE' ? t('전체 생성', 'Full generation') : t('부분 조정', 'Partial adjustment')}
                                </h3>
                                {scope.type === 'HOSPITAL' && u.lots.length ? (
                                    <InfoTip
                                        label={`${u.meter === 'FULL_GENERATE' ? t('전체 생성', 'Full generation') : t('부분 조정', 'Partial adjustment')} ${t('제공량 내역', 'allowance details')}`}
                                    >
                                        {u.lots.map((l) => (
                                            <div key={l.id}>
                                                {l.source === 'PURCHASE' ? t('추가 구매', 'Purchased') : t('기본 제공', 'Included')}{' '}
                                                {l.available}
                                                {t('회', ' uses')} · {l.expiresAt ? date(l.expiresAt) : t('만료 없음', 'No expiration')}
                                            </div>
                                        ))}
                                    </InfoTip>
                                ) : null}
                            </div>
                            <strong>
                                {u.enforced === false
                                    ? t('요금제 횟수 제한 해제', 'Plan usage limit disabled')
                                    : `${u.remaining}${t('회 남음', ' remaining')}`}
                            </strong>
                            <p>
                                {t('사용', 'Used')} {u.used} · {t('처리 중 예약', 'Reserved')} {u.reserved}
                            </p>
                            {u.enforced !== false ? (
                                <meter min={0} max={Math.max(u.granted, 1)} value={u.remaining} aria-label={u.meter} />
                            ) : null}
                            {scope.type === 'WARD' ? (
                                <ul>
                                    {u.lots.map((l) => (
                                        <li key={l.id}>
                                            {l.source === 'PURCHASE' ? t('추가 구매', 'Purchased') : t('기본 제공', 'Included')}{' '}
                                            {l.available}
                                            {t('회', ' uses')} ·{' '}
                                            {l.expiresAt ? date(l.expiresAt) : t('최초 제공·만료 없음', 'Lifetime allocation')}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </article>
                    ))}
                </div>
                {scope.type === 'WARD' ? (
                    <p>
                        {t(
                            '부분 조정은 전체 생성과 별도로 사용합니다. 결과가 없거나 확정된 실패에는 횟수를 차감하지 않습니다.',
                            'Partial adjustment has its own allowance. No result or a confirmed failure does not consume a use.',
                        )}
                    </p>
                ) : null}
                {e.promotion ? (
                    <Notice>
                        {t('이벤트 종료', 'Trial ends')}: {date(e.promotion.endsAt)} (KST).{' '}
                        {t(
                            '카드 등록 없이 종료 후 Free로 전환합니다. 자동 결제하지 않습니다.',
                            'Returns to Free without automatic payment.',
                        )}
                    </Notice>
                ) : null}
                <Link
                    className="workspace-button"
                    to={scopePath(scope, scope.type === 'HOSPITAL' && !e.canManageBilling ? 'support' : 'billing')}
                >
                    {e.canManageBilling
                        ? t('요금제·추가 횟수 보기', 'Plans & additional uses')
                        : scope.type === 'HOSPITAL'
                          ? t('운영 지원 요청하기', 'Request support')
                          : t('증설 요청하기', 'Request more capacity')}
                </Link>
            </Section>
            {campaigns.data?.map((c) => (
                <Section key={c.id} title={c.name}>
                    <p>
                        {c.days}
                        {t('일 동안', ' days')} · {c.capacity}
                        {t('명', ' staff')} · {c.windowDays}
                        {t('일마다 전체', ' days: full')} {c.generate} / {t('부분', 'partial')} {c.adjust}
                    </p>
                    <Notice>
                        {t(
                            '한 번만 참여할 수 있으며, 기본 Free 제공량은 그대로 보존됩니다. 카드를 등록하지 않습니다.',
                            'One enrollment per eligible account and ward. Free allowances are preserved. No card required.',
                        )}
                    </Notice>
                    <button
                        disabled={action.busy}
                        onClick={() =>
                            void action.run(() =>
                                commercialPost(`/billing-scopes/${scope.scopeId}/promotion`, {campaignId: c.id, consent: true}),
                            )
                        }
                    >
                        {t('이 조건에 동의하고 무료 시작', 'Agree & start trial')}
                    </button>
                </Section>
            ))}
            <ActionsFeedback action={action} />
        </>
    );
}

function HospitalCalculator({e}: {scope: Scope; e: Entitlement}) {
    const t = useCopy();
    const action = useAction();
    const [capacity, setCapacity] = useState(Math.max(50, e.capacity.purchased));
    const [setup, setSetup] = useState(50);
    const [result, setResult] = useState<Estimate>();

    return (
        <Section
            title={t('예상 견적 계산', 'Estimate calculator')}
            help={t(
                '월 계약 인원과 처음 세팅할 인원을 입력하세요. 부가세 포함 예상액이며, 최종 금액은 도입 범위와 계약 조건을 확인한 뒤 확정합니다.',
                'Enter monthly capacity and initial setup staff. Indicative KRW prices include VAT. Final pricing follows scope and contract review.',
            )}
        >
            <div className="workspace-presets">
                {[50, 100, 300, 500, 1000].map((n) => (
                    <button className="secondary" key={n} onClick={() => setCapacity(n)}>
                        {n}
                        {t('명', ' staff')}
                    </button>
                ))}
            </div>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    void action.run(async () => {
                        const r = await commercialPost<Estimate>('/estimates', {
                            purpose: 'SUBSCRIPTION',
                            plan: 'HOSPITAL',
                            capacity,
                            setupStaff: setup,
                            fullPacks: 0,
                            partialPacks: 0,
                        });

                        setResult(r);

                        return r;
                    });
                }}
                className="workspace-form-grid"
            >
                <Field label={t('월 계약 인원', 'Monthly capacity')}>
                    <input
                        type="number"
                        required
                        min={50}
                        max={10000}
                        value={capacity}
                        onChange={(event) => setCapacity(Number(event.target.value))}
                    />
                </Field>
                <Field label={t('초기 세팅 인원', 'Initial setup staff')}>
                    <input
                        type="number"
                        required
                        min={0}
                        max={10000}
                        value={setup}
                        onChange={(event) => setSetup(Number(event.target.value))}
                    />
                </Field>
                <button disabled={action.busy}>{t('견적 계산', 'Calculate')}</button>
            </form>
            {result ? (
                <div className="workspace-stats">
                    <div>
                        <strong>{money(result.estimate.monthlyGross)}</strong>
                        <span>{t('매월 구독료', 'Monthly subscription')}</span>
                    </div>
                    <div>
                        <strong>{money(result.estimate.setupGross)}</strong>
                        <span>{t('초기 도입비 · 1회', 'One-time setup')}</span>
                    </div>
                    <div>
                        <strong>
                            {result.estimate.generate} / {result.estimate.adjust}
                        </strong>
                        <span>{t('매월 전체 생성 / 부분 조정', 'Monthly full / partial uses')}</span>
                    </div>
                    <div>
                        <strong>
                            {result.estimate.supportSeconds / 60}
                            {t('분', ' min')}
                        </strong>
                        <span>{t('월 기본 운영 지원', 'Monthly included support')}</span>
                    </div>
                </div>
            ) : null}
            {result ? <p className="hospital-secondary-caption">{t('부가세 포함 예상액', 'Indicative price, VAT included')}</p> : null}
            <ActionsFeedback action={action} />
        </Section>
    );
}

function BillingPanel({scope, e}: {scope: Scope; e: Entitlement}) {
    const t = useCopy();
    const action = useAction();
    const accountId = useAuthStore((s) => s.accountId);
    const data = useQuery({
        queryKey: commercialQueryKey(accountId, scope.type, scope.ref, 'billing'),
        queryFn: () => commercialGet<Billing>(`/billing-scopes/${scope.scopeId}`),
        enabled: e.canManageBilling,
    });
    const plans = useQuery({
        queryKey: commercialQueryKey(accountId, 'plans'),
        queryFn: () => commercialGet<{id: string; config: Policy | null; configured?: boolean}[]>('/plans'),
        staleTime: 0,
        refetchOnWindowFocus: 'always',
    });
    const publicOffer = useQuery({queryKey: ['public-plus-offer'], queryFn: fetchPublicOffer, retry: false});
    const targetPlan = scope.type === 'HOSPITAL' ? 'HOSPITAL' : 'PLUS';
    const planPolicy =
        e.plan === targetPlan && (e.entitlementSource === 'SUBSCRIPTION' || scope.type === 'HOSPITAL')
            ? e.policy
            : plans.data?.find((p) => p.config?.plan === targetPlan && p.configured !== false)?.config;
    // The full catalogue may be unavailable while the independently published Plus offer is valid.
    // Existing paid contracts continue to use their own policy, including their original prices.
    const publishedPlusOffer = publicOffer.data && 'plan' in publicOffer.data ? publicOffer.data : undefined;
    const planPricing =
        planPolicy ?? (scope.type === 'WARD' && ['FREE', 'EVENT'].includes(e.entitlementSource) ? publishedPlusOffer : undefined);
    const [purpose, setPurpose] = useState<QuoteRequest['purpose']>(e.entitlementSource === 'SUBSCRIPTION' ? 'USAGE_PACK' : 'SUBSCRIPTION');
    const [capacity, setCapacity] = useState<number>();
    const minimumCapacity = Math.max(1, planPricing?.includedStaff ?? 1, e.capacity.used);
    const draftCapacity = capacity ?? Math.max(minimumCapacity, e.capacity.purchased);
    const quoteCapacity = Math.max(minimumCapacity, draftCapacity);
    const subscriptionUnavailable = purpose === 'SUBSCRIPTION' && !planPricing;
    const [full, setFull] = useState(0);
    const [partial, setPartial] = useState(0);
    const [setup, setSetup] = useState(50);
    const [quote, setQuote] = useState<Quote>();
    const [consent, setConsent] = useState(false);
    const [trialLoss, setTrialLoss] = useState(false);
    const [billingProof, setBillingProof] = useState('');
    const [now, setNow] = useState(Date.now);
    const terms: QuoteTerms | undefined = quote ? parseQuoteTerms(quote.snapshot) : undefined;
    const quoteExpired = !!quote && !(quoteTimestamp(quote.expiresAt) > now);
    const cardSubscription = scope.type === 'WARD' && purpose === 'SUBSCRIPTION';
    const cardReady =
        cardSubscription &&
        publicOffer.data?.ready &&
        sellerReady &&
        !quoteExpired &&
        terms?.termsVersion === SUBSCRIPTION_TERMS_VERSION &&
        terms.totalAmount > 0 &&
        terms.totalAmount <= (publicOffer.data?.maxChargeGross ?? 0);

    useEffect(() => {
        if (!quote) return;

        setNow(Date.now());

        const timer = setInterval(() => setNow(Date.now()), 1000);

        return () => clearInterval(timer);
    }, [quote]);

    const review = async () => {
        if (subscriptionUnavailable) return;

        const payload: QuoteRequest = {
            purpose,
            plan: targetPlan,
            capacity: purpose === 'USAGE_PACK' || purpose === 'SETUP' ? e.capacity.purchased : quoteCapacity,
            setupStaff: purpose === 'SETUP' ? setup : 0,
            fullPacks: purpose === 'USAGE_PACK' ? full : 0,
            partialPacks: purpose === 'USAGE_PACK' ? partial : 0,
        };
        const q = await commercialPost<Quote>(`/billing-scopes/${scope.scopeId}/quotes`, payload);

        if (!parseQuoteTerms(q.snapshot)) {
            setQuote(undefined);
            throw new Error(
                t('견적 정보를 확인하지 못했습니다. 정확한 금액을 다시 확인해 주세요.', 'Unable to verify the quote. Request a new quote.'),
            );
        }

        setQuote(q);
        setConsent(false);

        return q;
    };

    if (!e.canManageBilling)
        return (
            <Section title={t('최고 관리자에게 요청하기', 'Request from your owner')}>
                <Notice>
                    {t(
                        '계약과 결제는 최고 관리자가 관리합니다. 병원에 연결된 병동은 병원 최고 관리자가 계약 인원을 관리합니다.',
                        'Ward editors and hospital managers cannot pay. Hospital owners manage the shared capacity of linked wards.',
                    )}
                </Notice>
                <RequestForm scope={scope} />
            </Section>
        );

    return (
        <>
            {scope.type === 'HOSPITAL' ? (
                <>
                    <HospitalContractPanel scope={scope} />
                </>
            ) : null}
            {scope.type === 'HOSPITAL' && data.data ? (
                <Section title={t('청구·결제 내역', 'Invoices & payments')}>
                    {scope.type === 'HOSPITAL' && data.data.invoices.length === 0 ? (
                        <p className="hospital-billing-empty">{t('청구 내역이 없습니다.', 'No invoices yet.')}</p>
                    ) : (
                        <div className="workspace-table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>{t('기간', 'Period')}</th>
                                        <th>{t('청구 금액', 'Invoiced')}</th>
                                        <th>{t('수납', 'Collected')}</th>
                                        <th>{t('환불', 'Refunded')}</th>
                                        <th>{t('상태', 'Status')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.data.invoices.map((i) => (
                                        <tr key={i.id}>
                                            <td>{hospitalDate(i.periodStart)}</td>
                                            <td>{money(i.gross)}</td>
                                            <td>{money(i.allocated)}</td>
                                            <td>{money(i.refundedGross)}</td>
                                            <td>
                                                {(
                                                    {
                                                        OPEN: t('미납', 'Unpaid'),
                                                        PAID: t('납부 완료', 'Paid'),
                                                        VOID: t('청구 취소', 'Voided'),
                                                    } as Record<string, string>
                                                )[i.status] ?? i.status}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {data.data.orders.map((o) => (
                        <p key={o.id}>
                            <Link to={`/workspace/payment-return?orderId=${o.id}`}>
                                {money(o.gross)} · {o.status}
                            </Link>
                        </p>
                    ))}
                </Section>
            ) : null}
            {scope.type === 'WARD' && e.plan === 'PLUS' && e.entitlementSource === 'SUBSCRIPTION' ? (
                <PaymentMethodPanel scope={scope} />
            ) : null}
            <HospitalDisclosure
                active={scope.type === 'HOSPITAL'}
                title={t('요금제와 추가 구매', 'Plan & add-ons')}
                help={t(
                    'Hospital은 계약 병원의 여러 병동을 함께 관리합니다. 관리자 정원과 편성 인원은 별도로 계산합니다.',
                    'Hospital covers multiple contracted wards. Administrator seats and scheduling staff are counted separately.',
                )}
            >
                <Section
                    title={t('요금제와 추가 구매', 'Plan & add-ons')}
                    help={
                        scope.type === 'HOSPITAL'
                            ? t(
                                  'Hospital은 계약 병원의 여러 병동을 함께 관리합니다. 관리자 정원과 편성 인원은 별도로 계산합니다.',
                                  'Hospital covers multiple contracted wards. Administrator seats and scheduling staff are counted separately.',
                              )
                            : undefined
                    }
                >
                    {scope.type === 'WARD' ? (
                        <p>
                            {t(
                                'Plus는 병동 하나, Hospital은 계약 병원의 여러 병동을 함께 관리합니다. 로그인 관리자 수와 편성 인원은 서로 다릅니다.',
                                'Plus covers one ward. Hospital coordinates multiple contracted wards. Administrator seats and scheduling staff are separate.',
                            )}
                        </p>
                    ) : null}
                    <div className="workspace-plan-summary">
                        <strong>{scope.type === 'HOSPITAL' ? 'Hospital' : 'Plus'}</strong>
                        {planPricing ? (
                            <>
                                <span>
                                    {t('기본', 'Base')} {money(planPricing.baseGross)} /{' '}
                                    {t('월 · 기본 편성 인원', 'month · included staff')} {planPricing.includedStaff}
                                </span>
                                <span>
                                    {t('추가 1명', 'Each extra staff')} {money(planPricing.extraStaffGross)} / {t('월', 'month')}
                                </span>
                            </>
                        ) : (
                            <span>
                                {plans.isPending
                                    ? t('요금제를 불러오는 중입니다.', 'Loading plans…')
                                    : t('요금제 설정 중', 'Plan being configured')}
                            </span>
                        )}
                    </div>
                    {subscriptionUnavailable && !plans.isPending ? (
                        <Notice>
                            {plans.isError
                                ? t(
                                      '요금제를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.',
                                      'Unable to load plans. Please try again shortly.',
                                  )
                                : t(
                                      '요금제 설정이 완료되면 견적을 확인할 수 있습니다.',
                                      'Quotes will be available when this plan is configured.',
                                  )}
                        </Notice>
                    ) : null}
                    {!e.checkoutEnabled ? (
                        <Notice>
                            {t(
                                '현재 결제 오픈을 준비 중입니다. 견적과 도입 문의는 이용할 수 있습니다.',
                                'Payments are being prepared. Estimates and rollout inquiries remain available.',
                            )}
                        </Notice>
                    ) : null}
                    <Notice>
                        {scope.type === 'HOSPITAL'
                            ? t('Hospital은 개별 계약·계좌이체로 진행합니다.', 'Hospital uses individual contracts and bank transfers.')
                            : t(
                                  '현재 카드 결제는 Plus 월 구독만 지원합니다. Hospital은 개별 계약·계좌이체로 진행하며, 추가 횟수·중도 증원은 고객센터에 문의해 주세요.',
                                  'Card billing currently supports Plus monthly subscriptions. Contact support for Hospital contracts, add-ons or mid-cycle capacity changes.',
                              )}
                    </Notice>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void action.run(review);
                        }}
                        className="workspace-form-grid"
                    >
                        <Field label={t('이용할 상품', 'Product')}>
                            <select
                                value={purpose}
                                onChange={(event) => {
                                    setPurpose(event.target.value as QuoteRequest['purpose']);
                                    setQuote(undefined);
                                }}
                            >
                                {e.entitlementSource !== 'SUBSCRIPTION' ? (
                                    <option value="SUBSCRIPTION">{t('유료 구독 시작', 'Start paid subscription')}</option>
                                ) : (
                                    <>
                                        <option value="USAGE_PACK">{t('AI 횟수 추가', 'Additional AI uses')}</option>
                                        <option value="CAPACITY">{t('편성 인원 증설', 'Increase capacity')}</option>
                                        {scope.type === 'HOSPITAL' ? (
                                            <option value="SETUP">{t('초기 도입 세팅', 'Initial setup')}</option>
                                        ) : null}
                                    </>
                                )}
                            </select>
                        </Field>
                        {purpose === 'USAGE_PACK' ? (
                            <>
                                <Field
                                    label={`${t('전체 생성', 'Full generation')} ${e.policy.generatePackSize}${t('회 묶음', '-use pack')} · ${money(e.policy.generatePackGross)}`}
                                >
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={full}
                                        onChange={(event) => {
                                            setFull(Number(event.target.value));
                                            setQuote(undefined);
                                        }}
                                    />
                                </Field>
                                <Field
                                    label={`${t('부분 조정', 'Partial adjustment')} ${e.policy.adjustPackSize}${t('회 묶음', '-use pack')} · ${money(e.policy.adjustPackGross)}`}
                                >
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={partial}
                                        onChange={(event) => {
                                            setPartial(Number(event.target.value));
                                            setQuote(undefined);
                                        }}
                                    />
                                </Field>
                            </>
                        ) : purpose === 'SETUP' ? (
                            <Field label={t('세팅할 인원 S', 'Setup staff S')}>
                                <input
                                    type="number"
                                    min={1}
                                    max={10000}
                                    value={setup}
                                    onChange={(event) => {
                                        setSetup(Number(event.target.value));
                                        setQuote(undefined);
                                    }}
                                />
                            </Field>
                        ) : (
                            <Field label={t('변경 후 총 편성 인원', 'Total staff after change')}>
                                <input
                                    type="number"
                                    min={minimumCapacity}
                                    max={10000}
                                    value={draftCapacity}
                                    onChange={(event) => {
                                        setCapacity(Number(event.target.value));
                                        setQuote(undefined);
                                    }}
                                />
                            </Field>
                        )}
                        <button disabled={action.busy || subscriptionUnavailable}>{t('정확한 금액 확인', 'Review exact quote')}</button>
                    </form>
                    {quote && terms ? (
                        <div className="workspace-review" aria-live="polite">
                            <h3>
                                {scope.name} · {t('결제 전 확인', 'Review before paying')}
                            </h3>
                            <div className="workspace-stats">
                                <div>
                                    <strong>{money(terms.totalAmount)}</strong>
                                    <span>{t('이번 결제 총액 · 부가세 포함', 'Due now · VAT included')}</span>
                                </div>
                                <div>
                                    <strong>{money(terms.recurring.monthlyGross)}</strong>
                                    <span>{t('변경 후 월 구독료', 'Monthly subscription after change')}</span>
                                </div>
                            </div>
                            <p>
                                {t('공급가액', 'Net')} {money(terms.supplyAmount)} + VAT {money(terms.taxAmount)}
                            </p>
                            <p>
                                {date(terms.periodStart)} ~ {date(terms.periodEnd)} (KST)
                            </p>
                            {cardSubscription ? (
                                <p>
                                    {t('다음 자동결제일', 'Next automatic payment')}: {date(terms.periodEnd)} (KST)
                                </p>
                            ) : null}
                            <p>
                                {t('이번 제공량: 전체', 'This purchase: full')} {terms.fullUnits} / {t('부분', 'partial')}{' '}
                                {terms.partialUnits}
                            </p>
                            <p>
                                {t('견적 만료', 'Quote expires')}: {date(quote.expiresAt)}
                            </p>
                            {quoteExpired ? (
                                <p className="workspace-error" role="alert">
                                    {t(
                                        '견적이 만료되었습니다. 정확한 금액을 다시 확인해 주세요.',
                                        'This quote has expired. Request a new quote.',
                                    )}
                                </p>
                            ) : null}
                            <Notice>
                                {cardSubscription
                                    ? t(
                                          '기본 AI 횟수는 해당 이용기간까지 사용할 수 있습니다. 구독 해지는 기간 말에 적용하며 기존 자료는 유지됩니다.',
                                          'Included AI uses expire at the period end. Cancellation takes effect at period end; existing data is preserved.',
                                      )
                                    : t(
                                          '기본 횟수는 해당 주기까지, 추가 구매 횟수는 구매일부터 365일입니다. 두 종류의 횟수는 서로 전환되지 않습니다. 구독 해지는 기간 말에 적용하며 기존 자료는 유지됩니다.',
                                          'Included uses expire at the cycle end. Purchased uses last 365 days and cannot be converted between meters. Cancellation takes effect at period end; existing data is preserved.',
                                      )}
                            </Notice>
                            {cardSubscription && (
                                <>
                                    <details>
                                        <summary>{t('월 자동결제·해지·환불 안내', 'Monthly billing, cancellation & refunds')}</summary>
                                        <SubscriptionConditions />
                                        <RefundConditions />
                                    </details>
                                    <p>
                                        {t(
                                            '카드 등록을 마치면 결제 확인 화면으로 이동합니다. 그 화면에서 첫 결제를 확정하면 구독이 시작되고, 이후 매월 이용기간 종료일에 자동 갱신합니다.',
                                            'After card registration, review and confirm the first charge on the next screen. Monthly renewals follow at each period end.',
                                        )}
                                    </p>
                                    <Reauthenticate onVerified={setBillingProof} />
                                </>
                            )}
                            {scope.type === 'WARD' ? (
                                <>
                                    <label className="workspace-check">
                                        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                                        <span>
                                            {t('금액·대상·기간 및', 'I agree to the amount, scope, period and')}{' '}
                                            <Link to="/subscription-terms" target="_blank">
                                                {t('정기결제 약관', 'subscription terms')}
                                            </Link>{' '}
                                            ·{' '}
                                            <Link to="/refund" target="_blank">
                                                {t('환불 조건', 'refund policy')}
                                            </Link>
                                            {t('에 동의하며 매월 자동결제를 신청합니다.', ' and authorize monthly automatic payments.')}
                                        </span>
                                    </label>
                                    {e.entitlementSource === 'EVENT' ? (
                                        <label className="workspace-check">
                                            <input
                                                type="checkbox"
                                                checked={trialLoss}
                                                onChange={(event) => setTrialLoss(event.target.checked)}
                                            />
                                            <span>
                                                {t(
                                                    '남은 무료 이벤트 기간·제공량이 종료되고 지금 첫 결제가 이루어지는 것에 동의합니다.',
                                                    'I agree to end the remaining trial and make the first payment now.',
                                                )}
                                            </span>
                                        </label>
                                    ) : null}
                                    <button
                                        disabled={
                                            !consent ||
                                            !billingProof ||
                                            !cardReady ||
                                            action.busy ||
                                            !e.checkoutEnabled ||
                                            (e.entitlementSource === 'EVENT' && !trialLoss)
                                        }
                                        onClick={() =>
                                            void action.run(async () => {
                                                if (!(quoteTimestamp(quote.expiresAt) > Date.now())) {
                                                    setNow(Date.now());
                                                    throw new Error(
                                                        t(
                                                            '견적이 만료되었습니다. 정확한 금액을 다시 확인해 주세요.',
                                                            'This quote has expired. Request a new quote.',
                                                        ),
                                                    );
                                                }

                                                await loadToss();

                                                const payload = {
                                                    quoteId: quote.id,
                                                    contentHash: quote.contentHash,
                                                    termsVersion: terms.termsVersion,
                                                    trialLossAccepted: trialLoss,
                                                };
                                                const keyName = `dutying:checkout:${quote.id}`;
                                                const key = sessionStorage.getItem(keyName) ?? crypto.randomUUID();

                                                sessionStorage.setItem(keyName, key);

                                                const registration = await commercialPost<{
                                                    id: string;
                                                    orderId: string;
                                                    clientKey: string;
                                                    customerKey: string;
                                                    returnUrl: string;
                                                }>(
                                                    `/billing-scopes/${scope.scopeId}/subscription-checkout`,
                                                    {checkout: payload, reauthenticationToken: billingProof},
                                                    key,
                                                );

                                                await openTossBilling(registration);

                                                return registration;
                                            })
                                        }
                                    >
                                        {t('동의하고 정기결제 카드 등록', 'Agree & register subscription card')}
                                    </button>
                                </>
                            ) : null}
                            {!cardReady && (
                                <Notice>
                                    {cardSubscription
                                        ? t(
                                              '상품 안내 준비 상태 또는 1회 최대 100만 원의 결제 한도를 확인해 주세요.',
                                              'Review sales availability and the KRW 1,000,000 charge limit.',
                                          )
                                        : t(
                                              '이 견적은 상담용입니다. 고객센터를 통해 진행해 주세요.',
                                              'This estimate is for consultation. Please contact support.',
                                          )}
                                </Notice>
                            )}
                        </div>
                    ) : null}
                    <ActionsFeedback action={action} />
                </Section>
            </HospitalDisclosure>
            {data.data ? (
                <>
                    <HospitalDisclosure active={scope.type === 'HOSPITAL'} title={t('구독 관리', 'Subscription management')}>
                        <Section title={t('구독 관리', 'Subscription management')}>
                            <p>
                                {data.data.scope.cancelAtPeriodEnd
                                    ? t('기간 말 해지 예약됨', 'Cancellation scheduled')
                                    : t('현재 구독 기간', 'Current period')}
                                : {date(data.data.scope.periodEnd)}
                            </p>
                            {data.data.scope.periodEnd ? (
                                <button
                                    className="secondary"
                                    disabled={action.busy}
                                    onClick={() =>
                                        void action.run(() =>
                                            commercialPost(`/billing-scopes/${scope.scopeId}/renewal`, {
                                                expectedVersion: data.data!.scope.version,
                                                cancel: !data.data!.scope.cancelAtPeriodEnd,
                                            }),
                                        )
                                    }
                                >
                                    {data.data.scope.cancelAtPeriodEnd
                                        ? t('해지 예약 취소', 'Undo cancellation')
                                        : t('현재 기간 말에 해지', 'Cancel at period end')}
                                </button>
                            ) : null}
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void action.run(() =>
                                        commercialPost(`/billing-scopes/${scope.scopeId}/capacity-reservation`, {
                                            capacity: quoteCapacity,
                                            expectedVersion: data.data!.scope.version,
                                        }),
                                    );
                                }}
                            >
                                <Field label={t('다음 갱신 때 줄일 총 인원', 'Lower capacity at next renewal')}>
                                    <input
                                        type="number"
                                        min={minimumCapacity}
                                        max={10000}
                                        value={draftCapacity}
                                        onChange={(event) => setCapacity(Number(event.target.value))}
                                    />
                                </Field>
                                <button className="secondary" disabled={action.busy}>
                                    {t('다음 주기 감원 예약', 'Schedule decrease')}
                                </button>
                            </form>
                        </Section>
                    </HospitalDisclosure>
                    {scope.type === 'WARD' ? (
                        <Section title={t('청구·결제 내역', 'Invoices & payments')}>
                            <div className="workspace-table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{t('기간', 'Period')}</th>
                                            <th>{t('청구 금액', 'Invoiced')}</th>
                                            <th>{t('수납', 'Collected')}</th>
                                            <th>{t('환불', 'Refunded')}</th>
                                            <th>{t('상태', 'Status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.data.invoices.map((i) => (
                                            <tr key={i.id}>
                                                <td>{date(i.periodStart)}</td>
                                                <td>{money(i.gross)}</td>
                                                <td>{money(i.allocated)}</td>
                                                <td>{money(i.refundedGross)}</td>
                                                <td>{i.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {data.data.orders.map((o) => (
                                <p key={o.id}>
                                    <Link to={`/workspace/payment-return?orderId=${o.id}`}>
                                        {money(o.gross)} · {o.status}
                                    </Link>
                                </p>
                            ))}
                        </Section>
                    ) : null}
                    <HospitalDisclosure active={scope.type === 'HOSPITAL'} title={t('환불·정산 문의', 'Refund & billing support')}>
                        <Section title={t('환불·정산 문의', 'Refund & billing support')}>
                            <RequestForm scope={scope} kind="REFUND" invoices={data.data.invoices} />
                            {data.data.requests.map((r) => (
                                <p key={r.id}>
                                    {r.kind} · {r.status} · {r.resolution ?? date(r.createdAt)}
                                </p>
                            ))}
                        </Section>
                    </HospitalDisclosure>
                </>
            ) : (
                <ErrorView error={data.error} />
            )}
            <HospitalDisclosure
                active={scope.type === 'HOSPITAL'}
                title={t('예상 견적 계산', 'Estimate calculator')}
                help={t(
                    '월 계약 인원과 처음 세팅할 인원을 입력하세요. 부가세 포함 예상액이며, 최종 금액은 도입 범위와 계약 조건을 확인한 뒤 확정합니다.',
                    'Enter monthly capacity and initial setup staff. Indicative KRW prices include VAT. Final pricing follows scope and contract review.',
                )}
            >
                {scope.type === 'HOSPITAL' ? <HospitalCalculator scope={scope} e={e} /> : null}
            </HospitalDisclosure>
        </>
    );
}

function MembersPanel({scope, e}: {scope: Scope; e: Entitlement}) {
    const t = useCopy();
    const action = useAction();
    const accountId = useAuthStore((s) => s.accountId);
    const [email, setEmail] = useState('');
    const [inviteUrl, setInviteUrl] = useState('');
    const [reauth, setReauth] = useState('');
    const [target, setTarget] = useState('');
    const [leave, setLeave] = useState(false);
    const data = useQuery({
        queryKey: commercialQueryKey(accountId, scope.type, scope.ref, 'members'),
        queryFn: () =>
            scope.type === 'WARD'
                ? legacyGet<Members>(`/admin/wards/${scope.ref}/admins`)
                : commercialGet<Members>(`/organizations/${scope.ref}/members`),
    });
    const canInvite =
        scope.role === 'OWNER' && e.allowedActions.includes(scope.type === 'WARD' ? 'WARD_INVITE_CREATE' : 'ORG_INVITE_CREATE');

    return (
        <>
            {scope.type === 'HOSPITAL' ? <HospitalMembersPanel scope={scope} entitlement={e} /> : null}
            <details className="workspace-member-secondary" open={scope.type === 'WARD' ? true : undefined}>
                <summary className="workspace-member-secondary-title">
                    {scope.type === 'HOSPITAL'
                        ? t('초대 및 권한 인계', 'Invitations & ownership')
                        : t('초대·참여 및 최고 관리자 인계', 'Invitations, membership & ownership transfer')}
                </summary>
                <Section
                    title={scope.type === 'HOSPITAL' ? t('초대 관리', 'Invitations') : t('관리자와 초대', 'Administrators & invitations')}
                    help={
                        scope.type === 'HOSPITAL'
                            ? t(
                                  '한 사람당 개인 계정 하나를 사용합니다. 편성 대상 간호사는 여기 초대하지 않습니다.',
                                  'Each administrator uses their own account. Scheduling staff do not need invitations here.',
                              )
                            : undefined
                    }
                >
                    {scope.type === 'WARD' ? (
                        <p>
                            {t(
                                '한 사람당 개인 계정 하나를 사용합니다. 편성 대상 간호사는 여기 초대하지 않습니다.',
                                'Each administrator uses their own account. Scheduling staff do not need invitations here.',
                            )}
                        </p>
                    ) : null}
                    {scope.type === 'HOSPITAL' ? (
                        <p className="hospital-secondary-caption">
                            {t('대기 중인 초대', 'Pending invitations')} {e.adminSeats.reserved}
                            {t('명', ' people')}
                        </p>
                    ) : (
                        <p>
                            {e.adminSeats.active}
                            {t('명 참여', ' active')} + {e.adminSeats.reserved}
                            {t('명 대기', ' pending')} /{' '}
                            {e.restrictionStates?.ADMIN_SEATS === false ? t('제한 해제', 'No plan limit') : e.adminSeats.limit}
                            {t('명', ' seats')}
                        </p>
                    )}
                    <ErrorView error={data.error} />
                    {scope.type === 'WARD'
                        ? data.data?.members.map((m) => (
                              <div className="workspace-row" key={memberId(m)}>
                                  <div>
                                      <strong>{m.name}</strong>
                                      <p>
                                          {workspaceRoleLabel(m.role, t('ko', 'en') === 'ko')} · {m.email ?? ''}
                                      </p>
                                  </div>
                                  {scope.role === 'OWNER' && m.role !== 'OWNER' ? (
                                      <button
                                          className="secondary danger"
                                          disabled={action.busy}
                                          onClick={() =>
                                              void action.run(() => {
                                                  if (
                                                      !window.confirm(
                                                          t(
                                                              '이 관리자의 접근 권한을 제거할까요? 계정과 근무표는 유지됩니다.',
                                                              'Remove this administrator’s access? Their account and schedules are preserved.',
                                                          ),
                                                      )
                                                  )
                                                      return Promise.resolve();

                                                  return scope.type === 'WARD'
                                                      ? legacyDelete(`/admin/wards/${scope.ref}/admins/${memberId(m)}`)
                                                      : commercialPost(`/organizations/${scope.ref}/members/${memberId(m)}/REMOVE`, {
                                                            expectedVersion: m.version,
                                                        });
                                              })
                                          }
                                      >
                                          {t('이 범위에서 제거', 'Remove from scope')}
                                      </button>
                                  ) : null}
                              </div>
                          ))
                        : null}
                    {canInvite ? (
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                void action.run(async () => {
                                    if (scope.type === 'WARD') {
                                        await legacyPost(`/admin/wards/${scope.ref}/admin-emails`, {email, role: 'EDITOR'});
                                        action.setNotice(
                                            t(
                                                '초대 메일을 발송 요청했습니다. 수락 후 참여합니다.',
                                                'Invitation requested. They join after accepting.',
                                            ),
                                        );
                                    } else {
                                        const r = await commercialPost<{invitationUrl: string}>(`/organizations/${scope.ref}/invitations`, {
                                            email,
                                        });

                                        setInviteUrl(r.invitationUrl);
                                    }

                                    setEmail('');
                                });
                            }}
                        >
                            <Field label={t('초대할 관리자 이메일', 'Administrator email')}>
                                <input
                                    type="email"
                                    required
                                    maxLength={254}
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                />
                            </Field>
                            <button disabled={action.busy || isAdminSeatLimitReached(e)}>{t('관리자 초대', 'Invite administrator')}</button>
                        </form>
                    ) : null}
                    {inviteUrl ? (
                        <Notice>
                            {scope.type === 'HOSPITAL'
                                ? t('초대 이메일의 계정으로 수락해야 합니다.', 'Accept using the invited email account.')
                                : t(
                                      '초대받은 이메일 계정으로 수락해야 합니다. 초대 링크를 전달하세요.',
                                      'The invited email account must accept. Share this invitation link.',
                                  )}{' '}
                            <button className="secondary" onClick={() => void navigator.clipboard.writeText(inviteUrl)}>
                                {t('링크 복사', 'Copy link')}
                            </button>
                        </Notice>
                    ) : null}
                    {scope.type === 'WARD' && data.data?.reservedEmails?.length ? (
                        <Notice>
                            {t(
                                '예약된 이메일은 아래 초대 목록에서 관리합니다.',
                                'Reserved emails are managed in the invitation list below.',
                            )}{' '}
                            {data.data.reservedEmails.map((r) => r.email).join(', ')}
                        </Notice>
                    ) : null}
                    {data.data?.invitations.map((i) => (
                        <div className="workspace-row" key={i.id ?? i.invitationId}>
                            <div>
                                {i.email ?? i.invitedEmailNormalized ?? i.invitedEmail}
                                <p>
                                    {t('만료', 'Expires')} {date(i.expiresAt)}
                                </p>
                            </div>
                            {scope.role === 'OWNER' ? (
                                <div className="workspace-actions">
                                    <button
                                        className="secondary"
                                        disabled={action.busy}
                                        onClick={() =>
                                            void action.run(async () => {
                                                if (scope.type === 'WARD')
                                                    return legacyPost(
                                                        `/admin/wards/${scope.ref}/admin-invitations/${i.id ?? i.invitationId}/resend`,
                                                        {},
                                                    );

                                                const r = await commercialPost<{invitationUrl: string}>(`/invitations/${i.id}/RESEND`, {
                                                    expectedVersion: i.version,
                                                });

                                                setInviteUrl(r.invitationUrl);

                                                return r;
                                            })
                                        }
                                    >
                                        {t('재발송', 'Resend')}
                                    </button>
                                    <button
                                        className="secondary"
                                        disabled={action.busy}
                                        onClick={() =>
                                            void action.run(() =>
                                                scope.type === 'WARD'
                                                    ? legacyDelete(`/admin/wards/${scope.ref}/admin-invitations/${i.id ?? i.invitationId}`)
                                                    : commercialPost(`/invitations/${i.id}/CANCEL`, {expectedVersion: i.version}),
                                            )
                                        }
                                    >
                                        {t('취소', 'Cancel')}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    ))}
                    {scope.role !== 'OWNER' && !(scope.type === 'WARD' && scope.accessSource === 'HOSPITAL') ? (
                        <button
                            className="secondary danger"
                            disabled={action.busy}
                            onClick={() =>
                                void action.run(() => {
                                    if (
                                        !window.confirm(
                                            t(
                                                '이 범위에서 나갈까요? 다시 참여하려면 초대가 필요합니다.',
                                                'Leave this scope? You will need an invitation to return.',
                                            ),
                                        )
                                    )
                                        return Promise.resolve();

                                    return scope.type === 'WARD'
                                        ? legacyDelete(`/admin/wards/${scope.ref}/quit`)
                                        : commercialPost(
                                              `/organizations/${scope.ref}/members/${memberId(data.data!.members.find((m) => accountIdOf(m) === accountId)!)}/LEAVE`,
                                          );
                                })
                            }
                        >
                            {t('이 범위에서 나가기', 'Leave this scope')}
                        </button>
                    ) : null}
                    <ActionsFeedback action={action} />
                </Section>
                {scope.role === 'OWNER' ? (
                    <Section
                        title={t('최고 관리자 인계', 'Transfer ownership')}
                        help={
                            scope.type === 'HOSPITAL'
                                ? t(
                                      '기존 병원 관리자에게 요청할 수 있습니다. 대상자가 이메일로 본인 확인 후 수락해야 역할이 변경됩니다.',
                                      'Request a transfer to an existing hospital administrator. Roles change after the recipient verifies their email and accepts.',
                                  )
                                : undefined
                        }
                    >
                        <Notice>
                            {scope.type === 'HOSPITAL'
                                ? t(
                                      '상대방 수락 후 인계됩니다. 결제 카드는 인계되지 않습니다.',
                                      'Ownership changes after acceptance. Payment methods are not transferred.',
                                  )
                                : t(
                                      '같은 범위의 기존 관리자에게 요청합니다. 대상자가 재인증하고 수락하기 전까지 역할은 바뀌지 않습니다. 결제 카드는 인계되지 않습니다.',
                                      'Request a transfer to an existing administrator in this scope. Roles change only after they verify and accept. Payment methods are not transferred.',
                                  )}
                        </Notice>
                        <Reauthenticate onVerified={setReauth} />
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                void action.run(async () => {
                                    const r = await commercialPost(`/scopes/${scope.type}/${scope.ref}/owner-transfers`, {
                                        targetAccountId: Number(target),
                                        leaveAfter: leave,
                                        reauthenticationToken: reauth,
                                    });

                                    action.setNotice(
                                        t(
                                            '인계 요청을 보냈습니다. 7일 이내 대상자의 수락이 필요합니다.',
                                            'Transfer requested. Recipient must accept within 7 days.',
                                        ),
                                    );

                                    return r;
                                });
                            }}
                        >
                            <Field label={t('새 최고 관리자가 될 관리자', 'New owner')}>
                                <select required value={target} onChange={(event) => setTarget(event.target.value)}>
                                    <option value="">{t('선택하세요', 'Select')}</option>
                                    {data.data?.members
                                        .filter((m) => m.role !== 'OWNER' && accountIdOf(m) != null)
                                        .map((m) => (
                                            <option key={memberId(m)} value={accountIdOf(m)}>
                                                {m.name}
                                            </option>
                                        ))}
                                </select>
                            </Field>
                            <label className="workspace-check">
                                <input type="checkbox" checked={leave} onChange={(event) => setLeave(event.target.checked)} />
                                <span>{t('인계 완료 후 이 범위에서 나가기', 'Leave this scope after transfer')}</span>
                            </label>
                            <button disabled={!reauth || action.busy}>{t('인계 요청', 'Request transfer')}</button>
                        </form>
                    </Section>
                ) : null}
            </details>
        </>
    );
}

function useOrganization(scope: Scope) {
    const accountId = useAuthStore((state) => state.accountId);

    return useQuery({
        queryKey: commercialQueryKey(accountId, 'HOSPITAL', scope.ref, 'overview'),
        queryFn: () => commercialGet<Organization>(`/organizations/${scope.ref}`),
        staleTime: 10_000,
        refetchOnWindowFocus: 'always',
        retry: false,
    });
}

function HospitalContractPanel({scope}: {scope: Scope}) {
    const t = useCopy();
    const action = useAction();
    const query = useOrganization(scope);

    if (!query.data) return <ErrorView error={query.error} />;

    const o = query.data;
    const contract = o.organization.quoteSnapshot
        ? (JSON.parse(o.organization.quoteSnapshot) as {
              capacity: number;
              setupStaff: number;
              startsAt: string;
              endsAt: string;
              termsRef: string;
              paymentMode: string;
          })
        : null;

    return (
        <>
            {scope.role === 'OWNER' ? (
                <Section title={t('계약 정보', 'Contract details')}>
                    {contract ? (
                        <>
                            <dl className="hospital-contract-amounts">
                                <div>
                                    <dt>{t('월 이용료 · 부가세 포함', 'Monthly fee · VAT included')}</dt>
                                    <dd>{o.contractEstimate ? money(o.contractEstimate.monthlyGross) : '—'}</dd>
                                </div>
                                <div>
                                    <dt>{t('초기 도입비 · 1회', 'One-time setup fee')}</dt>
                                    <dd>{o.contractEstimate ? money(o.contractEstimate.setupGross) : '—'}</dd>
                                </div>
                            </dl>
                            <dl className="hospital-contract-facts">
                                <div>
                                    <dt>{t('총 계약 인원', 'Contracted capacity')}</dt>
                                    <dd>
                                        {contract.capacity}
                                        {t('명', ' staff')}
                                    </dd>
                                </div>
                                <div>
                                    <dt>{t('초기 세팅 인원', 'Setup staff')}</dt>
                                    <dd>
                                        {contract.setupStaff}
                                        {t('명', ' staff')}
                                    </dd>
                                </div>
                                <div className="hospital-contract-period">
                                    <dt>{t('계약 기간', 'Contract period')}</dt>
                                    <dd>
                                        {hospitalDate(contract.startsAt, true)}
                                        <br />~ {hospitalDate(contract.endsAt, true)} (KST)
                                    </dd>
                                </div>
                                <div>
                                    <dt>{t('납부 방식', 'Payment method')}</dt>
                                    <dd>
                                        {contract.paymentMode === 'PREPAID'
                                            ? t('선불', 'Prepaid')
                                            : contract.paymentMode === 'POSTPAID'
                                              ? t('후불', 'Postpaid')
                                              : contract.paymentMode}
                                    </dd>
                                </div>
                                <div className="hospital-contract-document">
                                    <dt>{t('약관·계약 문서', 'Terms reference')}</dt>
                                    <dd>{contract.termsRef}</dd>
                                </div>
                            </dl>
                            <div className="workspace-actions">
                                {!o.organization.contractAcceptedAt ? (
                                    <button
                                        disabled={action.busy}
                                        onClick={() =>
                                            void action.run(() =>
                                                commercialPost(`/organizations/${scope.ref}/accept/CONTRACT`, {
                                                    contractHash: o.organization.contractHash,
                                                }),
                                            )
                                        }
                                    >
                                        {t('이 계약 조건에 동의', 'Accept these contract terms')}
                                    </button>
                                ) : (
                                    <span className="hospital-contract-status">
                                        {t('계약 수락 완료', 'Contract accepted')} · {hospitalDate(o.organization.contractAcceptedAt)}
                                    </span>
                                )}
                                {o.organization.adoptionStage === 'READY' && !o.organization.setupAcceptedAt ? (
                                    <button
                                        disabled={action.busy}
                                        onClick={() =>
                                            void action.run(() =>
                                                commercialPost(`/organizations/${scope.ref}/accept/SETUP`, {
                                                    contractHash: o.organization.contractHash,
                                                }),
                                            )
                                        }
                                    >
                                        {t('초기 세팅 결과를 확인하고 수락', 'Confirm & accept initial setup')}
                                    </button>
                                ) : null}
                                {o.organization.setupAcceptedAt ? (
                                    <span className="hospital-contract-status">{t('초기 세팅 확인 완료', 'Initial setup accepted')}</span>
                                ) : null}
                            </div>
                        </>
                    ) : (
                        <p className="hospital-billing-empty">{t('등록된 계약 정보가 없습니다.', 'No contract details yet.')}</p>
                    )}
                </Section>
            ) : null}
            <ActionsFeedback action={action} />
        </>
    );
}

function PaymentReturn() {
    const t = useCopy();
    const action = useAction();
    const location = useLocation();
    const accountId = useAuthStore((s) => s.accountId);
    const params = new URLSearchParams(location.search);
    const id = params.get('orderId');
    const paymentKey = useRef(params.get('paymentKey'));
    const query = useQuery({
        queryKey: commercialQueryKey(accountId, 'order', id),
        queryFn: () => commercialGet<Order>(`/orders/${id}`),
        enabled: !!id,
        refetchInterval: (q) => (['PROCESSING', 'UNKNOWN', 'PAID_PENDING_APPLICATION'].includes(q.state.data?.status ?? '') ? 5000 : false),
    });

    useEffect(() => {
        if (paymentKey.current) {
            const url = new URL(window.location.href);

            url.searchParams.delete('paymentKey');
            url.searchParams.delete('amount');
            window.history.replaceState(null, '', url.pathname + url.search);
        }
    }, []);

    const order = query.data;

    return (
        <Section title={t('결제 상태 확인', 'Payment status')}>
            <Notice>
                {t(
                    'PG 승인과 서비스 적용을 각각 확인합니다. 확인 중에는 새 결제를 만들지 마세요.',
                    'Provider approval and service activation are checked separately. Do not create another payment while reconciliation is pending.',
                )}
            </Notice>
            {order ? (
                <>
                    <div className="workspace-stats">
                        <div>
                            <strong>{money(order.gross)}</strong>
                            <span>{paymentStatusLabel(order.status, t)}</span>
                        </div>
                    </div>
                    <p>
                        {t('PG 검증', 'Provider verified')}: {date(order.verifiedAt)}
                    </p>
                    <p>
                        {t('서비스 적용', 'Service applied')}: {date(order.appliedAt)}
                    </p>
                    {order.failureCode ? <Notice>{order.failureCode}</Notice> : null}
                    {order.status === 'AWAITING_PAYMENT' && !order.provider && (
                        <Notice>
                            {t(
                                '아직 청구되지 않은 주문입니다. 카드 등록을 완료하지 못했다면 아래에서 주문을 취소한 후 병동 결제 화면에서 다시 시작하세요.',
                                'No charge has been submitted. Cancel this order below and restart from ward billing if card registration was not completed.',
                            )}
                        </Notice>
                    )}
                    {order.provider && !['APPLIED', 'FAILED'].includes(order.status) ? (
                        <button
                            className="secondary"
                            disabled={action.busy}
                            onClick={() => void action.run(() => commercialPost(`/orders/${id}/INQUIRE`))}
                        >
                            {t('PG 거래 재조회', 'Recheck payment provider')}
                        </button>
                    ) : null}
                    {order.status === 'AWAITING_PAYMENT' && !order.provider ? (
                        <button
                            className="secondary"
                            disabled={action.busy}
                            onClick={() => void action.run(() => commercialPost(`/orders/${id}/abandon`))}
                        >
                            {t('결제 전 주문 취소', 'Cancel unsubmitted order')}
                        </button>
                    ) : null}
                    <Link className="workspace-button secondary" to="/workspace">
                        {t('관리 화면으로', 'Back to workspaces')}
                    </Link>
                </>
            ) : null}
            <ErrorView error={query.error} />
            <ActionsFeedback action={action} />
        </Section>
    );
}

function SupportConsentPanel({scope}: {scope: Scope}) {
    const t = useCopy();
    const action = useAction();
    const accountId = useAuthStore((s) => s.accountId);
    const staff = useQuery({
        queryKey: commercialQueryKey(accountId, 'support-staff'),
        queryFn: () => commercialGet<{id: string; name: string}[]>('/support-staff'),
    });
    const grants = useQuery({
        queryKey: commercialQueryKey(accountId, 'WARD', scope.ref, 'support-grants'),
        queryFn: () =>
            commercialGet<{id: string; staffId: string; purpose: string; actions: string; expiresAt: string; revoked: boolean}[]>(
                `/wards/${scope.ref}/support-grants`,
            ),
    });

    return (
        <div className="workspace-review">
            <h3>{t('직원 지원 접근 동의', 'Staff support access')}</h3>
            <p>
                {t(
                    '지정한 직원에게 이 병동의 선택한 작업만 한시적으로 허용합니다. 언제든 철회할 수 있습니다.',
                    'Allow only the selected actions for a designated staff member in this ward. Revoke at any time.',
                )}
            </p>
            <form
                onSubmit={(event) => {
                    event.preventDefault();

                    const f = new FormData(event.currentTarget);

                    void action.run(() =>
                        commercialPost(`/wards/${scope.ref}/support-grants`, {
                            staffId: String(f.get('staffId')),
                            purpose: String(f.get('purpose')),
                            actions: f.getAll('actions').join(','),
                            expiresAt: new Date(Date.now() + Number(f.get('hours')) * 3600000).toISOString().replace('Z', ''),
                        }),
                    );
                }}
            >
                <Field label={t('지원 직원', 'Support staff')}>
                    <select name="staffId" required defaultValue="">
                        <option value="">{t('선택', 'Select')}</option>
                        {staff.data?.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label={t('지원 목적', 'Purpose')}>
                    <input name="purpose" maxLength={600} required />
                </Field>
                {[
                    ['WARD_VIEW', t('명단·근무표 열람', 'View roster and schedule')],
                    ['ROSTER_EDIT', t('근무표 수정본 저장', 'Save schedule revisions')],
                    ['STAFF_EDIT', t('편성 인원 이름 수정', 'Correct staff names')],
                ].map(([value, label]) => (
                    <label key={value} className="workspace-check">
                        <input type="checkbox" name="actions" value={value} defaultChecked={value === 'WARD_VIEW'} />
                        {label}
                    </label>
                ))}
                <Field label={t('허용 시간', 'Duration')}>
                    <select name="hours" defaultValue="2">
                        <option value="1">1h</option>
                        <option value="2">2h</option>
                        <option value="8">8h</option>
                        <option value="24">24h</option>
                    </select>
                </Field>
                <button disabled={action.busy}>{t('이 범위로 지원 동의', 'Consent to this support scope')}</button>
            </form>
            {grants.data?.map((g) => (
                <p key={g.id}>
                    {g.purpose} · {g.actions} · {date(g.expiresAt)}{' '}
                    {!g.revoked ? (
                        <button
                            className="secondary"
                            disabled={action.busy}
                            onClick={() => void action.run(() => commercialDelete(`/support-grants/${g.id}`))}
                        >
                            {t('즉시 철회', 'Revoke now')}
                        </button>
                    ) : (
                        t('철회됨', 'Revoked')
                    )}
                </p>
            ))}
            <ErrorView error={staff.error ?? grants.error} />
            <ActionsFeedback action={action} />
        </div>
    );
}

function PaymentMethodPanel({scope}: {scope: Scope}) {
    const t = useCopy();
    const action = useAction();
    const accountId = useAuthStore((s) => s.accountId);
    const [proof, setProof] = useState('');
    const [consent, setConsent] = useState(false);
    const q = useQuery({
        queryKey: commercialQueryKey(accountId, scope.type, scope.ref, 'payment-method'),
        queryFn: () =>
            commercialGet<{registered: boolean; termsVersion: string; maskedCard?: string}>(
                `/billing-scopes/${scope.scopeId}/payment-method`,
            ),
    });

    return (
        <Section title={t('자동 갱신 결제수단', 'Automatic renewal payment method')}>
            <p>
                {q.isPending
                    ? t('결제수단을 확인하고 있습니다.', 'Checking your payment method…')
                    : q.isError
                      ? t('결제수단 정보를 확인하지 못했습니다.', 'Unable to check your payment method.')
                      : q.data?.registered
                        ? q.data.maskedCard
                        : t('등록된 자동결제 수단이 없습니다.', 'No automatic renewal method is registered.')}
            </p>
            <Notice>
                {t(
                    '매월 갱신일에 현재 계약 인원과 계약 요금으로 청구합니다. 카드 정보는 결제사 화면에서 입력하며, 최고 관리자 인계 시 기존 카드로 갱신하지 않습니다.',
                    'Each renewal charges your contracted capacity and pricing. Enter card details on the payment provider’s screen. Ownership transfer stops renewal on the previous owner’s card.',
                )}
            </Notice>
            <Reauthenticate onVerified={setProof} />
            <label className="workspace-check">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                {t('현재 계약 조건의 매월 자동 갱신에 동의합니다.', 'I consent to monthly renewal under the current contract terms.')}
            </label>
            <button
                disabled={!proof || !consent || action.busy || q.isPending || q.isError || !q.data?.termsVersion}
                onClick={() =>
                    void action.run(async () => {
                        await loadToss();

                        const d = await commercialPost<{id: string; clientKey: string; customerKey: string; returnUrl: string}>(
                            `/billing-scopes/${scope.scopeId}/payment-method`,
                            {termsVersion: q.data?.termsVersion, reauthenticationToken: proof},
                        );

                        await openTossBilling(d);
                    })
                }
            >
                {t('카드 등록·변경', 'Register or replace card')}
            </button>
            {q.data?.registered ? (
                <button
                    className="secondary"
                    disabled={action.busy}
                    onClick={() => void action.run(() => commercialDelete(`/billing-scopes/${scope.scopeId}/payment-method`))}
                >
                    {t('자동 갱신 해제 및 카드 등록 삭제', 'Stop renewal and remove card')}
                </button>
            ) : null}
            <ActionsFeedback action={action} />
            <ErrorView error={q.error} />
        </Section>
    );
}

function BillingReturn() {
    const t = useCopy();
    const action = useAction();
    const client = useQueryClient();
    const location = useLocation();
    const params = useRef(readBillingReturnPayload(location.search));
    const [done, setDone] = useState(false);
    const [appliedOrder, setAppliedOrder] = useState<Order>();
    const id = params.current.get('orderId');
    const registration = params.current.get('registration');
    const authorization = params.current.get('authKey');
    const customerKey = params.current.get('customerKey');
    const callbackError = params.current.get('code');
    const accountId = useAuthStore((s) => s.accountId);
    const order = useQuery({
        queryKey: commercialQueryKey(accountId, 'order', id),
        queryFn: () => commercialGet<Order>(`/orders/${id}`),
        enabled: !!id,
        retry: false,
        refetchInterval: (q) => (['PROCESSING', 'UNKNOWN', 'PAID_PENDING_APPLICATION'].includes(q.state.data?.status ?? '') ? 5000 : false),
    });
    // A delayed status read must not downgrade an application confirmed by the server.
    const current = appliedOrder ?? order.data;
    const applied = current?.status === 'APPLIED';
    const summary = parseSubscriptionSummary(current?.subscriptionSummary);
    const invalidSummary = !!current?.subscriptionSummary && !summary;

    useEffect(() => {
        // Keep only the nonsensitive order identifier so a refresh can recover payment status.
        window.history.replaceState(window.history.state, '', location.pathname + (id ? `?orderId=${encodeURIComponent(id)}` : ''));
    }, [location.pathname, id]);

    return (
        <Section
            title={id ? t('Plus 첫 결제 확인', 'Confirm first Plus payment') : t('자동결제 등록 확인', 'Confirm renewal registration')}
        >
            <Notice>
                {id
                    ? applied
                        ? t(
                              '결제와 Plus 적용이 완료되었습니다. 등록한 카드로 매월 자동 갱신합니다.',
                              'Payment and Plus activation are complete. Your registered card will be charged monthly.',
                          )
                        : callbackError
                          ? t(
                                '카드 등록이 완료되지 않았습니다. 아래 안내를 확인해 주세요.',
                                'Card registration was not completed. Review the details below.',
                            )
                          : ['PROCESSING', 'UNKNOWN', 'PAID_PENDING_APPLICATION'].includes(current?.status ?? '')
                            ? t('결제 결과를 확인하고 있습니다.', 'Checking the payment result.')
                            : current?.status === 'FAILED'
                              ? t('결제가 완료되지 않았습니다.', 'The payment did not complete.')
                              : t(
                                    '카드 인증만으로 결제가 완료되지 않습니다. 아래에서 금액을 확인하고 첫 결제를 완료해 주세요.',
                                    'Card authorization alone does not complete your subscription. Review and confirm the first charge below.',
                                )
                    : done
                      ? t('등록되었습니다. 현재 계약의 다음 갱신일부터 사용합니다.', 'Registered for the next renewal.')
                      : t('카드 인증 결과를 서버에서 확인한 뒤 등록합니다.', 'The server verifies card authorization before registration.')}
            </Notice>
            {current && (
                <p>
                    {t('이번 결제금액', 'Due now')}: {money(current.gross)} · {t('상태', 'Status')}: {paymentStatusLabel(current.status, t)}
                </p>
            )}
            {summary ? (
                <dl className="workspace-payment-summary">
                    <div>
                        <dt>{t('이용 상품', 'Product')}</dt>
                        <dd>{summary.scopeName} · Plus</dd>
                    </div>
                    <div>
                        <dt>{t('이용기간', 'Service period')}</dt>
                        <dd>
                            {date(summary.periodStart)} ~ {date(summary.periodEnd)} (KST)
                        </dd>
                    </div>
                    <div>
                        <dt>{t('다음 자동결제일', 'Next automatic payment')}</dt>
                        <dd>{date(summary.periodEnd)} (KST)</dd>
                    </div>
                    <div>
                        <dt>{t('월 자동결제 금액 · 부가세 포함', 'Monthly automatic charge · VAT included')}</dt>
                        <dd>{money(summary.monthlyGross)}</dd>
                    </div>
                </dl>
            ) : null}
            {invalidSummary ? (
                <p className="workspace-error" role="alert">
                    {t(
                        '구독 이용 조건을 확인하지 못했습니다. 결제 상태를 다시 확인해 주세요.',
                        'Unable to verify subscription terms. Recheck payment status.',
                    )}
                </p>
            ) : null}
            {current && ['PROCESSING', 'UNKNOWN', 'PAID_PENDING_APPLICATION'].includes(current.status) && (
                <Notice>
                    {t(
                        '기존 결제 결과를 확인 중입니다. 새로 결제하지 말고 결과 조회를 이용해 주세요.',
                        'The existing payment is being reconciled. Check its status instead of paying again.',
                    )}
                </Notice>
            )}
            {current?.status === 'FAILED' && (
                <Notice>
                    {t(
                        '결제가 완료되지 않았습니다. 결제내역을 확인한 뒤 병동 결제 메뉴에서 새로 시작해 주세요.',
                        'The payment did not complete. Review payment history, then restart from ward billing.',
                    )}
                </Notice>
            )}
            {callbackError && (
                <p role="alert">
                    {callbackError === 'PAY_PROCESS_CANCELED'
                        ? t(
                              '카드 등록을 취소했습니다. 새 결제는 진행하지 않았습니다.',
                              'Card registration was canceled. No new payment was submitted.',
                          )
                        : t(
                              '카드 인증을 완료하지 못했습니다. 카드 정보를 확인하고 다시 시도해 주세요.',
                              'Card authorization failed. Check your card details and try again.',
                          )}
                </p>
            )}
            {authorization &&
                customerKey &&
                registration &&
                !callbackError &&
                !order.isError &&
                !done &&
                !applied &&
                (!id || (current?.status === 'AWAITING_PAYMENT' && !current.provider)) && (
                    <button
                        disabled={
                            action.busy ||
                            invalidSummary ||
                            (!!id && (!current || !Number.isSafeInteger(current.gross) || current.gross <= 0 || current.currency !== 'KRW'))
                        }
                        onClick={() =>
                            void action.run(async () => {
                                const body = {customerKey, authKey: authorization};

                                if (id) {
                                    try {
                                        const payment = await commercialPost<Order>(`/orders/${id}/confirm-subscription`, {
                                            ...body,
                                            registrationId: registration,
                                        });

                                        client.setQueryData(commercialQueryKey(accountId, 'order', id), {
                                            ...payment,
                                            subscriptionSummary: payment.subscriptionSummary ?? current?.subscriptionSummary,
                                        });

                                        if (payment.status === 'APPLIED') {
                                            setAppliedOrder({
                                                ...payment,
                                                subscriptionSummary: payment.subscriptionSummary ?? current?.subscriptionSummary,
                                            });
                                            setDone(true);
                                            clearBillingReturnPayload();
                                        }
                                    } finally {
                                        // A failed HTTP response may still have submitted a charge.
                                        // Refresh into reconciliation/declined state before another action.
                                        await order.refetch();
                                    }
                                } else {
                                    await commercialPost(`/billing-registrations/${registration}/confirm`, body);
                                    setDone(true);
                                    clearBillingReturnPayload();
                                }
                            })
                        }
                    >
                        {id
                            ? `${current ? money(current.gross) : ''} ${t('첫 결제하고 구독 시작', 'Pay & start subscription')}`
                            : t('확인하고 등록 완료', 'Verify & finish registration')}
                    </button>
                )}
            {id && (
                <Link className="workspace-button secondary" to={`/workspace/payment-return?orderId=${encodeURIComponent(id)}`}>
                    {t('결제 결과 재조회·미결제 주문 취소', 'Check payment status or cancel an unsubmitted order')}
                </Link>
            )}
            {(!authorization || !customerKey || !registration) && !applied && !callbackError && (
                <p>
                    {t(
                        '인증 정보가 없으면 새로 청구하지 않습니다. 결제 결과를 먼저 확인해 주세요.',
                        'No new charge is submitted without authorization. Check payment status first.',
                    )}
                </p>
            )}
            <ErrorView error={order.error} />
            {order.isError || invalidSummary ? (
                <button type="button" className="secondary" disabled={order.isFetching} onClick={() => void order.refetch()}>
                    {t('결제 상태 다시 확인', 'Recheck payment status')}
                </button>
            ) : null}
            <ActionsFeedback action={action} />
            <Link to="/workspace">{t('관리 공간으로', 'Back to workspaces')}</Link>
        </Section>
    );
}

function SupportBillingPanel({scope}: {scope: Scope}) {
    const t = useCopy();
    const action = useAction();
    const accountId = useAuthStore((s) => s.accountId);

    type TSupportOffer = {
        id: string;
        version: number;
        status: string;
        purpose: string;
        seconds: number;
        usedSeconds: number;
        gross: number;
        expiresAt: string;
    };

    const q = useQuery({
        queryKey: commercialQueryKey(accountId, scope.scopeId, 'support-billing'),
        queryFn: () =>
            commercialGet<{allowance: {includedSeconds: number; usedSeconds: number; remainingSeconds: number}; offers: TSupportOffer[]}>(
                `/billing-scopes/${scope.scopeId}/support`,
            ),
    });
    const offerStatuses: Record<string, string> = {
        OFFERED: t('동의 대기', 'Awaiting acceptance'),
        ACCEPTED: t('동의 완료', 'Accepted'),
        EXPIRED: t('기한 만료', 'Expired'),
        CANCELED: t('취소됨', 'Canceled'),
        COMPLETED: t('지원 완료', 'Completed'),
    };
    const offerStatus = (status: string) => offerStatuses[status] ?? status;

    return (
        <Section
            title={t('지원 시간', 'Support allowance')}
            help={t(
                '제품 결함 복구와 초기 세팅은 월 지원 시간을 차감하지 않습니다. 추가 지원은 표시된 금액과 시간에 동의한 뒤 별도로 청구됩니다.',
                'Defect recovery and initial setup do not consume the monthly allowance. Additional support is invoiced after you accept its price and time allowance.',
            )}
        >
            {q.isPending ? <p role="status">{t('지원 내역을 불러오는 중입니다.', 'Loading support details…')}</p> : null}
            {q.data ? (
                <>
                    <div className="hospital-support-balance">
                        <strong>
                            {Math.floor(q.data.allowance.remainingSeconds / 60)}
                            {t('분', ' min')}
                        </strong>
                        <span>{t('기본 지원 남음', 'Included support remaining')}</span>
                        <span>
                            {t('사용', 'Used')} {Math.floor(q.data.allowance.usedSeconds / 60)} /{' '}
                            {Math.floor(q.data.allowance.includedSeconds / 60)}
                            {t('분', ' min')}
                        </span>
                    </div>
                    <h3>{t('추가 지원 견적', 'Additional support quotes')}</h3>
                    {q.data.offers.length ? (
                        <p className="hospital-secondary-caption">
                            {t('동의한 추가 지원은 별도로 청구됩니다.', 'Accepted additional support is invoiced separately.')}
                        </p>
                    ) : (
                        <p className="hospital-billing-empty">{t('추가 지원 견적이 없습니다.', 'No additional support quotes.')}</p>
                    )}
                    {q.data.offers.map((o) => (
                        <div className="hospital-support-offer" key={o.id}>
                            <div>
                                <h3>{o.purpose}</h3>
                                <dl className="hospital-support-offer-facts">
                                    <div>
                                        <dt>{t('금액', 'Price')}</dt>
                                        <dd>{money(o.gross)}</dd>
                                    </div>
                                    <div>
                                        <dt>{t('지원 시간', 'Support time')}</dt>
                                        <dd>
                                            {Math.floor(o.seconds / 60)}
                                            {t('분', ' min')}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>{t('기한', 'Expires')}</dt>
                                        <dd>{scope.type === 'HOSPITAL' ? hospitalDate(o.expiresAt, true) : date(o.expiresAt)}</dd>
                                    </div>
                                    <div>
                                        <dt>{t('상태', 'Status')}</dt>
                                        <dd>{offerStatus(o.status)}</dd>
                                    </div>
                                </dl>
                            </div>
                            {o.status === 'OFFERED' ? (
                                <button
                                    disabled={action.busy}
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                t(
                                                    '표시된 금액의 청구와 지원 시간에 동의할까요?',
                                                    'Accept this support price, time allowance and invoice?',
                                                ),
                                            )
                                        )
                                            void action.run(() =>
                                                commercialPost(`/support-offers/${o.id}/accept`, {expectedVersion: o.version}),
                                            );
                                    }}
                                >
                                    {t('금액·시간 확인하고 동의', 'Accept price & time')}
                                </button>
                            ) : null}
                        </div>
                    ))}
                </>
            ) : null}
            <ErrorView error={q.error} />
            <ActionsFeedback action={action} />
        </Section>
    );
}

function AiBatchPanel({scope, e}: {scope: Scope; e: Entitlement}) {
    const navigate = useNavigate();
    const client = useQueryClient();
    const {
        actions: {handleGetAccountMe},
    } = useAuth();
    const t = useCopy();
    const action = useAction();
    const accountId = useAuthStore((s) => s.accountId);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selected, setSelected] = useState<number[]>([]);
    const [result, setResult] = useState<CommercialBatchResult>();
    const teams = useQuery({
        queryKey: commercialQueryKey(accountId, scope.scopeId, 'teams'),
        queryFn: () => WardAPI.getShiftTeams(Number(scope.ref)),
    });
    const fullUsage = e.usage.find((u) => u.meter === 'FULL_GENERATE');
    const remaining = fullUsage?.remaining ?? 0;

    return (
        <Section title={t('여러 팀 전체 생성', 'Generate schedules for multiple teams')}>
            {fullUsage?.enforced === false ? (
                <Notice>
                    {t(
                        '일괄 생성은 월간 횟수 예약이 필요해 현재 제한 설정에서는 사용할 수 없어요. 개별 팀 생성은 계속 사용할 수 있어요.',
                        'Batch generation requires monthly reservations. Individual team generation remains available.',
                    )}
                </Notice>
            ) : null}
            <Notice>
                {t(
                    '서버에 저장된 팀별 명단·설정으로 실행합니다. 전체 생성은 팀당 1회이며 필요한 횟수를 함께 예약합니다. 결과를 검토한 뒤 저장·확정해 주세요.',
                    'Uses each team’s roster and settings saved on the server. One full use is reserved per team before execution. Review results before saving or confirming.',
                )}
            </Notice>
            <Field label={t('편성 월', 'Schedule month')}>
                <input type="month" required min="2020-01" max="2100-12" value={month} onChange={(x) => setMonth(x.target.value)} />
            </Field>
            {teams.data?.map((team) => (
                <label className="workspace-check" key={team.shiftTeamId}>
                    <input
                        type="checkbox"
                        checked={selected.includes(team.shiftTeamId)}
                        onChange={(x) =>
                            setSelected((p) => (x.target.checked ? [...p, team.shiftTeamId] : p.filter((id) => id !== team.shiftTeamId)))
                        }
                    />
                    {team.name}
                </label>
            ))}
            <p>
                {t('필요한 전체 생성', 'Full uses needed')}: {selected.length} / {t('남음', 'Available')} {remaining}
            </p>
            <button
                disabled={
                    action.busy ||
                    fullUsage?.enforced === false ||
                    !selected.length ||
                    selected.length > remaining ||
                    selected.length > 20 ||
                    !e.allowedActions.includes('AI_GENERATE')
                }
                onClick={() =>
                    void action.run(async () => {
                        const [year, m] = month.split('-').map(Number);
                        const data = {items: selected.map((teamId) => ({teamId, request: {year, month: m, returnMode: 'PATCH'}}))};
                        const keyName = `dutying:batch:${accountId}:${scope.ref}`;
                        const fingerprint = JSON.stringify(data);
                        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty stored data also means no prior request.
                        const previous = JSON.parse(sessionStorage.getItem(keyName) || 'null') as {key: string; fingerprint: string} | null;

                        if (previous && previous.fingerprint !== fingerprint)
                            throw Error(
                                t(
                                    '이전 여러 팀 작업의 결과를 먼저 확인해 주세요.',
                                    'Review the previous batch before changing the targets.',
                                ),
                            );

                        const key = previous?.key ?? crypto.randomUUID();

                        sessionStorage.setItem(keyName, JSON.stringify({key, fingerprint}));

                        const r = await commercialPost<CommercialBatchResult>(`/wards/${scope.ref}/ai-batches`, data, key);

                        setResult(r);

                        if (r.jobs.every((j) => ['SUCCEEDED', 'NO_RESULT', 'FAILED'].includes(j.status)))
                            sessionStorage.removeItem(keyName);

                        return r;
                    })
                }
            >
                {t('필요 횟수 확인하고 전체 생성', 'Reserve uses & generate')}
            </button>
            <button
                className="secondary"
                disabled={action.busy}
                onClick={() =>
                    void action.run(async () => {
                        const raw = sessionStorage.getItem(`dutying:batch:${accountId}:${scope.ref}`);

                        if (!raw) return;

                        const {key} = JSON.parse(raw) as {key: string};
                        const r = await commercialGet<NonNullable<typeof result>>(`/wards/${scope.ref}/ai-batches/${key}`);

                        setResult(r);

                        if (r.jobs.every((j) => ['SUCCEEDED', 'NO_RESULT', 'FAILED'].includes(j.status)))
                            sessionStorage.removeItem(`dutying:batch:${accountId}:${scope.ref}`);
                    })
                }
            >
                {t('진행 중인 작업 확인', 'Check pending batch')}
            </button>
            {result?.jobs.map((j) => (
                <div className="workspace-row" key={j.id}>
                    <span>
                        {t('팀', 'Team')} {j.shiftTeamId} · {j.status}
                    </span>
                    {j.status === 'SUCCEEDED' && result.targets.find((x) => x.shiftTeamId === j.shiftTeamId) ? (
                        <button
                            className="secondary"
                            disabled={action.busy}
                            onClick={() =>
                                void action.run(async () => {
                                    const target = result.targets.find((x) => x.shiftTeamId === j.shiftTeamId)!;

                                    await commercialPost(`/scopes/WARD/${scope.ref}/select`);
                                    await client.cancelQueries();
                                    client.clear();
                                    await handleGetAccountMe();
                                    navigate(
                                        `${ROUTE.MAKE}?year=${target.year}&month=${target.month}&shiftTeamId=${j.shiftTeamId}&step=4&commercialBatch=${encodeURIComponent(result.requestKey)}`,
                                    );
                                })
                            }
                        >
                            {t('근무표에서 결과 검토', 'Review in schedule editor')}
                        </button>
                    ) : null}
                </div>
            ))}
            <ErrorView error={teams.error} />
            <ActionsFeedback action={action} />
        </Section>
    );
}

export default function WorkspacePage() {
    const t = useCopy();
    const context = useCommercialContext();
    const accountId = useAuthStore((s) => s.accountId);
    const location = useLocation();
    const action = useAction();
    const [mode, ref, requestedTab] = location.pathname.replace(/^\/workspace\/?/, '').split('/');
    const tab = requestedTab ?? (mode === 'HOSPITAL' ? 'overview' : 'usage');
    const {
        state: {accountMe},
    } = useAuth();
    const isWardLinkRoute = mode === 'WARD' && tab === 'links';
    const ownedWardLinkScope = isWardLinkRoute ? getOwnedWardLinkScope(context.data, accountMe, ref) : undefined;
    const scope = ownedWardLinkScope ?? context.data?.scopes.find((s) => s.type === mode && String(s.ref) === ref);
    const entitlement = useQuery({
        queryKey: commercialQueryKey(accountId, scope?.type, scope?.ref, 'entitlements'),
        queryFn: () => commercialGet<Entitlement>(`/scopes/${scope!.type}/${scope!.ref}/entitlements`),
        enabled: !!scope && !isWardLinkRoute,
        refetchOnWindowFocus: 'always',
        staleTime: 5000,
        retry: false,
    });
    const switchScope = useWorkspaceNavigation();
    const pendingCount = context.data?.enabled && !context.isError ? countWorkspaceRequests(context.data, accountId) : 0;

    useEffect(() => {
        if (entitlement.error) void context.refetch();
    }, [entitlement.error]);
    useEffect(() => {
        if (location.hash.includes('token=')) {
            window.history.replaceState(null, '', location.pathname + location.search);
        }
    }, [location.hash, location.pathname, location.search]);

    if (mode === 'invitations') return <Navigate to={`/workspace/notices${location.search}`} replace />;

    if (scope?.type === 'HOSPITAL' && !['overview', 'members', 'billing'].includes(tab))
        return <Navigate to={scopePath(scope, tab === 'usage' || tab === 'support' ? 'billing' : 'overview')} replace />;

    if (!mode) {
        return (
            <WorkspacePersonalShell
                page="workspaces"
                scopes={context.data?.enabled && !context.isError ? context.data.scopes : []}
                accountId={accountId}
                accountName={accountMe?.name ?? ''}
                pendingCount={pendingCount}
            >
                <WorkspaceHome
                    scopes={context.data?.enabled && !context.isError ? context.data.scopes : []}
                    currentWardId={accountMe?.wardId}
                    loading={context.isPending}
                    error={context.error}
                    onRetry={() => void context.refetch()}
                />
            </WorkspacePersonalShell>
        );
    }

    const personalPage: TPersonalWorkspacePage | undefined =
        mode === 'notices' || mode === 'plans'
            ? mode
            : ['receipts', 'payment-return', 'billing-return'].includes(mode)
              ? 'receipts'
              : undefined;

    if (personalPage) {
        return (
            <WorkspacePersonalShell
                page={personalPage}
                scopes={context.data?.enabled && !context.isError ? context.data.scopes : []}
                accountId={accountId}
                accountName={accountMe?.name ?? ''}
                pendingCount={pendingCount}
            >
                <ActionsFeedback action={action} />
                {context.isPending ? (
                    <div className="workspace-personal-state" role="status">
                        {t('계정 정보를 불러오는 중입니다.', 'Loading your account…')}
                    </div>
                ) : context.isError ? (
                    <div className="workspace-personal-state">
                        <ErrorView error={context.error} />
                        <button type="button" className="secondary" onClick={() => void context.refetch()}>
                            {t('다시 불러오기', 'Try again')}
                        </button>
                    </div>
                ) : !context.data?.enabled ? (
                    <div className="workspace-personal-state">
                        <p>{t('이용 관리 기능을 준비하고 있습니다.', 'Account services are being prepared.')}</p>
                        <Link className="workspace-button secondary" to={ROUTE.HOME}>
                            {t('근무표로 돌아가기', 'Back to schedules')}
                        </Link>
                    </div>
                ) : mode === 'notices' ? (
                    <WorkspaceActivity key={accountId} context={context.data} onRetry={() => void context.refetch()} />
                ) : mode === 'plans' ? (
                    <Plans key={accountId} />
                ) : mode === 'payment-return' ? (
                    <PaymentReturn key={accountId} />
                ) : mode === 'billing-return' ? (
                    <BillingReturn key={accountId} />
                ) : (
                    <Receipts key={accountId} />
                )}
            </WorkspacePersonalShell>
        );
    }

    if (mode === 'hospitals' || (mode === 'HOSPITAL' && !scope))
        return (
            <WorkspacePersonalShell
                page="workspaces"
                scopes={context.data?.enabled && !context.isError ? context.data.scopes : []}
                accountId={accountId}
                accountName={accountMe?.name ?? ''}
                pendingCount={pendingCount}
            >
                <HospitalChooser />
            </WorkspacePersonalShell>
        );

    const ContentTag = scope?.type === 'HOSPITAL' ? 'div' : 'main';
    const content = (
        <ContentTag className="workspace-main">
            {scope?.type !== 'HOSPITAL' ? (
                <>
                    <div className="workspace-title">
                        <div>
                            <p>{t('병동과 병원을 위한 관리 공간', 'Your ward and hospital workspaces')}</p>
                            <h1>
                                {scope?.name?.length
                                    ? scope.name
                                    : isWardLinkRoute
                                      ? t('병원 연결 관리', 'Hospital connections')
                                      : t('내 관리 공간', 'My workspaces')}
                            </h1>
                        </div>
                        {context.data?.scopes.length && !(isWardLinkRoute && context.data.configurationReady === false) ? (
                            <Field label={t('관리 범위 바꾸기', 'Switch workspace')}>
                                <select
                                    value={scope?.scopeId ?? ''}
                                    onChange={(event) => {
                                        const next = context.data?.scopes.find((s) => s.scopeId === event.target.value);

                                        if (next) void action.run(() => switchScope(next));
                                    }}
                                >
                                    <option value="">{t('선택하세요', 'Select')}</option>
                                    {context.data.scopes.map((s) => (
                                        <option key={s.scopeId} value={s.scopeId}>
                                            {s.type === 'HOSPITAL' ? t('병원', 'Hospital') : t('병동', 'Ward')} · {s.name} ·{' '}
                                            {workspaceRoleLabel(s.role, t('ko', 'en') === 'ko')}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                        ) : null}
                    </div>
                </>
            ) : null}
            <ActionsFeedback action={action} />
            {entitlement.data?.billingHold ? (
                <Notice>
                    {t(
                        '결제 취소·정산 대조로 유료 기능이 보류되었습니다. 기존 자료는 유지되며 운영팀에서 처리 상태를 안내합니다.',
                        'Paid features are on hold while a payment is reconciled. Existing data is preserved.',
                    )}
                </Notice>
            ) : null}
            {context.isPending ? (
                <p role="status">{t('관리 정보를 불러오는 중입니다.', 'Loading your workspaces…')}</p>
            ) : context.isError ? (
                <ErrorView error={context.error} />
            ) : !context.data?.enabled ? (
                <Notice>
                    {t('요금제·병원 관리 기능을 준비하고 있습니다.', 'Plans and hospital administration are being prepared.')}{' '}
                    <Link to={ROUTE.HOME}>{t('기존 서비스 열기', 'Open current service')}</Link>
                </Notice>
            ) : mode === 'plans' ? (
                <Plans />
            ) : mode === 'adoption' ? (
                <Navigate to="/workspace/hospitals" replace />
            ) : mode === 'hospitals' ? (
                <HospitalChooser />
            ) : mode === 'billing-return' ? (
                <BillingReturn />
            ) : mode === 'notices' ? (
                <WorkspaceActivity context={context.data} />
            ) : mode === 'payment-return' ? (
                <PaymentReturn />
            ) : mode === 'receipts' ? (
                <Receipts />
            ) : scope ? (
                <>
                    {scope.type !== 'HOSPITAL' ? (
                        <nav className="workspace-tabs" aria-label={t('범위별 메뉴', 'Scope menus')}>
                            {(isWardLinkRoute && context.data.configurationReady === false
                                ? [['links', t('병원 연결', 'Hospital linking')]]
                                : [
                                      ['usage', t('요금제·사용량', 'Plan & usage')],
                                      ['members', t('병동 관리자', 'Ward admins')],
                                      ['ai-batch', t('여러 팀 생성', 'Generate multiple teams')],
                                      ['billing', t('결제·증설', 'Billing')],
                                      ...(scope.role === 'OWNER' ? [['links', t('병원 연결', 'Hospital linking')]] : []),
                                      ['support', t('지원', 'Support')],
                                  ]
                            ).map(([key, label]) => (
                                <Link aria-current={tab === key ? 'page' : undefined} key={key} to={scopePath(scope, key)}>
                                    {label}
                                </Link>
                            ))}
                            {scope.type === 'WARD' ? (
                                <button
                                    className="secondary"
                                    disabled={action.busy}
                                    onClick={() => void action.run(() => switchScope(scope, true))}
                                >
                                    {t('근무표 서비스 열기', 'Open scheduling')}
                                </button>
                            ) : null}
                        </nav>
                    ) : null}
                    {isWardLinkRoute ? (
                        ownedWardLinkScope ? (
                            <WardLinksPanel scope={ownedWardLinkScope} />
                        ) : (
                            <Section title={t('병원 연결', 'Hospital connections')}>
                                <Notice>
                                    {t(
                                        '이 병동의 최고 관리자만 연결 요청을 확인할 수 있습니다.',
                                        'Only this ward’s owner can review connection requests.',
                                    )}
                                </Notice>
                            </Section>
                        )
                    ) : entitlement.data ? (
                        scope.type === 'HOSPITAL' && tab === 'billing' ? (
                            <HospitalBilling key={scope.scopeId} scope={scope} e={entitlement.data} />
                        ) : tab === 'ai-batch' && scope.type === 'WARD' ? (
                            <AiBatchPanel scope={scope} e={entitlement.data} />
                        ) : tab === 'members' ? (
                            scope.type === 'HOSPITAL' ? (
                                <HospitalMembersPanel key={scope.scopeId} scope={scope} entitlement={entitlement.data} />
                            ) : (
                                <MembersPanel key={scope.scopeId} scope={scope} e={entitlement.data} />
                            )
                        ) : tab === 'billing' && (scope.type === 'WARD' || scope.role === 'OWNER') ? (
                            <BillingPanel key={scope.scopeId} scope={scope} e={entitlement.data} />
                        ) : tab === 'overview' && scope.type === 'HOSPITAL' ? (
                            <HospitalOverview scope={scope} />
                        ) : tab === 'support' ? (
                            <>
                                <Section title={t('도입·운영 지원 요청', 'Implementation & support')}>
                                    <RequestForm scope={scope} kind="SUPPORT" />
                                    {scope.role === 'OWNER' ? <SupportBillingPanel scope={scope} /> : null}
                                    {scope.type === 'WARD' && scope.role === 'OWNER' ? <SupportConsentPanel scope={scope} /> : null}
                                </Section>
                                {scope.role === 'OWNER' ? (
                                    <HospitalDisclosure
                                        active={scope.type === 'HOSPITAL'}
                                        title={t('병원 이용 종료', 'Close hospital workspace')}
                                    >
                                        <Section title={t('범위 종료·보관 요청', 'Request closure & archive')}>
                                            <Notice>
                                                {t(
                                                    '종료 시 미수·환불·연결을 확인한 뒤 보관합니다. 기존 자료를 즉시 삭제하지 않습니다.',
                                                    'Outstanding invoices, refunds and links are reviewed before archiving. Existing data is preserved.',
                                                )}
                                            </Notice>
                                            <RequestForm scope={scope} kind="CLOSURE" />
                                        </Section>
                                    </HospitalDisclosure>
                                ) : null}
                            </>
                        ) : (
                            <UsagePanel scope={scope} e={entitlement.data} />
                        )
                    ) : entitlement.isPending ? (
                        <p role="status">{t('관리 정보를 불러오는 중입니다.', 'Loading workspace…')}</p>
                    ) : (
                        <ErrorView error={entitlement.error} />
                    )}
                </>
            ) : isWardLinkRoute ? (
                <Section title={t('병원 연결', 'Hospital connections')}>
                    <Notice>
                        {t(
                            '이 병동의 최고 관리자만 연결 요청을 확인할 수 있습니다.',
                            'Only this ward’s owner can review connection requests.',
                        )}
                    </Notice>
                </Section>
            ) : mode === 'HOSPITAL' ? (
                <HospitalChooser />
            ) : (
                <Navigate to="/workspace" replace />
            )}
        </ContentTag>
    );

    return scope?.type === 'HOSPITAL' ? (
        <HospitalWorkspaceShell
            scope={scope}
            scopes={context.data?.enabled && !context.isError ? context.data.scopes : []}
            tab={tab}
            accountId={accountId}
            accountName={accountMe?.name ?? ''}
            pendingCount={pendingCount}
            busy={action.busy}
            onSwitch={(next) => void action.run(() => switchScope(next))}
        >
            {content}
        </HospitalWorkspaceShell>
    ) : (
        <div className="workspace-app">
            <header className="workspace-header">
                <Link to="/workspace" className="workspace-brand">
                    <img src={logoWordmarkPurple} alt="dutying" width="119" height="33" />
                </Link>
                <nav aria-label={t('관리 메뉴', 'Workspace navigation')}>
                    <Link to="/workspace/plans">{t('요금제 비교', 'Compare plans')}</Link>
                    <Link to="/workspace/notices">{t('알림', 'Notices')}</Link>
                    <Link to={ROUTE.PROFILE}>{t('내 계정', 'My account')}</Link>
                    <Link to="/workspace">{t('병원·병동 전환', 'Switch workspace')}</Link>
                </nav>
            </header>
            {content}
        </div>
    );
}
