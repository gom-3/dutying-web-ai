import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useEffect, useId, useRef, useState, type ReactNode} from 'react';
import {Link, Navigate, useLocation, useNavigate} from 'react-router';
import useAuth from '@/features/auth';
import useAuthStore from '@/features/auth/model/store';
import {aiFillUsage} from '@/features/commercial/ai-fill-usage';
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
    getOnlyWardScope,
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
import {wardBillingPath} from '@/features/commercial/ward-billing-path';
import {getOwnedWardLinkScope} from '@/features/commercial/ward-links';
import {RefundConditions, SubscriptionConditions, fetchPublicOffer} from '@/pages/subscription-info';
import {WardAPI} from '@/shared/api';
import {sellerReady, SUBSCRIPTION_TERMS_VERSION} from '@/shared/business/profile';
import ROUTE from '@/shared/constant/path';
import {HospitalBilling} from './hospital-billing';
import {HospitalMembersPanel} from './hospital-members';
import {HospitalOverview} from './hospital-overview';
import {HospitalWorkspaceShell} from './hospital-workspace-shell';
import {InfoTip} from './info-tip';
import {PlusAddons} from './plus-addons';
import {
    PlusCheckoutConsent,
    PlusCheckoutPlan,
    PlusCheckoutPolicyChevron,
    PlusCheckoutProgress,
    PlusCheckoutReviewSummary,
    PlusCheckoutTermsLinks,
} from './plus-checkout';
import {PlusSubscriptionCancellation, PlusSubscriptionOverview} from './plus-subscription';
import {Reauthenticate} from './reauthentication';
import {WardLinksPanel} from './ward-links-panel';
import {WardPaymentHistory} from './ward-payment-history';
import {WorkspaceActivity, countWorkspaceRequests} from './workspace-activity';
import {WorkspaceHome} from './workspace-home';
import {WorkspacePersonalShell, type TPersonalWorkspacePage} from './workspace-personal-shell';
import {Plans} from './workspace-plans';
import {Receipts} from './workspace-receipts';
import {WorkspaceShell} from './workspace-shell';
import {Section, Field, Notice, ErrorView, useAction, ActionsFeedback, useCopy} from './workspace-ui';
import './workspace-management.css';
import './hospital-secondary.css';
import './ward-workspace.css';

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
const isPendingPayment = (order: Order) => ['AWAITING_PAYMENT', 'PROCESSING', 'UNKNOWN', 'PAID_PENDING_APPLICATION'].includes(order.status);
const isUnsubmittedPayment = (order: Order) =>
    order.status === 'AWAITING_PAYMENT' && !order.provider && !order.providerReference && !order.verifiedAt;

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

export function UsagePanel({scope, e, billingPath}: {scope: Scope; e: Entitlement; billingPath?: string}) {
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
                title={t('현재 요금제와 한도', 'Current plan and limits')}
                actions={
                    <span className="hospital-current-plan">
                        {e.plan === 'HOSPITAL' ? t('병원 계약', 'Hospital contract') : e.plan}
                        {e.entitlementSource === 'EVENT' ? t(' · 무료 이벤트', ' · Trial') : ''}
                    </span>
                }
            >
                {e.plan === 'HOSPITAL' ? (
                    <p>
                        {t(
                            '편성 인원과 AI 횟수는 병원에 연결된 병동이 함께 사용해요.',
                            'Linked wards share the hospital’s staff capacity and AI allowance.',
                        )}
                    </p>
                ) : null}
                <div className="workspace-stats">
                    <div>
                        <strong>
                            {e.capacity.used} / {e.capacity.purchased}
                        </strong>
                        <span>{t('활성 편성 인원 / 한도', 'Active scheduling staff / limit')}</span>
                    </div>
                    <div>
                        <strong>
                            {e.adminSeats.active} + {e.adminSeats.reserved} /{' '}
                            {e.restrictionStates?.ADMIN_SEATS === false ? t('제한 해제', 'No plan limit') : e.adminSeats.limit}
                        </strong>
                        <span>{t('관리자 + 대기 초대 / 정원', 'Admins + pending invitations / seats')}</span>
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
                    {[aiFillUsage(e)]
                        .filter((u) => u !== undefined)
                        .map((u) => (
                            <article className="workspace-usage" key={u.meter}>
                                <div className="workspace-heading-label">
                                    <h3>{t('AI 채우기', 'AI fill')}</h3>
                                    {scope.type === 'HOSPITAL' && u.lots.length ? (
                                        <InfoTip label={`${t('AI 채우기', 'AI fill')} ${t('제공량 내역', 'allowance details')}`}>
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
                                    <meter
                                        min={0}
                                        max={Math.max(u.granted, 1)}
                                        value={u.remaining}
                                        aria-label={t('남은 AI 채우기 횟수', 'AI fill uses remaining')}
                                    />
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
                            '채우기와 수정 요청은 같은 AI 채우기 횟수를 사용합니다. 적용할 결과가 없거나 확정된 실패에는 차감하지 않습니다.',
                            'Filling and revision requests share one AI fill allowance. No applicable result or a confirmed failure does not consume a use.',
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
                    to={billingPath ?? scopePath(scope, scope.type === 'HOSPITAL' && !e.canManageBilling ? 'support' : 'billing')}
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
                        {t('일마다 AI 채우기', ' days: AI fill')} {c.generate}
                        {t('회', ' uses')}
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
                            {result.estimate.generate}
                            {t('회', ' uses')}
                        </strong>
                        <span>{t('매월 AI 채우기', 'Monthly AI fill uses')}</span>
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

export function BillingPanel({
    scope,
    e,
    cardRegistrationVersion = 1,
    paymentReturnPath = '/workspace/payment-return',
    embedded = false,
}: {
    scope: Scope;
    e: Entitlement;
    cardRegistrationVersion?: number;
    paymentReturnPath?: string;
    embedded?: boolean;
}) {
    const t = useCopy();
    const action = useAction();
    const accountId = useAuthStore((s) => s.accountId);
    const data = useQuery({
        queryKey: commercialQueryKey(accountId, scope.type, scope.ref, 'billing'),
        queryFn: () => commercialGet<Billing>(`/billing-scopes/${scope.scopeId}`),
        enabled: e.canManageBilling,
    });
    const refundableInvoices =
        data.data?.invoices.filter((invoice) => invoice.status !== 'VOID' && invoice.allocated > invoice.refundedGross) ?? [];
    const canRequestRefund = scope.type === 'HOSPITAL' || refundableInvoices.length > 0;
    const refundRequests = data.data?.requests.filter((request) => scope.type === 'HOSPITAL' || request.kind === 'REFUND') ?? [];
    const plans = useQuery({
        queryKey: commercialQueryKey(accountId, 'plans'),
        queryFn: () => commercialGet<{id: string; config: Policy | null; configured?: boolean}[]>('/plans'),
        staleTime: 0,
        refetchOnWindowFocus: 'always',
    });
    const publicOffer = useQuery({queryKey: ['public-plus-offer'], queryFn: fetchPublicOffer, retry: false});
    const activeSubscription = scope.type === 'WARD' && e.plan === 'PLUS' && e.entitlementSource === 'SUBSCRIPTION';
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
    const cardSubscription = scope.type === 'WARD' && purpose === 'SUBSCRIPTION';
    const [capacity, setCapacity] = useState<number>();
    const minimumCapacity = Math.max(1, planPricing?.includedStaff ?? 1, e.capacity.used);
    const currentContractCapacity = data.data?.customer?.capacity ?? e.capacity.purchased;
    const [renewalCapacity, setRenewalCapacity] = useState<string>();
    const renewalCapacityText =
        renewalCapacity ?? String(data.data?.scope.nextCapacity ?? data.data?.customer?.capacity ?? e.capacity.purchased);
    const validRenewalCapacity =
        /^\d+$/.test(renewalCapacityText) &&
        Number.isSafeInteger(Number(renewalCapacityText)) &&
        Number(renewalCapacityText) >= minimumCapacity &&
        Number(renewalCapacityText) < currentContractCapacity &&
        Number(renewalCapacityText) <= 10000;
    const [subscriptionCapacity, setSubscriptionCapacity] = useState<string>();
    const capacityErrorId = useId();
    const draftCapacity = capacity ?? Math.max(minimumCapacity, e.capacity.purchased);
    const subscriptionCapacityText = subscriptionCapacity ?? String(draftCapacity);
    const subscriptionCapacityValue = Number(subscriptionCapacityText);
    const validSubscriptionCapacity =
        /^\d+$/.test(subscriptionCapacityText) &&
        Number.isSafeInteger(subscriptionCapacityValue) &&
        subscriptionCapacityValue <= 10000 &&
        minimumCapacity <= 10000;
    const invalidSubscriptionCapacity = cardSubscription && subscriptionCapacityText !== '' && !validSubscriptionCapacity;
    const quoteCapacity = Math.max(minimumCapacity, cardSubscription ? subscriptionCapacityValue : draftCapacity);
    const subscriptionUnavailable = purpose === 'SUBSCRIPTION' && !planPricing;
    const [full, setFull] = useState(0);
    const [setup, setSetup] = useState(50);
    const [manualQuote, setQuote] = useState<Quote>();
    const [pendingPayment, setPendingPayment] = useState<Order>();
    const unresolvedPayment =
        data.data?.orders.find((order) => isPendingPayment(order) && !isUnsubmittedPayment(order)) ??
        (pendingPayment && !isUnsubmittedPayment(pendingPayment) ? pendingPayment : undefined);
    const [acceptedConsent, setConsent] = useState(false);
    const [consentQuote, setConsentQuote] = useState<string>();
    const [trialLoss, setTrialLoss] = useState(false);
    const [trialQuote, setTrialQuote] = useState<string>();
    const [billingProof, setBillingProof] = useState('');
    const emailVerificationRequired = !(cardRegistrationVersion >= 2);
    const [debouncedCapacityText, setDebouncedCapacityText] = useState(subscriptionCapacityText);
    const debouncedCapacity = Math.max(minimumCapacity, Number(debouncedCapacityText));

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedCapacityText(subscriptionCapacityText), 300);

        return () => clearTimeout(timer);
    }, [subscriptionCapacityText]);

    const automaticQuote = useQuery({
        queryKey: commercialQueryKey(
            accountId,
            scope.type,
            scope.ref,
            'subscription-quote',
            debouncedCapacity,
            planPricing,
            data.data?.scope.version,
        ),
        queryFn: async () => {
            const q = await commercialPost<Quote>(`/billing-scopes/${scope.scopeId}/quotes`, {
                purpose: 'SUBSCRIPTION',
                plan: 'PLUS',
                capacity: debouncedCapacity,
                setupStaff: 0,
                fullPacks: 0,
                partialPacks: 0,
            });
            const snapshot = parseQuoteTerms(q.snapshot);

            if (
                !snapshot ||
                typeof q.id !== 'string' ||
                !q.id.trim() ||
                typeof q.contentHash !== 'string' ||
                !q.contentHash.trim() ||
                q.scopeId !== scope.scopeId ||
                snapshot.request?.purpose !== 'SUBSCRIPTION' ||
                snapshot.request?.plan !== 'PLUS' ||
                snapshot.request?.capacity !== debouncedCapacity
            )
                throw new Error(t('견적 정보를 확인하지 못했습니다. 다시 불러와 주세요.', 'Unable to verify the quote. Please try again.'));

            if (typeof q.expiresAt !== 'string' || !(quoteTimestamp(q.expiresAt) > Date.now()))
                throw new Error(t('금액 확인 유효시간이 지났습니다. 다시 불러와 주세요.', 'This quote has expired. Please try again.'));

            return q;
        },
        enabled:
            cardSubscription &&
            !activeSubscription &&
            e.canManageBilling &&
            !!planPricing &&
            data.isSuccess &&
            !!data.data &&
            validSubscriptionCapacity &&
            debouncedCapacityText === subscriptionCapacityText &&
            debouncedCapacity === quoteCapacity &&
            !action.busy,
        retry: false,
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: false,
        refetchInterval: (query) =>
            query.state.status === 'success' && query.state.data
                ? Math.max(1000, Math.min(quoteTimestamp(query.state.data.expiresAt) - Date.now() + 100, 2147483647))
                : false,
    });
    const quote = cardSubscription
        ? validSubscriptionCapacity &&
          debouncedCapacityText === subscriptionCapacityText &&
          debouncedCapacity === quoteCapacity &&
          !automaticQuote.isFetching &&
          !automaticQuote.isError &&
          !data.isError
            ? automaticQuote.data
            : undefined
        : manualQuote;
    const quoteIdentity = quote ? `${quote.id}:${quote.contentHash}` : undefined;
    const consent = cardSubscription ? acceptedConsent && !!quoteIdentity && consentQuote === quoteIdentity : acceptedConsent;
    const trialLossAccepted = trialLoss && (!cardSubscription || (!!quoteIdentity && trialQuote === quoteIdentity));
    const [now, setNow] = useState(Date.now);
    const terms: QuoteTerms | undefined = quote ? parseQuoteTerms(quote.snapshot) : undefined;
    const quoteExpired = !!quote && !(quoteTimestamp(quote.expiresAt) > now);
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

    const refreshPendingPayment = async () => {
        const refreshed = await data.refetch();

        if (refreshed.isSuccess) {
            const pending = refreshed.data.orders.filter(isPendingPayment);

            setPendingPayment(pending.find((order) => !isUnsubmittedPayment(order)) ?? pending[0]);
        }
    };
    const prepareCardRegistration = async () => {
        let attemptedAbandon = false;

        setPendingPayment(undefined);

        try {
            const currentBilling = await data.refetch({throwOnError: true});

            if (!currentBilling.data) throw new Error(t('결제 내역을 다시 확인해 주세요.', 'Please check your payment history again.'));

            const pending = currentBilling.data.orders.filter(isPendingPayment);
            const reconciling = pending.find((order) => !isUnsubmittedPayment(order));

            if (reconciling) {
                setPendingPayment(reconciling);
                throw new Error(
                    t(
                        '결제 결과를 확인 중입니다. 기존 결제 상태를 확인해 주세요.',
                        'A payment result is still pending. Check the existing payment status.',
                    ),
                );
            }

            for (const order of pending) {
                setPendingPayment(order);
                attemptedAbandon = true;

                // The server rechecks the payment state under its ledger lock.
                const abandoned = await commercialPost<Order>(`/orders/${encodeURIComponent(order.id)}/abandon`);

                if (abandoned.status !== 'FAILED')
                    throw new Error(t('기존 결제 상태를 확인해 주세요.', 'Check the existing payment status.'));
            }

            setPendingPayment(undefined);
        } finally {
            if (attemptedAbandon) await refreshPendingPayment();
        }
    };
    const review = async () => {
        if (subscriptionUnavailable) return;

        setConsent(false);
        setTrialLoss(false);

        try {
            const payload: QuoteRequest = {
                purpose,
                plan: targetPlan,
                capacity: purpose === 'USAGE_PACK' || purpose === 'SETUP' ? e.capacity.purchased : quoteCapacity,
                setupStaff: purpose === 'SETUP' ? setup : 0,
                fullPacks: purpose === 'USAGE_PACK' ? full : 0,
                partialPacks: 0,
            };
            const q = await commercialPost<Quote>(`/billing-scopes/${scope.scopeId}/quotes`, payload);

            if (!parseQuoteTerms(q.snapshot))
                throw new Error(
                    t(
                        '견적 정보를 확인하지 못했습니다. 정확한 금액을 다시 확인해 주세요.',
                        'Unable to verify the quote. Request a new quote.',
                    ),
                );

            setQuote(q);

            return q;
        } catch (error) {
            setQuote(undefined);
            throw error;
        }
    };

    if (!e.canManageBilling)
        return (
            <Section title={t('최고 관리자에게 요청하기', 'Request from your owner')}>
                <Notice>
                    {e.plan === 'HOSPITAL' && e.billingScopeId !== scope.scopeId
                        ? t(
                              '이 병동은 병원 계약을 사용하고 있어요. 편성 인원을 늘리려면 병원 최고 관리자에게 요청하세요.',
                              'This ward uses the hospital contract. Ask the hospital owner to increase the scheduling capacity.',
                          )
                        : t(
                              '병동 최고 관리자가 구독과 결제를 관리해요. 편성 인원을 늘려야 한다면 아래에서 요청하세요.',
                              'The ward owner manages the subscription and payments. Request more scheduling capacity below.',
                          )}
                </Notice>
                <RequestForm scope={scope} />
            </Section>
        );

    const refundSupport =
        data.data && (canRequestRefund || refundRequests.length > 0) ? (
            <Section title={t('환불·정산 문의', 'Refund & billing support')}>
                {canRequestRefund ? (
                    <RequestForm
                        scope={scope}
                        kind="REFUND"
                        invoices={scope.type === 'HOSPITAL' ? data.data.invoices : refundableInvoices}
                    />
                ) : null}
                {refundRequests.map((r) => (
                    <p key={r.id}>
                        {r.kind} · {r.status} · {r.resolution ?? date(r.createdAt)}
                    </p>
                ))}
            </Section>
        ) : null;

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
                            <Link to={`${paymentReturnPath}?orderId=${encodeURIComponent(o.id)}`}>
                                {money(o.gross)} · {paymentStatusLabel(o.status, t)}
                            </Link>
                        </p>
                    ))}
                </Section>
            ) : null}
            {activeSubscription && data.data ? (
                <PlusSubscriptionOverview billing={data.data} entitlement={e}>
                    <PaymentMethodPanel
                        scope={scope}
                        emailVerificationRequired={emailVerificationRequired}
                        cancelAtPeriodEnd={data.data.scope.cancelAtPeriodEnd}
                    />
                    {currentContractCapacity > minimumCapacity ? (
                        <details className="plus-subscription__settings">
                            <summary>{t('인원 줄이기', 'Reduce staff capacity')}</summary>
                            <div>
                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();

                                        if (!validRenewalCapacity) return;

                                        void action.run(() =>
                                            commercialPost(`/billing-scopes/${scope.scopeId}/capacity-reservation`, {
                                                capacity: Number(renewalCapacityText),
                                                expectedVersion: data.data!.scope.version,
                                            }),
                                        );
                                    }}
                                >
                                    <Field
                                        label={t('다음 갱신 때 줄일 총 인원', 'Lower capacity at next renewal')}
                                        suffix={t('명', 'staff')}
                                    >
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]+"
                                            required
                                            value={renewalCapacityText}
                                            onChange={(event) => setRenewalCapacity(event.target.value)}
                                        />
                                    </Field>
                                    <button className="secondary" disabled={action.busy || !validRenewalCapacity}>
                                        {t('다음 주기 감원 예약', 'Schedule decrease')}
                                    </button>
                                </form>
                                <ActionsFeedback action={action} />
                            </div>
                        </details>
                    ) : null}
                </PlusSubscriptionOverview>
            ) : null}
            {activeSubscription ? (
                <PlusAddons scope={scope} entitlement={e} billing={data.data} />
            ) : (
                <HospitalDisclosure
                    active={scope.type === 'HOSPITAL' || activeSubscription}
                    title={
                        embedded && activeSubscription ? t('추가 이용 문의', 'Additional usage') : t('요금제와 추가 구매', 'Plan & add-ons')
                    }
                    help={
                        scope.type === 'HOSPITAL'
                            ? t(
                                  'Hospital은 계약 병원의 여러 병동을 함께 관리합니다. 관리자 정원과 편성 인원은 별도로 계산합니다.',
                                  'Hospital covers multiple contracted wards. Administrator seats and scheduling staff are counted separately.',
                              )
                            : undefined
                    }
                >
                    <Section
                        title={cardSubscription ? t('Plus 요금제', 'Plus plan') : t('요금제와 추가 구매', 'Plan & add-ons')}
                        className={cardSubscription ? 'plus-checkout' : ''}
                        help={
                            scope.type === 'HOSPITAL'
                                ? t(
                                      'Hospital은 계약 병원의 여러 병동을 함께 관리합니다. 관리자 정원과 편성 인원은 별도로 계산합니다.',
                                      'Hospital covers multiple contracted wards. Administrator seats and scheduling staff are counted separately.',
                                  )
                                : undefined
                        }
                    >
                        {cardSubscription ? <PlusCheckoutProgress emailVerificationRequired={emailVerificationRequired} /> : null}
                        {!cardSubscription && scope.type === 'WARD' && !activeSubscription ? (
                            <p>
                                {t(
                                    'Plus는 병동 하나, Hospital은 계약 병원의 여러 병동을 함께 관리합니다. 로그인 관리자 수와 편성 인원은 서로 다릅니다.',
                                    'Plus covers one ward. Hospital coordinates multiple contracted wards. Administrator seats and scheduling staff are separate.',
                                )}
                            </p>
                        ) : null}
                        {!cardSubscription ? (
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
                        ) : null}
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
                        {!cardSubscription ? (
                            <Notice>
                                {scope.type === 'HOSPITAL'
                                    ? t(
                                          'Hospital은 개별 계약·계좌이체로 진행합니다.',
                                          'Hospital uses individual contracts and bank transfers.',
                                      )
                                    : t(
                                          '현재 카드 결제는 Plus 월 구독만 지원합니다. Hospital은 개별 계약·계좌이체로 진행하며, 추가 횟수·중도 증원은 고객센터에 문의해 주세요.',
                                          'Card billing currently supports Plus monthly subscriptions. Contact support for Hospital contracts, add-ons or mid-cycle capacity changes.',
                                      )}
                            </Notice>
                        ) : null}
                        <div className={cardSubscription ? 'plus-checkout-start is-combined' : undefined}>
                            {cardSubscription ? <PlusCheckoutPlan compact pricing={planPricing} scopeName={scope.name} /> : null}
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();

                                    if (!cardSubscription) void action.run(review);
                                }}
                                className={cardSubscription ? 'plus-checkout-form' : 'workspace-form-grid'}
                            >
                                {!cardSubscription ? (
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
                                ) : null}
                                {purpose === 'USAGE_PACK' ? (
                                    <>
                                        <Field
                                            label={`${t('AI 채우기', 'AI fill')} ${e.policy.generatePackSize}${t('회 묶음', '-use pack')} · ${money(e.policy.generatePackGross)}`}
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
                                    <>
                                        <Field
                                            label={
                                                cardSubscription
                                                    ? t(
                                                          '근무표에 포함할 인원을 입력하세요',
                                                          'Enter the number of staff to include in the schedule',
                                                      )
                                                    : t('변경 후 총 편성 인원', 'Total staff after change')
                                            }
                                            suffix={cardSubscription ? t('명', 'staff') : undefined}
                                        >
                                            <input
                                                type={cardSubscription ? 'text' : 'number'}
                                                inputMode={cardSubscription ? 'numeric' : undefined}
                                                placeholder={cardSubscription ? t('인원수를 입력하세요', 'Enter staff count') : undefined}
                                                pattern={cardSubscription ? '[0-9]*' : undefined}
                                                required={cardSubscription}
                                                maxLength={cardSubscription ? 5 : undefined}
                                                min={cardSubscription ? undefined : minimumCapacity}
                                                max={cardSubscription ? undefined : 10000}
                                                value={cardSubscription ? subscriptionCapacityText : draftCapacity}
                                                disabled={cardSubscription && action.busy}
                                                aria-invalid={invalidSubscriptionCapacity || undefined}
                                                aria-describedby={invalidSubscriptionCapacity ? capacityErrorId : undefined}
                                                onChange={(event) => {
                                                    if (cardSubscription) setSubscriptionCapacity(event.target.value);
                                                    else setCapacity(Number(event.target.value));

                                                    setQuote(undefined);
                                                    setConsent(false);
                                                    setTrialLoss(false);
                                                }}
                                            />
                                        </Field>
                                        {invalidSubscriptionCapacity ? (
                                            <p id={capacityErrorId} className="workspace-error" role="alert">
                                                {t('0~10,000 사이의 숫자만 입력해 주세요.', 'Enter a whole number from 0 to 10,000.')}
                                            </p>
                                        ) : null}
                                    </>
                                )}
                                {!cardSubscription ? (
                                    <button disabled={action.busy || subscriptionUnavailable}>
                                        {action.busy ? t('확인 중…', 'Checking…') : t('정확한 금액 확인', 'Review exact quote')}
                                    </button>
                                ) : null}
                            </form>
                        </div>
                        {cardSubscription || (quote && terms) ? (
                            <div
                                className={cardSubscription ? 'workspace-review plus-checkout-review' : 'workspace-review'}
                                aria-live={cardSubscription ? undefined : 'polite'}
                            >
                                {!cardSubscription ? (
                                    <h3>
                                        {scope.name} · {t('결제 전 확인', 'Review before paying')}
                                    </h3>
                                ) : null}
                                {cardSubscription ? (
                                    quote && terms ? (
                                        <div aria-live="polite">
                                            <PlusCheckoutReviewSummary terms={terms} expiresAt={quote.expiresAt} />
                                        </div>
                                    ) : automaticQuote.isError || data.isError ? (
                                        <div>
                                            <ErrorView
                                                error={
                                                    (automaticQuote.error ?? data.error) === action.error
                                                        ? undefined
                                                        : (automaticQuote.error ?? data.error)
                                                }
                                            />
                                            <button
                                                type="button"
                                                className="secondary"
                                                disabled={
                                                    action.busy ||
                                                    (!data.isError &&
                                                        (!validSubscriptionCapacity ||
                                                            debouncedCapacityText !== subscriptionCapacityText ||
                                                            subscriptionUnavailable))
                                                }
                                                onClick={() => {
                                                    if (data.isError) void action.run(() => data.refetch({throwOnError: true}));
                                                    else if (
                                                        validSubscriptionCapacity &&
                                                        debouncedCapacityText === subscriptionCapacityText &&
                                                        !subscriptionUnavailable &&
                                                        !action.busy
                                                    )
                                                        void automaticQuote.refetch();
                                                }}
                                            >
                                                {t('다시 불러오기', 'Try again')}
                                            </button>
                                        </div>
                                    ) : !subscriptionUnavailable && validSubscriptionCapacity ? (
                                        <p className="plus-checkout-caption" role="status">
                                            {t('금액 확인 중…', 'Checking amount…')}
                                        </p>
                                    ) : null
                                ) : quote && terms ? (
                                    <>
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
                                        <dl>
                                            <dt>{t('부가세 내역', 'Tax breakdown')}</dt>
                                            <dd>
                                                {t('공급가액', 'Net')} {money(terms.supplyAmount)} + VAT {money(terms.taxAmount)}
                                            </dd>
                                            <dt>{t('이용기간', 'Service period')}</dt>
                                            <dd>
                                                {date(terms.periodStart)} ~ {date(terms.periodEnd)} (KST)
                                            </dd>
                                            <dt>{t('이번 제공량', 'Included uses')}</dt>
                                            <dd>
                                                {t('AI 채우기', 'AI fill')} {terms.fullUnits}
                                            </dd>
                                            <dt>{t('금액 확인 유효시간', 'Amount valid until')}</dt>
                                            <dd>{date(quote.expiresAt)}</dd>
                                        </dl>
                                    </>
                                ) : null}
                                {quoteExpired ? (
                                    <p className="workspace-error" role="alert">
                                        {cardSubscription
                                            ? t('금액을 갱신하고 있습니다.', 'Updating the amount.')
                                            : t(
                                                  '확인한 금액의 유효시간이 지났습니다. 위의 ‘결제 금액 다시 확인’을 눌러 주세요.',
                                                  'This quote has expired. Request a new quote.',
                                              )}
                                    </p>
                                ) : null}
                                {!cardSubscription ? (
                                    <Notice>
                                        {t(
                                            '기본 횟수는 해당 주기까지, 추가 구매 횟수는 구매일부터 365일입니다. 두 종류의 횟수는 서로 전환되지 않습니다. 구독 해지는 기간 말에 적용하며 기존 자료는 유지됩니다.',
                                            'Included uses expire at the cycle end. Purchased uses last 365 days and cannot be converted between meters. Cancellation takes effect at period end; existing data is preserved.',
                                        )}
                                    </Notice>
                                ) : (
                                    <>
                                        <div className="plus-checkout-policies">
                                            <details className="plus-checkout-legal">
                                                <summary className="plus-checkout-policy-row">
                                                    <span>{t('정기결제·해지 안내', 'Subscription and cancellation terms')}</span>
                                                    <PlusCheckoutPolicyChevron />
                                                </summary>
                                                <div>
                                                    <SubscriptionConditions />
                                                </div>
                                            </details>
                                            <details className="plus-checkout-legal">
                                                <summary className="plus-checkout-policy-row">
                                                    <span>{t('환불정책', 'Refund policy')}</span>
                                                    <PlusCheckoutPolicyChevron />
                                                </summary>
                                                <div>
                                                    <RefundConditions />
                                                </div>
                                            </details>
                                            <PlusCheckoutTermsLinks />
                                        </div>
                                        {emailVerificationRequired ? <Reauthenticate onVerified={setBillingProof} /> : null}
                                    </>
                                )}
                                {scope.type === 'WARD' ? (
                                    <>
                                        {cardSubscription ? (
                                            <PlusCheckoutConsent
                                                checked={consent}
                                                disabled={!quote || quoteExpired || action.busy}
                                                onChange={(checked) => {
                                                    setConsent(checked);
                                                    setConsentQuote(checked ? quoteIdentity : undefined);
                                                }}
                                            />
                                        ) : (
                                            <label className="workspace-check">
                                                <input
                                                    type="checkbox"
                                                    checked={consent}
                                                    onChange={(event) => setConsent(event.target.checked)}
                                                />
                                                <span>
                                                    {t('금액·대상·기간 및', 'I agree to the amount, scope, period and')}{' '}
                                                    <Link to="/subscription-terms" target="_blank">
                                                        {t('정기결제 약관', 'subscription terms')}
                                                    </Link>{' '}
                                                    ·{' '}
                                                    <Link to="/refund" target="_blank">
                                                        {t('환불 조건', 'refund policy')}
                                                    </Link>
                                                    {t(
                                                        '에 동의하며 매월 자동결제를 신청합니다.',
                                                        ' and authorize monthly automatic payments.',
                                                    )}
                                                </span>
                                            </label>
                                        )}
                                        {e.entitlementSource === 'EVENT' ? (
                                            <label className="workspace-check">
                                                <input
                                                    type="checkbox"
                                                    checked={trialLossAccepted}
                                                    disabled={cardSubscription && (!quote || quoteExpired || action.busy)}
                                                    onChange={(event) => {
                                                        setTrialLoss(event.target.checked);
                                                        setTrialQuote(event.target.checked ? quoteIdentity : undefined);
                                                    }}
                                                />
                                                <span>
                                                    {t(
                                                        '첫 결제 확정 시 남은 무료 이벤트 기간·제공량이 종료되는 데 동의합니다.',
                                                        'I agree that confirming the first payment ends the remaining trial period and allowances.',
                                                    )}
                                                </span>
                                            </label>
                                        ) : null}
                                        <button
                                            className={cardSubscription ? 'plus-checkout-primary' : undefined}
                                            disabled={
                                                !consent ||
                                                !quote ||
                                                !terms ||
                                                (emailVerificationRequired && !billingProof) ||
                                                !cardReady ||
                                                (cardSubscription && !!unresolvedPayment) ||
                                                action.busy ||
                                                !e.checkoutEnabled ||
                                                (e.entitlementSource === 'EVENT' && !trialLossAccepted)
                                            }
                                            onClick={() =>
                                                void action.run(async () => {
                                                    if (!quote || !terms || !consent) return;

                                                    let attemptedRegistration = false;

                                                    try {
                                                        if (cardSubscription) await prepareCardRegistration();

                                                        if (!(quoteTimestamp(quote.expiresAt) > Date.now())) {
                                                            setNow(Date.now());

                                                            if (cardSubscription) void automaticQuote.refetch();

                                                            throw new Error(
                                                                t(
                                                                    '금액을 다시 확인하고 동의해 주세요.',
                                                                    'Review the updated amount and agree again.',
                                                                ),
                                                            );
                                                        }

                                                        await loadToss();

                                                        if (!(quoteTimestamp(quote.expiresAt) > Date.now())) {
                                                            if (cardSubscription) void automaticQuote.refetch();

                                                            throw new Error(
                                                                t(
                                                                    '금액을 다시 확인하고 동의해 주세요.',
                                                                    'Review the updated amount and agree again.',
                                                                ),
                                                            );
                                                        }

                                                        const payload = {
                                                            quoteId: quote.id,
                                                            contentHash: quote.contentHash,
                                                            termsVersion: terms.termsVersion,
                                                            trialLossAccepted,
                                                        };
                                                        const keyName = `dutying:checkout:${quote.id}`;
                                                        const key = sessionStorage.getItem(keyName) ?? crypto.randomUUID();

                                                        sessionStorage.setItem(keyName, key);

                                                        attemptedRegistration = true;

                                                        const registration = await commercialPost<{
                                                            id: string;
                                                            orderId: string;
                                                            clientKey: string;
                                                            customerKey: string;
                                                            returnUrl: string;
                                                        }>(
                                                            `${emailVerificationRequired ? '' : '/v2'}/billing-scopes/${scope.scopeId}/subscription-checkout`,
                                                            emailVerificationRequired
                                                                ? {checkout: payload, reauthenticationToken: billingProof}
                                                                : {checkout: payload},
                                                            key,
                                                        );

                                                        await openTossBilling(registration);

                                                        return registration;
                                                    } catch (error) {
                                                        setQuote(undefined);
                                                        setConsent(false);
                                                        setTrialLoss(false);

                                                        if (cardSubscription && attemptedRegistration) await automaticQuote.refetch();

                                                        throw error;
                                                    } finally {
                                                        await refreshPendingPayment();
                                                    }
                                                })
                                            }
                                        >
                                            {t('동의하고 진행하기', 'Agree & continue')}
                                        </button>
                                        {cardSubscription && emailVerificationRequired && !billingProof ? (
                                            <p className="plus-checkout-next" role="status">
                                                {t(
                                                    '이메일 본인 확인을 완료한 후 약관에 동의해 주세요.',
                                                    'Verify your email, then agree to the terms.',
                                                )}
                                            </p>
                                        ) : null}
                                    </>
                                ) : null}
                                {!cardReady && (!cardSubscription || (quote && terms)) && (
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
                        <ActionsFeedback
                            action={{...action, error: scope.type === 'WARD' && unresolvedPayment ? undefined : action.error}}
                        />
                    </Section>
                </HospitalDisclosure>
            )}
            {data.data ? (
                <>
                    {scope.type === 'HOSPITAL' || (!activeSubscription && data.data.scope.periodEnd) ? (
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
                    ) : null}
                    {scope.type === 'WARD' ? (
                        <WardPaymentHistory billing={data.data} pendingOrder={unresolvedPayment} paymentReturnPath={paymentReturnPath} />
                    ) : null}
                    {!activeSubscription && refundSupport ? (
                        <HospitalDisclosure active={scope.type === 'HOSPITAL'} title={t('환불·정산 문의', 'Refund & billing support')}>
                            {refundSupport}
                        </HospitalDisclosure>
                    ) : null}
                </>
            ) : (
                <ErrorView error={cardSubscription ? undefined : data.error} />
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
            {activeSubscription && data.data ? (
                <div className="plus-subscription__footer-row">
                    {refundSupport ? (
                        <details className="plus-subscription__footer plus-subscription__support">
                            <summary className="plus-subscription__text-button">{t('환불·정산 문의', 'Refund & billing support')}</summary>
                            <div className="plus-subscription__support-content">{refundSupport}</div>
                        </details>
                    ) : null}
                    <PlusSubscriptionCancellation scope={scope} billing={data.data} />
                </div>
            ) : null}
        </>
    );
}

function MembersPanel({scope, e}: {scope: Scope; e: Entitlement}) {
    const t = useCopy();
    const memberAction = useAction();
    const invitationAction = useAction();
    const transferAction = useAction();
    const accountId = useAuthStore((s) => s.accountId);
    const [email, setEmail] = useState('');
    const [reauth, setReauth] = useState('');
    const [target, setTarget] = useState('');
    const [leave, setLeave] = useState(false);
    const adminPath = `/admin/wards/${scope.ref}`;
    const data = useQuery({
        queryKey: commercialQueryKey(accountId, scope.type, scope.ref, 'members'),
        queryFn: () => legacyGet<Members>(`${adminPath}/admins`),
    });
    const isOwner = scope.role === 'OWNER';
    const canInvite = isOwner && e.allowedActions.includes('WARD_INVITE_CREATE');
    const seatsFull = isAdminSeatLimitReached(e);
    const members = data.data?.members ?? [];
    const invitations = data.data?.invitations ?? [];
    const busy = memberAction.busy || invitationAction.busy || transferAction.busy;

    return (
        <>
            <Section title={t('관리자 목록', 'Administrators')}>
                <p>
                    {t(
                        '이 병동의 근무표와 설정을 관리할 수 있는 계정이에요.',
                        'These accounts can manage schedules and settings for this ward.',
                    )}
                </p>
                <p className="ward-workspace__seat-summary">
                    {t(
                        `참여 ${e.adminSeats.active}명 · 초대 대기 ${e.adminSeats.reserved}명`,
                        `${e.adminSeats.active} active · ${e.adminSeats.reserved} invited`,
                    )}
                    {e.restrictionStates?.ADMIN_SEATS === false
                        ? t(' · 정원 제한 해제', ' · No seat limit')
                        : t(` · 정원 ${e.adminSeats.limit}명`, ` · ${e.adminSeats.limit} seats`)}
                </p>
                {data.isPending ? <p role="status">{t('관리자 목록을 불러오는 중입니다.', 'Loading administrators…')}</p> : null}
                {data.isError ? (
                    <>
                        <ErrorView error={data.error} />
                        <button type="button" className="secondary" onClick={() => void data.refetch()}>
                            {t('다시 불러오기', 'Try again')}
                        </button>
                    </>
                ) : null}
                {data.isSuccess && !members.length ? <p>{t('표시할 관리자가 없습니다.', 'No administrators to display.')}</p> : null}
                {members.length ? (
                    <ul className="ward-workspace__member-list">
                        {members.map((m) => (
                            <li className="workspace-row" key={memberId(m)}>
                                <div>
                                    <strong>{m.name}</strong>
                                    <p>{[workspaceRoleLabel(m.role, t('ko', 'en') === 'ko'), m.email].filter(Boolean).join(' · ')}</p>
                                </div>
                                {isOwner && m.role !== 'OWNER' ? (
                                    <button
                                        type="button"
                                        className="secondary danger"
                                        disabled={busy}
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    t(
                                                        '이 관리자의 접근 권한을 제거할까요? 계정과 근무표는 유지됩니다.',
                                                        'Remove this administrator’s access? Their account and schedules are preserved.',
                                                    ),
                                                )
                                            )
                                                void memberAction.run(() => legacyDelete(`${adminPath}/admins/${memberId(m)}`));
                                        }}
                                    >
                                        {t('권한 제거', 'Remove access')}
                                    </button>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                ) : null}
                <ActionsFeedback action={memberAction} />
            </Section>
            <Section title={t('관리자 초대', 'Administrator invitations')}>
                {canInvite ? (
                    <>
                        <p>
                            {t(
                                '근무표를 함께 관리할 동료에게 초대 메일을 보내세요.',
                                'Send an email invitation to a colleague who will manage schedules with you.',
                            )}
                        </p>
                        <form
                            className="ward-workspace__invite"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void invitationAction.run(async () => {
                                    await legacyPost(`${adminPath}/admin-emails`, {email, role: 'EDITOR'});
                                    invitationAction.setNotice(
                                        t(
                                            '초대 메일을 발송 요청했습니다. 수락 후 참여합니다.',
                                            'Invitation requested. They join after accepting.',
                                        ),
                                    );
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
                            <button disabled={busy || seatsFull}>{t('초대 보내기', 'Send invitation')}</button>
                        </form>
                        {seatsFull ? (
                            <Notice>
                                {t(
                                    '관리자 정원이 찼어요. 대기 중인 초대도 정원에 포함돼요.',
                                    'All administrator seats are in use, including pending invitations.',
                                )}
                            </Notice>
                        ) : null}
                    </>
                ) : null}
                {data.isSuccess ? <h3>{t('대기 중인 초대', 'Pending invitations')}</h3> : null}
                {data.isSuccess && !invitations.length ? <p>{t('대기 중인 초대가 없어요.', 'There are no pending invitations.')}</p> : null}
                {data.data?.reservedEmails?.length ? (
                    <p className="workspace-muted">
                        {t('예약된 이메일', 'Reserved email addresses')} · {data.data.reservedEmails.map((r) => r.email).join(', ')}
                    </p>
                ) : null}
                {invitations.length ? (
                    <ul className="ward-workspace__member-list">
                        {invitations.map((i) => {
                            const id = i.id ?? i.invitationId;

                            return (
                                <li className="workspace-row" key={id}>
                                    <div>
                                        <strong>{i.email ?? i.invitedEmailNormalized ?? i.invitedEmail}</strong>
                                        <p>
                                            {t('만료', 'Expires')} {date(i.expiresAt)}
                                        </p>
                                    </div>
                                    {isOwner ? (
                                        <div className="workspace-actions">
                                            <button
                                                type="button"
                                                className="secondary"
                                                disabled={busy}
                                                onClick={() =>
                                                    void invitationAction.run(() =>
                                                        legacyPost(`${adminPath}/admin-invitations/${id}/resend`, {}),
                                                    )
                                                }
                                            >
                                                {t('재발송', 'Resend')}
                                            </button>
                                            <button
                                                type="button"
                                                className="secondary"
                                                disabled={busy}
                                                onClick={() =>
                                                    void invitationAction.run(() => legacyDelete(`${adminPath}/admin-invitations/${id}`))
                                                }
                                            >
                                                {t('초대 취소', 'Cancel invitation')}
                                            </button>
                                        </div>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                ) : null}
                <ActionsFeedback action={invitationAction} />
            </Section>
            {isOwner ? (
                <HospitalDisclosure active title={t('최고 관리자 인계', 'Transfer ownership')}>
                    <Section title={t('최고 관리자 인계', 'Transfer ownership')}>
                        <Notice>
                            {t(
                                '기존 관리자가 이메일로 본인 확인을 하고 수락하면 권한이 넘어가요. 결제 카드는 인계 대상에서 제외돼요.',
                                'Ownership changes when an existing administrator verifies their email and accepts. Payment cards are excluded from the transfer.',
                            )}
                        </Notice>
                        <Reauthenticate onVerified={setReauth} />
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                void transferAction.run(async () => {
                                    const r = await commercialPost(`/scopes/WARD/${scope.ref}/owner-transfers`, {
                                        targetAccountId: Number(target),
                                        leaveAfter: leave,
                                        reauthenticationToken: reauth,
                                    });

                                    transferAction.setNotice(
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
                                    {members
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
                            <button disabled={!reauth || busy}>{t('인계 요청', 'Request transfer')}</button>
                        </form>
                        <ActionsFeedback action={transferAction} />
                    </Section>
                </HospitalDisclosure>
            ) : scope.accessSource !== 'HOSPITAL' ? (
                <button
                    type="button"
                    className="secondary danger"
                    disabled={busy}
                    onClick={() => {
                        if (
                            window.confirm(
                                t(
                                    '이 병동에서 나갈까요? 다시 참여하려면 초대가 필요합니다.',
                                    'Leave this ward? You will need an invitation to return.',
                                ),
                            )
                        )
                            void memberAction.run(() => legacyDelete(`${adminPath}/quit`));
                    }}
                >
                    {t('이 범위에서 나가기', 'Leave this scope')}
                </button>
            ) : null}
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

export function PaymentReturn({backPath = '/workspace'}: {backPath?: string} = {}) {
    const t = useCopy();
    const action = useAction();
    const location = useLocation();
    const accountId = useAuthStore((s) => s.accountId);
    const context = useCommercialContext();
    const params = new URLSearchParams(location.search);
    const id = params.get('orderId');
    const paymentKey = useRef(params.get('paymentKey'));
    const query = useQuery({
        queryKey: commercialQueryKey(accountId, 'order', id),
        queryFn: () => commercialGet<Order>(`/orders/${encodeURIComponent(id!)}`),
        enabled: !!id,
        refetchInterval: (q) => (q.state.data && isPendingPayment(q.state.data) && !isUnsubmittedPayment(q.state.data) ? 5000 : false),
    });

    useEffect(() => {
        if (paymentKey.current) {
            const url = new URL(window.location.href);

            url.searchParams.delete('paymentKey');
            url.searchParams.delete('amount');
            window.history.replaceState(null, '', url.pathname + url.search);
        }
    }, []);

    const order = query.isSuccess ? query.data : undefined;
    const unsubmitted = !!order && isUnsubmittedPayment(order);
    const failed = order?.status === 'FAILED';
    const completed = !!order && ['APPLIED', 'PAID'].includes(order.status);
    const checking = !!order && isPendingPayment(order) && !unsubmitted;
    const restartScope =
        !context.isError && context.data?.enabled
            ? context.data.scopes.find((scope) => scope.type === 'WARD' && scope.scopeId === order?.scopeId && scope.role === 'OWNER')
            : undefined;
    const restart = (unsubmitted || failed) && restartScope ? wardBillingPath(restartScope.ref) : undefined;
    const title = unsubmitted
        ? t('아직 결제되지 않았어요', 'You have not been charged')
        : failed
          ? t('결제가 완료되지 않았어요', 'Payment did not complete')
          : completed
            ? t('결제가 완료됐어요', 'Payment complete')
            : checking
              ? order?.status === 'PAID_PENDING_APPLICATION'
                  ? t('이용권 적용 중이에요', 'Activating your subscription')
                  : t('결제 결과를 확인하고 있어요', 'Checking your payment')
              : t('결제 내역', 'Payment details');

    return (
        <Section title={title}>
            {id && query.isPending ? <p role="status">{t('불러오는 중…', 'Loading…')}</p> : null}
            {!id ? <p>{t('결제 내역을 찾을 수 없어요.', 'Payment details could not be found.')}</p> : null}
            {order ? (
                <>
                    {!unsubmitted && !failed && Number.isSafeInteger(order.gross) && order.gross >= 0 ? (
                        <div className="flex items-baseline gap-4 py-4">
                            <span className="workspace-muted">{t('결제 금액', 'Payment amount')}</span>
                            <strong className="text-xl font-bold tabular-nums">{money(order.gross)}</strong>
                        </div>
                    ) : null}
                    {unsubmitted && restart ? (
                        <p>{t('새 금액을 확인하고 다시 진행해 주세요.', 'Review the current amount and try again.')}</p>
                    ) : null}
                    {order.status === 'PAID_PENDING_APPLICATION' ? <p>{t('결제는 완료됐어요.', 'Your payment is complete.')}</p> : null}
                    {checking ? (
                        <button
                            disabled={action.busy || query.isFetching}
                            onClick={() =>
                                void action.run(async () => {
                                    if (order.provider) await commercialPost(`/orders/${encodeURIComponent(order.id)}/INQUIRE`);
                                    else await query.refetch({throwOnError: true});
                                })
                            }
                        >
                            {t('결제 상태 다시 확인', 'Recheck payment status')}
                        </button>
                    ) : null}
                </>
            ) : null}
            {query.isError ? (
                <button type="button" className="secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>
                    {t('다시 불러오기', 'Try again')}
                </button>
            ) : null}
            <Link className={restart ? 'workspace-button' : 'workspace-button secondary'} to={restart ?? backPath}>
                {restart
                    ? t('다시 진행하기', 'Try again')
                    : backPath.startsWith('/billing')
                      ? t('요금제·결제로', 'Back to billing')
                      : t('관리 화면으로', 'Back to workspaces')}
            </Link>
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

function PaymentMethodPanel({
    scope,
    emailVerificationRequired,
    cancelAtPeriodEnd,
}: {
    scope: Scope;
    emailVerificationRequired: boolean;
    cancelAtPeriodEnd: boolean;
}) {
    const t = useCopy();
    const action = useAction();
    const accountId = useAuthStore((s) => s.accountId);
    const [consent, setConsent] = useState(false);
    const [proof, setProof] = useState('');
    const [editing, setEditing] = useState(false);
    const [removing, setRemoving] = useState(false);
    const removeButton = useRef<HTMLButtonElement>(null);
    const backButton = useRef<HTMLButtonElement>(null);
    const editorButton = useRef<HTMLButtonElement>(null);
    const retryButton = useRef<HTMLButtonElement>(null);
    const pendingFocus = useRef<'back' | 'remove' | 'header' | undefined>(undefined);
    const editorId = useId();
    const removalTitleId = useId();
    const q = useQuery({
        queryKey: commercialQueryKey(accountId, scope.type, scope.ref, 'payment-method'),
        queryFn: () =>
            commercialGet<{registered: boolean; termsVersion: string; maskedCard?: string}>(
                `/billing-scopes/${scope.scopeId}/payment-method`,
            ),
    });

    useEffect(() => {
        if (action.busy || !pendingFocus.current) return;

        const target =
            pendingFocus.current === 'back'
                ? backButton
                : pendingFocus.current === 'remove'
                  ? removeButton
                  : q.isError
                    ? retryButton
                    : editorButton;

        if (!target.current || target.current.disabled) return;

        target.current.focus();
        pendingFocus.current = undefined;
    }, [editing, removing, action.busy, q.isError, q.isPending]);

    return (
        <div className="plus-subscription__card" id="plus-subscription-card" data-editing={editing}>
            <div className="plus-subscription__card-row">
                <div>
                    <p>{t('결제수단', 'Payment method')}</p>
                    <strong>
                        {q.isPending
                            ? t('확인 중', 'Checking…')
                            : q.isError
                              ? t('결제수단을 불러오지 못했어요', 'Unable to load payment method')
                              : q.data?.registered
                                ? (q.data.maskedCard ?? t('등록된 카드', 'Registered card'))
                                : t('등록된 카드 없음', 'No registered card')}
                    </strong>
                </div>
                <button
                    ref={editorButton}
                    type="button"
                    className="plus-subscription__text-button"
                    aria-expanded={editing}
                    aria-controls={editorId}
                    disabled={q.isPending || q.isError || action.busy || !q.data?.termsVersion}
                    onClick={() => {
                        setEditing(!editing);
                        setConsent(false);
                        setProof('');
                        setRemoving(false);
                    }}
                >
                    {editing ? t('닫기', 'Close') : q.data?.registered ? t('변경', 'Change') : t('카드 등록', 'Register card')}
                </button>
            </div>
            {editing ? (
                <div className="plus-subscription__editor" id={editorId}>
                    {removing ? (
                        <div
                            className="plus-subscription__confirmation plus-subscription__card-removal"
                            role="group"
                            aria-labelledby={removalTitleId}
                        >
                            <h3 id={removalTitleId}>{t('등록된 카드를 삭제할까요?', 'Remove your registered card?')}</h3>
                            <p>
                                {t(
                                    '카드를 삭제하면 다음 자동결제가 중단됩니다. 현재 이용기간은 유지됩니다.',
                                    'Removing the card stops future automatic payments. Your current service period is retained.',
                                )}
                            </p>
                            <div className="plus-subscription__confirmation-actions">
                                <button
                                    ref={backButton}
                                    type="button"
                                    className="secondary"
                                    disabled={action.busy}
                                    onClick={() => {
                                        pendingFocus.current = 'remove';
                                        setRemoving(false);
                                    }}
                                >
                                    {t('돌아가기', 'Go back')}
                                </button>
                                <button
                                    type="button"
                                    className="plus-subscription__card-delete"
                                    disabled={action.busy}
                                    onClick={() =>
                                        void action.run(async () => {
                                            const result = await commercialDelete(`/billing-scopes/${scope.scopeId}/payment-method`);

                                            pendingFocus.current = 'header';
                                            setEditing(false);
                                            setRemoving(false);
                                            setConsent(false);
                                            setProof('');

                                            return result;
                                        })
                                    }
                                >
                                    {t('카드 삭제', 'Remove card')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="plus-subscription__editor-heading">
                                <h3>{q.data?.registered ? t('카드 변경', 'Change card') : t('카드 등록', 'Register card')}</h3>
                            </div>
                            {cancelAtPeriodEnd ? (
                                <p>
                                    {t(
                                        '카드 등록을 완료하면 해지 예약이 취소되고 매월 자동결제가 재개됩니다.',
                                        'Registering a card cancels the scheduled cancellation and resumes monthly payments.',
                                    )}
                                </p>
                            ) : null}
                            {emailVerificationRequired ? <Reauthenticate onVerified={setProof} /> : null}
                            <label className="workspace-check plus-subscription__card-consent">
                                <input
                                    type="checkbox"
                                    checked={consent}
                                    disabled={action.busy}
                                    onChange={(e) => setConsent(e.target.checked)}
                                />
                                <span>
                                    {t(
                                        '현재 계약 조건의 매월 자동 갱신에 동의합니다.',
                                        'I consent to monthly renewal under the current contract terms.',
                                    )}
                                </span>
                            </label>
                            <div className="plus-subscription__card-actions">
                                <button
                                    type="button"
                                    className="plus-subscription__card-primary"
                                    disabled={
                                        (emailVerificationRequired && !proof) ||
                                        !consent ||
                                        action.busy ||
                                        q.isPending ||
                                        q.isError ||
                                        !q.data?.termsVersion
                                    }
                                    onClick={() =>
                                        void action.run(async () => {
                                            await loadToss();

                                            const d = await commercialPost<{
                                                id: string;
                                                clientKey: string;
                                                customerKey: string;
                                                returnUrl: string;
                                            }>(
                                                `${emailVerificationRequired ? '' : '/v2'}/billing-scopes/${scope.scopeId}/payment-method`,
                                                emailVerificationRequired
                                                    ? {termsVersion: q.data?.termsVersion, reauthenticationToken: proof}
                                                    : {termsVersion: q.data?.termsVersion},
                                            );

                                            await openTossBilling(d);
                                        })
                                    }
                                >
                                    {t('카드 등록·변경', 'Register or replace card')}
                                </button>
                            </div>

                            {q.data?.registered ? (
                                <div className="plus-subscription__card-secondary">
                                    <button
                                        ref={removeButton}
                                        type="button"
                                        className="plus-subscription__text-button"
                                        disabled={action.busy}
                                        onClick={() => {
                                            pendingFocus.current = 'back';
                                            setConsent(false);
                                            setProof('');
                                            setRemoving(true);
                                        }}
                                    >
                                        {t('등록 카드 삭제', 'Remove registered card')}
                                    </button>
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            ) : null}
            <ActionsFeedback action={action} />
            <ErrorView error={q.error} />
            {q.isError ? (
                <button ref={retryButton} type="button" className="plus-subscription__text-button" onClick={() => void q.refetch()}>
                    {t('다시 확인', 'Retry')}
                </button>
            ) : null}
        </div>
    );
}

export function BillingReturn({
    backPath = '/workspace',
    paymentReturnPath = '/workspace/payment-return',
}: {backPath?: string; paymentReturnPath?: string} = {}) {
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
            {id ? <PlusCheckoutProgress payment /> : null}
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
                    {t('이번 결제금액', 'Due now')}: {money(current.gross)}
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
                        <dt>{t('다음 결제일', 'Next payment date')}</dt>
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
                        : callbackError === 'INVALID_CARD_NUMBER'
                          ? t(
                                '카드번호가 올바르지 않거나 지원하지 않는 카드입니다. 아래에서 미결제 주문을 취소한 후 카드번호를 확인하고 다시 등록해 주세요.',
                                'The card number is invalid or unsupported. Cancel the unpaid order below, then check the number and register again.',
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
                            ? `${current && Number.isSafeInteger(current.gross) ? t(`${current.gross.toLocaleString('ko-KR')}원`, money(current.gross)) : ''} ${t('결제하고 Plus 시작', 'Pay & start Plus')}`
                            : t('확인하고 등록 완료', 'Verify & finish registration')}
                    </button>
                )}
            {id && (
                <Link className="workspace-button secondary" to={`${paymentReturnPath}?orderId=${encodeURIComponent(id)}`}>
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
            <Link to={backPath}>
                {backPath.startsWith('/billing') ? t('요금제·결제로', 'Back to billing') : t('관리 공간으로', 'Back to workspaces')}
            </Link>
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
    const fullUsage = aiFillUsage(e);
    const remaining = fullUsage?.remaining ?? 0;

    return (
        <Section title={t('여러 팀 AI 채우기', 'AI fill for multiple teams')}>
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
                    '서버에 저장된 팀별 명단·설정으로 실행합니다. AI 채우기는 팀당 1회이며 필요한 횟수를 함께 예약합니다. 결과를 검토한 뒤 저장·확정해 주세요.',
                    'Uses each team’s roster and settings saved on the server. One full use is reserved per team before execution. Review results before saving or confirming.',
                )}
            </Notice>
            <div className="ward-workspace__month">
                <Field label={t('편성 월', 'Schedule month')}>
                    <input type="month" required min="2020-01" max="2100-12" value={month} onChange={(x) => setMonth(x.target.value)} />
                </Field>
            </div>
            <fieldset className="ward-workspace__teams">
                <legend>{t('근무표를 만들 팀', 'Teams to schedule')}</legend>
                {teams.isPending ? <p role="status">{t('팀 목록을 불러오는 중입니다.', 'Loading teams…')}</p> : null}
                {teams.isError ? (
                    <>
                        <ErrorView error={teams.error} />
                        <button type="button" className="secondary" onClick={() => void teams.refetch()}>
                            {t('다시 불러오기', 'Try again')}
                        </button>
                    </>
                ) : null}
                {teams.isSuccess && !teams.data.length ? (
                    <p>
                        {t(
                            '등록된 팀이 없어요. 근무표 화면에서 팀을 먼저 만들어 주세요.',
                            'Create a team in the scheduling workspace to get started.',
                        )}
                    </p>
                ) : null}
                {teams.data?.map((team) => (
                    <label className="workspace-check" key={team.shiftTeamId}>
                        <input
                            type="checkbox"
                            checked={selected.includes(team.shiftTeamId)}
                            onChange={(x) =>
                                setSelected((p) =>
                                    x.target.checked ? [...p, team.shiftTeamId] : p.filter((id) => id !== team.shiftTeamId),
                                )
                            }
                        />
                        {team.name}
                    </label>
                ))}
            </fieldset>
            <p>
                {t('필요한 AI 채우기', 'AI fill uses needed')}: {selected.length} / {t('남음', 'Available')} {remaining}
            </p>
            <button
                disabled={
                    action.busy ||
                    fullUsage?.enforced === false ||
                    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
                    month < '2020-01' ||
                    month > '2100-12' ||
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
                {t('필요 횟수 확인하고 AI 채우기', 'Reserve uses & generate')}
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
    const listedScope = context.data?.scopes.find((s) => s.type === mode && String(s.ref) === ref);
    const scope = ownedWardLinkScope ?? listedScope;
    const entitlement = useQuery({
        queryKey: commercialQueryKey(accountId, scope?.type, scope?.ref, 'entitlements'),
        queryFn: () => commercialGet<Entitlement>(`/scopes/${scope!.type}/${scope!.ref}/entitlements`),
        enabled: !!scope && !isWardLinkRoute,
        refetchOnWindowFocus: 'always',
        staleTime: 5000,
        retry: false,
    });
    const switchScope = useWorkspaceNavigation();
    const scopes = context.data?.enabled && !context.isError ? context.data.scopes : [];
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

    if (mode === 'adoption') return <Navigate to="/workspace/hospitals" replace />;

    if (scope?.type === 'HOSPITAL' && !['overview', 'members', 'billing'].includes(tab))
        return <Navigate to={scopePath(scope, tab === 'usage' || tab === 'support' ? 'billing' : 'overview')} replace />;

    if (!mode) {
        const singleWard = context.data?.configurationReady !== false ? getOnlyWardScope(scopes) : undefined;

        if (singleWard && new URLSearchParams(location.search).get('choose') !== '1')
            return <Navigate to={scopePath(singleWard)} replace />;

        return (
            <WorkspacePersonalShell
                page="workspaces"
                scopes={scopes}
                accountId={accountId}
                accountName={accountMe?.name ?? ''}
                pendingCount={pendingCount}
            >
                <WorkspaceHome
                    scopes={scopes}
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

    const wardPage = tab === 'members' || tab === 'ai-batch' || tab === 'billing' || tab === 'links' || tab === 'support' ? tab : 'usage';
    const wardLinksOnly = isWardLinkRoute && (context.data?.configurationReady === false || !listedScope);
    const isWardBilling = scope?.type === 'WARD' && (wardPage === 'usage' || wardPage === 'billing');
    const content = (
        <div className="workspace-main">
            <ActionsFeedback action={action} />
            {isWardBilling ? (
                <nav className="ward-workspace__views" aria-label={t('이용·결제 메뉴', 'Usage and billing navigation')}>
                    <Link to={scopePath(scope, 'usage')} aria-current={wardPage === 'usage' ? 'page' : undefined}>
                        {t('이용 현황', 'Usage overview')}
                    </Link>
                    <Link to={scopePath(scope, 'billing')} aria-current={wardPage === 'billing' ? 'page' : undefined}>
                        {t('구독·결제', 'Subscription & billing')}
                    </Link>
                </nav>
            ) : null}
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
                <div>
                    <ErrorView error={context.error} />
                    <button type="button" className="secondary" onClick={() => void context.refetch()}>
                        {t('다시 불러오기', 'Try again')}
                    </button>
                </div>
            ) : !context.data?.enabled ? (
                <Notice>
                    {t('요금제·병원 관리 기능을 준비하고 있습니다.', 'Plans and hospital administration are being prepared.')}{' '}
                    <Link to={ROUTE.HOME}>{t('기존 서비스 열기', 'Open current service')}</Link>
                </Notice>
            ) : isWardLinkRoute ? (
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
            ) : !scope ? (
                <Navigate to="/workspace" replace />
            ) : entitlement.data ? (
                scope.type === 'HOSPITAL' && tab === 'billing' ? (
                    <HospitalBilling key={scope.scopeId} scope={scope} e={entitlement.data} />
                ) : tab === 'ai-batch' && scope.type === 'WARD' ? (
                    <AiBatchPanel key={scope.scopeId} scope={scope} e={entitlement.data} />
                ) : tab === 'members' ? (
                    scope.type === 'HOSPITAL' ? (
                        <HospitalMembersPanel key={scope.scopeId} scope={scope} entitlement={entitlement.data} />
                    ) : (
                        <MembersPanel key={scope.scopeId} scope={scope} e={entitlement.data} />
                    )
                ) : tab === 'billing' ? (
                    <BillingPanel
                        key={scope.scopeId}
                        scope={scope}
                        e={entitlement.data}
                        cardRegistrationVersion={context.data?.cardRegistrationVersion}
                    />
                ) : tab === 'overview' && scope.type === 'HOSPITAL' ? (
                    <HospitalOverview scope={scope} />
                ) : tab === 'support' ? (
                    <>
                        <Section title={t('도입·운영 지원 요청', 'Implementation & support')}>
                            <RequestForm scope={scope} kind="SUPPORT" />
                        </Section>
                        {scope.role === 'OWNER' ? (
                            <>
                                <SupportBillingPanel scope={scope} />
                                <HospitalDisclosure active title={t('직원 지원 접근 권한', 'Staff support access')}>
                                    <SupportConsentPanel scope={scope} />
                                </HospitalDisclosure>
                                <HospitalDisclosure active title={t('병동 이용 종료', 'Close ward workspace')}>
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
                            </>
                        ) : null}
                    </>
                ) : (
                    <UsagePanel scope={scope} e={entitlement.data} />
                )
            ) : entitlement.isPending ? (
                <p role="status">{t('관리 정보를 불러오는 중입니다.', 'Loading workspace…')}</p>
            ) : (
                <div>
                    <ErrorView error={entitlement.error} />
                    <button type="button" className="secondary" onClick={() => void entitlement.refetch()}>
                        {t('다시 불러오기', 'Try again')}
                    </button>
                </div>
            )}
        </div>
    );

    if (scope?.type === 'HOSPITAL')
        return (
            <HospitalWorkspaceShell
                scope={scope}
                scopes={scopes}
                tab={tab}
                accountId={accountId}
                accountName={accountMe?.name ?? ''}
                pendingCount={pendingCount}
                busy={action.busy}
                onSwitch={(next) => void action.run(() => switchScope(next))}
            >
                {content}
            </HospitalWorkspaceShell>
        );

    if (scope?.type === 'WARD')
        return (
            <WorkspaceShell
                page={wardPage}
                scope={scope}
                scopes={scopes}
                accountId={accountId}
                accountName={accountMe?.name ?? ''}
                pendingCount={pendingCount}
                busy={action.busy}
                wardLinksOnly={wardLinksOnly}
                onOpenSchedule={wardLinksOnly ? undefined : () => void action.run(() => switchScope(scope, true))}
                className="ward-workspace"
            >
                {content}
            </WorkspaceShell>
        );

    return (
        <WorkspacePersonalShell
            page="workspaces"
            scopes={scopes}
            accountId={accountId}
            accountName={accountMe?.name ?? ''}
            pendingCount={pendingCount}
        >
            {content}
        </WorkspacePersonalShell>
    );
}
