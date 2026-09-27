import {useEffect, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {Link, useLocation, useNavigate} from 'react-router';
import {useTranslation} from 'react-i18next';
import useAuth from '@/features/auth';
import useAuthStore from '@/features/auth/model/store';
import {
    commercialGet,
    commercialDelete,
    type Policy,
    commercialPost,
    legacyGet,
    legacyPost,
    legacyDelete,
    commercialError,
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
    type WardLink,
    type Transfer,
    type AccessContext,
} from '@/features/commercial/api';
import {WardAPI} from '@/shared/api';
import ROUTE from '@/shared/constant/path';
import './workspace.css';
import type {CommercialBatchResult} from '@/features/commercial/batch-result';

const useCopy = () => {
    const {i18n} = useTranslation();
    return (ko: string, en: string) => (i18n.language.startsWith('ko') ? ko : en);
};
const money = (n: number) => new Intl.NumberFormat('ko-KR', {style: 'currency', currency: 'KRW', maximumFractionDigits: 0}).format(n);
const date = (s?: string | null) =>
    s ? new Date(/[Z+-]\d*:?.*$/.test(s.slice(10)) ? s : `${s}Z`).toLocaleString(undefined, {timeZone: 'Asia/Seoul', hour12: false}) : '—';
const memberId = (m: Members['members'][number]) => m.id ?? m.membershipId ?? m.wardAdminMembershipId;
const accountIdOf = (m: Members['members'][number]) => m.accountId ?? m.adminAccountId ?? m.wardAdminAccountId;
function Section({title, children}: {title: string; children: ReactNode}) {
    return (
        <section className="workspace-section">
            <h2>{title}</h2>
            {children}
        </section>
    );
}
function Field({label, children}: {label: string; children: ReactNode}) {
    return (
        <label className="workspace-field">
            <span>{label}</span>
            {children}
        </label>
    );
}
function Notice({children}: {children: ReactNode}) {
    return <p className="workspace-notice">{children}</p>;
}
function ErrorView({error}: {error: unknown}) {
    return error ? (
        <p className="workspace-error" role="alert">
            {commercialError(error)}
        </p>
    ) : null;
}
function useAction() {
    const client = useQueryClient();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const [notice, setNotice] = useState('');
    const keys = useRef(new Map<string, string>());
    const keyFor = (path: string, data: unknown) => {
        const id = path + JSON.stringify(data);
        if (!keys.current.has(id)) keys.current.set(id, crypto.randomUUID());
        return keys.current.get(id)!;
    };
    const run = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
        if (busy) return;
        setBusy(true);
        setError(null);
        setNotice('');
        try {
            const result = await action();
            await client.invalidateQueries({queryKey: ['commercial']});
            return result;
        } catch (e) {
            setError(e);
            return undefined;
        } finally {
            setBusy(false);
        }
    };
    return {busy, error, notice, setNotice, run, keyFor};
}
type Action = ReturnType<typeof useAction>;
function ActionsFeedback({action}: {action: Action}) {
    return (
        <>
            <ErrorView error={action.error} />
            {action.notice ? <p role="status">{action.notice}</p> : null}
        </>
    );
}
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
function Adoption({onCreated}: {onCreated: (id: string) => void}) {
    const t = useCopy();
    const action = useAction();
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const payload = {
            name: String(data.get('name')),
            contactName: String(data.get('contactName')),
            contactEmail: String(data.get('contactEmail')),
            contactPhone: String(data.get('contactPhone')),
            capacity: Number(data.get('capacity')),
            setupStaff: Number(data.get('setupStaff')),
            inquiry: String(data.get('inquiry')),
        };
        void action.run(async () => {
            const o = await commercialPost<{id: string}>('/organizations', payload, action.keyFor('adoption', payload));
            onCreated(o.id);
            return o;
        });
    };
    return (
        <Section title={t('병원 전체 도입', 'Hospital rollout')}>
            <p>
                {t(
                    '병원 관리 공간을 만들고 도입 상담을 시작합니다. 병동 연결과 결제는 견적 확인 및 양쪽 OWNER의 동의 후 진행합니다.',
                    'Create a hospital workspace and start an implementation inquiry. Ward linking and payment follow the quote and both owners’ consent.',
                )}
            </p>
            <form onSubmit={submit} className="workspace-form-grid">
                <Field label={t('병원명', 'Hospital name')}>
                    <input name="name" required maxLength={120} />
                </Field>
                <Field label={t('담당자 이름', 'Contact name')}>
                    <input name="contactName" required maxLength={80} />
                </Field>
                <Field label={t('연락 이메일', 'Contact email')}>
                    <input name="contactEmail" type="email" required maxLength={254} />
                </Field>
                <Field label={t('연락 전화번호', 'Contact phone')}>
                    <input name="contactPhone" type="tel" required maxLength={40} />
                </Field>
                <Field label={t('총 계약 예정 인원 N', 'Planned subscription capacity N')}>
                    <input name="capacity" type="number" min={1} max={10000} defaultValue={50} required />
                </Field>
                <Field label={t('직접 세팅할 인원 S', 'Staff requiring initial setup S')}>
                    <input name="setupStaff" type="number" min={1} max={10000} defaultValue={50} required />
                </Field>
                <Field label={t('도입 희망 시기·문의 내용', 'Preferred start date and questions')}>
                    <textarea name="inquiry" maxLength={1000} />
                </Field>
                <div>
                    <button disabled={action.busy}>{t('병원 관리 공간 만들고 문의하기', 'Create workspace & inquire')}</button>
                </div>
            </form>
            <ActionsFeedback action={action} />
        </Section>
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
            <Section title={`${e.plan}${e.entitlementSource === 'EVENT' ? t(' · 무료 이벤트', ' · Trial') : ''}`}>
                <div className="workspace-stats">
                    <div>
                        <strong>
                            {e.capacity.used} / {e.capacity.purchased}
                        </strong>
                        <span>{t('활성 편성 인원', 'Active scheduling staff')}</span>
                    </div>
                    <div>
                        <strong>
                            {e.adminSeats.active} + {e.adminSeats.reserved} / {e.adminSeats.limit}
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
                            <h3>
                                {u.meter === 'FULL_GENERATE' ? t('전체 생성', 'Full generation') : t('부분 조정', 'Partial adjustment')}
                            </h3>
                            <strong>
                                {u.remaining}
                                {t('회 남음', ' remaining')}
                            </strong>
                            <p>
                                {t('사용', 'Used')} {u.used} · {t('처리 중 예약', 'Reserved')} {u.reserved}
                            </p>
                            <meter min={0} max={Math.max(u.granted, 1)} value={u.remaining} aria-label={u.meter} />
                            <ul>
                                {u.lots.map((l) => (
                                    <li key={l.id}>
                                        {l.source === 'PURCHASE' ? t('추가 구매', 'Purchased') : t('기본 제공', 'Included')} {l.available}
                                        {t('회', ' uses')} ·{' '}
                                        {l.expiresAt ? date(l.expiresAt) : t('최초 제공·만료 없음', 'Lifetime allocation')}
                                    </li>
                                ))}
                            </ul>
                        </article>
                    ))}
                </div>
                <p>
                    {t(
                        '부분 조정은 전체 생성과 별도로 사용합니다. 결과가 없거나 확정된 실패에는 횟수를 차감하지 않습니다.',
                        'Partial adjustment has its own allowance. No result or a confirmed failure does not consume a use.',
                    )}
                </p>
                {e.promotion ? (
                    <Notice>
                        {t('이벤트 종료', 'Trial ends')}: {date(e.promotion.endsAt)} (KST).{' '}
                        {t(
                            '카드 등록 없이 종료 후 Free로 전환합니다. 자동 결제하지 않습니다.',
                            'Returns to Free without automatic payment.',
                        )}
                    </Notice>
                ) : null}
                <Link className="workspace-button" to={scopePath(scope, 'billing')}>
                    {e.canManageBilling
                        ? t('요금제·추가 횟수 보기', 'Plans & additional uses')
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
        <Section title={t('Hospital 예상 견적', 'Hospital estimate')}>
            <p>
                {t(
                    '매월 이용할 총 인원과 처음 세팅할 인원을 각각 입력하세요.',
                    'Enter monthly staff capacity and initial setup staff separately.',
                )}
            </p>
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
                <Field label={t('매월 계약할 인원 N', 'Monthly capacity N')}>
                    <input
                        type="number"
                        required
                        min={50}
                        max={10000}
                        value={capacity}
                        onChange={(event) => setCapacity(Number(event.target.value))}
                    />
                </Field>
                <Field label={t('처음 직접 세팅할 인원 S', 'Initial setup staff S')}>
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
            <p>
                {t(
                    '부가세 포함 예상액입니다. 최종 견적은 도입 범위와 계약 조건을 확인한 뒤 제시합니다.',
                    'Indicative KRW prices include VAT. A final quote follows scope and contract review.',
                )}
            </p>
            <ActionsFeedback action={action} />
        </Section>
    );
}
function BillingPanel({scope, e}: {scope: Scope; e: Entitlement}) {
    const t = useCopy();
    const action = useAction();
    const accountId = useAuthStore((s) => s.accountId);
    const navigate = useNavigate();
    const data = useQuery({
        queryKey: commercialQueryKey(accountId, scope.type, scope.ref, 'billing'),
        queryFn: () => commercialGet<Billing>(`/billing-scopes/${scope.scopeId}`),
        enabled: e.canManageBilling,
    });
    const plans = useQuery({
        queryKey: commercialQueryKey(accountId, 'plans'),
        queryFn: () => commercialGet<{id: string; config: Policy}[]>('/plans'),
    });
    const planPolicy =
        e.plan === (scope.type === 'HOSPITAL' ? 'HOSPITAL' : 'PLUS')
            ? e.policy
            : plans.data?.find((p) => p.config.plan === (scope.type === 'HOSPITAL' ? 'HOSPITAL' : 'PLUS'))?.config;
    const [purpose, setPurpose] = useState<QuoteRequest['purpose']>(e.entitlementSource === 'SUBSCRIPTION' ? 'USAGE_PACK' : 'SUBSCRIPTION');
    const [capacity, setCapacity] = useState(Math.max(50, e.capacity.purchased));
    const [full, setFull] = useState(0);
    const [partial, setPartial] = useState(0);
    const [setup, setSetup] = useState(50);
    const [quote, setQuote] = useState<Quote>();
    const [consent, setConsent] = useState(false);
    const [trialLoss, setTrialLoss] = useState(false);
    const terms: QuoteTerms | undefined = quote ? JSON.parse(quote.snapshot) : undefined;
    const review = async () => {
        const payload: QuoteRequest = {
            purpose,
            plan: scope.type === 'HOSPITAL' ? 'HOSPITAL' : 'PLUS',
            capacity: purpose === 'USAGE_PACK' || purpose === 'SETUP' ? e.capacity.purchased : capacity,
            setupStaff: purpose === 'SETUP' ? setup : 0,
            fullPacks: purpose === 'USAGE_PACK' ? full : 0,
            partialPacks: purpose === 'USAGE_PACK' ? partial : 0,
        };
        const q = await commercialPost<Quote>(`/billing-scopes/${scope.scopeId}/quotes`, payload);
        setQuote(q);
        setConsent(false);
        return q;
    };
    if (!e.canManageBilling)
        return (
            <Section title={t('OWNER에게 요청하기', 'Request from your owner')}>
                <Notice>
                    {t(
                        '병동 EDITOR·병원 MANAGER는 결제할 수 없습니다. 병원에 연결된 병동은 병원 OWNER가 계약 인원을 관리합니다.',
                        'Ward editors and hospital managers cannot pay. Hospital owners manage the shared capacity of linked wards.',
                    )}
                </Notice>
                <RequestForm scope={scope} />
            </Section>
        );
    return (
        <>
            {scope.type === 'HOSPITAL' ? <HospitalCalculator scope={scope} e={e} /> : null}
            {e.entitlementSource === 'SUBSCRIPTION' ? <PaymentMethodPanel scope={scope} /> : null}
            <Section title={t('요금제와 추가 구매', 'Plan & add-ons')}>
                <p>
                    {t(
                        'Plus는 병동 하나, Hospital은 계약 병원의 여러 병동을 함께 관리합니다. 로그인 관리자 수와 편성 인원은 서로 다릅니다.',
                        'Plus covers one ward. Hospital coordinates multiple contracted wards. Administrator seats and scheduling staff are separate.',
                    )}
                </p>
                <div className="workspace-plan-summary">
                    <strong>{scope.type === 'HOSPITAL' ? 'Hospital' : 'Plus'}</strong>
                    <span>
                        {t('기본', 'Base')} {planPolicy ? money(planPolicy.baseGross) : '—'} /{' '}
                        {t('월 · 기본 편성 인원', 'month · included staff')} {planPolicy?.includedStaff ?? '—'}
                    </span>
                    <span>
                        {t('추가 1명', 'Each extra staff')} {planPolicy ? money(planPolicy.extraStaffGross) : '—'} / {t('월', 'month')}
                    </span>
                </div>
                {!e.checkoutEnabled ? (
                    <Notice>
                        {t(
                            '현재 결제 오픈을 준비 중입니다. 견적과 도입 문의는 이용할 수 있습니다.',
                            'Payments are being prepared. Estimates and rollout inquiries remain available.',
                        )}
                    </Notice>
                ) : null}
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
                                min={50}
                                max={10000}
                                value={capacity}
                                onChange={(event) => {
                                    setCapacity(Number(event.target.value));
                                    setQuote(undefined);
                                }}
                            />
                        </Field>
                    )}
                    <button disabled={action.busy}>{t('정확한 금액 확인', 'Review exact quote')}</button>
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
                        <p>
                            {t('이번 제공량: 전체', 'This purchase: full')} {terms.fullUnits} / {t('부분', 'partial')} {terms.partialUnits}
                        </p>
                        <p>
                            {t('견적 만료', 'Quote expires')}: {date(quote.expiresAt)}
                        </p>
                        <Notice>
                            {t(
                                '기본 횟수는 해당 주기까지, 추가 구매 횟수는 구매일부터 365일입니다. 두 종류의 횟수는 서로 전환되지 않습니다. 구독 해지는 기간 말에 적용하며 기존 자료는 유지됩니다.',
                                'Included uses expire at the cycle end. Purchased uses last 365 days and cannot be converted between meters. Cancellation takes effect at period end; existing data is preserved.',
                            )}
                        </Notice>
                        <label className="workspace-check">
                            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                            <span>
                                {t('금액·대상·기간 및', 'I agree to the amount, scope, period and')}{' '}
                                <Link to={ROUTE.TERMS} target="_blank">
                                    {t('이용약관·환불 조건', 'terms and refund conditions')}
                                </Link>
                            </span>
                        </label>
                        {e.entitlementSource === 'EVENT' ? (
                            <label className="workspace-check">
                                <input type="checkbox" checked={trialLoss} onChange={(event) => setTrialLoss(event.target.checked)} />
                                <span>
                                    {t(
                                        '남은 무료 이벤트 기간·제공량이 종료되고 지금 첫 결제가 이루어지는 것에 동의합니다.',
                                        'I agree to end the remaining trial and make the first payment now.',
                                    )}
                                </span>
                            </label>
                        ) : null}
                        <button
                            disabled={!consent || action.busy || !e.checkoutEnabled || (e.entitlementSource === 'EVENT' && !trialLoss)}
                            onClick={() =>
                                void action.run(async () => {
                                    const payload = {
                                        quoteId: quote.id,
                                        contentHash: quote.contentHash,
                                        termsVersion: terms.termsVersion,
                                        trialLossAccepted: trialLoss,
                                    };
                                    const keyName = `dutying:checkout:${quote.id}`;
                                    const key = sessionStorage.getItem(keyName) ?? crypto.randomUUID();
                                    sessionStorage.setItem(keyName, key);
                                    const order = await commercialPost<Order>(`/billing-scopes/${scope.scopeId}/orders`, payload, key);
                                    navigate(`/workspace/payment-return?orderId=${order.id}`);
                                    return order;
                                })
                            }
                        >
                            {t('동의하고 결제 진행', 'Agree & proceed to payment')}
                        </button>
                    </div>
                ) : null}
                <ActionsFeedback action={action} />
            </Section>
            {data.data ? (
                <>
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
                                        capacity,
                                        expectedVersion: data.data!.scope.version,
                                    }),
                                );
                            }}
                        >
                            <Field label={t('다음 갱신 때 줄일 총 인원', 'Lower capacity at next renewal')}>
                                <input
                                    type="number"
                                    min={50}
                                    max={10000}
                                    value={capacity}
                                    onChange={(event) => setCapacity(Number(event.target.value))}
                                />
                            </Field>
                            <button className="secondary" disabled={action.busy}>
                                {t('다음 주기 감원 예약', 'Schedule decrease')}
                            </button>
                        </form>
                    </Section>
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
                    <Section title={t('환불·정산 문의', 'Refund & billing support')}>
                        <RequestForm scope={scope} kind="REFUND" invoices={data.data.invoices} />
                        {data.data.requests.map((r) => (
                            <p key={r.id}>
                                {r.kind} · {r.status} · {r.resolution ?? date(r.createdAt)}
                            </p>
                        ))}
                    </Section>
                </>
            ) : (
                <ErrorView error={data.error} />
            )}
        </>
    );
}
function Reauthenticate({onVerified}: {onVerified: (token: string) => void}) {
    const t = useCopy();
    const action = useAction();
    const [code, setCode] = useState('');
    return (
        <div className="workspace-reauth">
            <p>
                {t(
                    'OWNER 인계는 이메일 재인증 후 10분 동안 가능합니다.',
                    'Ownership transfer requires email verification within the last 10 minutes.',
                )}
            </p>
            <button
                className="secondary"
                disabled={action.busy}
                onClick={() =>
                    void action.run(async () => {
                        await commercialPost('/reauthentication/request');
                        action.setNotice(t('본인 이메일로 인증번호를 보냈습니다.', 'A code was sent to your email.'));
                    })
                }
            >
                {t('인증번호 받기', 'Send code')}
            </button>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    void action.run(async () => {
                        const r = await commercialPost<{reauthenticationToken: string}>('/reauthentication/confirm', {code});
                        onVerified(r.reauthenticationToken);
                        action.setNotice(t('인증되었습니다.', 'Verified.'));
                    });
                }}
            >
                <Field label={t('이메일 인증번호', 'Email verification code')}>
                    <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                    />
                </Field>
                <button disabled={action.busy}>{t('본인 확인', 'Verify')}</button>
            </form>
            <ActionsFeedback action={action} />
        </div>
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
    const canInvite = e.allowedActions.includes(scope.type === 'WARD' ? 'WARD_INVITE_CREATE' : 'ORG_INVITE_CREATE');
    return (
        <>
            <Section title={t('관리자와 초대', 'Administrators & invitations')}>
                <p>
                    {t(
                        '한 사람당 개인 계정 하나를 사용합니다. 편성 대상 간호사는 여기 초대하지 않습니다.',
                        'Each administrator uses their own account. Scheduling staff do not need invitations here.',
                    )}
                </p>
                <p>
                    {e.adminSeats.active}
                    {t('명 참여', ' active')} + {e.adminSeats.reserved}
                    {t('명 대기', ' pending')} / {e.adminSeats.limit}
                    {t('명', ' seats')}
                </p>
                <ErrorView error={data.error} />
                {data.data?.members.map((m) => (
                    <div className="workspace-row" key={memberId(m)}>
                        <div>
                            <strong>{m.name}</strong>
                            <p>
                                {m.role} · {m.email ?? ''}
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
                                            : commercialPost(`/organizations/${scope.ref}/members/${memberId(m)}/REMOVE`);
                                    })
                                }
                            >
                                {t('이 범위에서 제거', 'Remove from scope')}
                            </button>
                        ) : null}
                    </div>
                ))}
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
                            <input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
                        </Field>
                        <button disabled={action.busy || e.adminSeats.active + e.adminSeats.reserved >= e.adminSeats.limit}>
                            {t('관리자 초대', 'Invite administrator')}
                        </button>
                    </form>
                ) : null}
                {inviteUrl ? (
                    <Notice>
                        {t(
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
                        {t('예약된 이메일은 아래 초대 목록에서 관리합니다.', 'Reserved emails are managed in the invitation list below.')}{' '}
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
                {scope.role !== 'OWNER' ? (
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
                <Section title={t('OWNER 인계', 'Transfer ownership')}>
                    <Notice>
                        {t(
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
                        <Field label={t('새 OWNER가 될 관리자', 'New owner')}>
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
        </>
    );
}
function LinksPanel({scope}: {scope: Scope}) {
    const t = useCopy();
    const action = useAction();
    const accountId = useAuthStore((s) => s.accountId);
    const query = useQuery({
        queryKey: commercialQueryKey(accountId, scope.type, scope.ref, 'links'),
        queryFn: () => commercialGet<WardLink[]>(`/wards/${scope.ref}/links`),
    });
    return (
        <Section title={t('병원 연결 요청', 'Hospital link requests')}>
            <Notice>
                {t(
                    '견적 공유는 병동 이름과 활성 인원 수만 제공합니다. 최종 계약에 동의해도 병원 계약이 활성화되기 전까지 기존 Plus가 유지됩니다.',
                    'Quote sharing includes only the ward name and active staff count. Existing Plus coverage remains until the hospital contract becomes effective.',
                )}
            </Notice>
            {query.data?.map((l) => (
                <div key={l.id} className="workspace-review">
                    <h3>
                        {l.organizationId} · {l.status}
                    </h3>
                    <p>
                        {t('공유 인원', 'Shared staff')}: {l.sharedStaff ?? '—'}
                    </p>
                    <LinkContract id={l.id} />
                    {(l.status === 'REQUESTED'
                        ? ['SHARE']
                        : l.status === 'QUOTED' || l.status === 'CONSENTED'
                          ? ['WARD_ACCEPT']
                          : l.status === 'ACTIVE' || l.status === 'DETACH_PENDING'
                            ? ['WARD_DETACH']
                            : []
                    ).map((command) => (
                        <button
                            key={command}
                            disabled={action.busy}
                            onClick={() =>
                                void action.run(() =>
                                    commercialPost(`/ward-links/${l.id}/decision`, {
                                        expectedVersion: l.version,
                                        action: command,
                                        contractHash: l.contractHash,
                                    }),
                                )
                            }
                        >
                            {command === 'SHARE'
                                ? t('견적용 정보 공유 동의', 'Consent to quote sharing')
                                : command === 'WARD_ACCEPT'
                                  ? t('이 계약의 연결에 동의', 'Consent to this contract link')
                                  : t('병원 연결 분리 요청', 'Request detachment')}
                        </button>
                    ))}
                </div>
            ))}
            <ErrorView error={query.error} />
            <ActionsFeedback action={action} />
        </Section>
    );
}
function OrganizationPanel({scope}: {scope: Scope}) {
    const t = useCopy();
    const action = useAction();
    const accountId = useAuthStore((s) => s.accountId);
    const [wardCode, setWardCode] = useState('');
    const query = useQuery({
        queryKey: commercialQueryKey(accountId, 'HOSPITAL', scope.ref, 'overview'),
        queryFn: () => commercialGet<Organization>(`/organizations/${scope.ref}`),
    });
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
            <Section title={t('병원 도입 현황', 'Hospital rollout')}>
                {o.overviewEnabled === false ? (
                    <Notice>
                        {t(
                            '계약과 병동 연결은 여기에서 준비할 수 있습니다. 병동별 근무 현황은 Hospital 계약의 현황 기능이 활성화된 후 표시됩니다.',
                            'Prepare your contract and ward links here. Scheduling summaries appear when the hospital overview feature is active.',
                        )}
                    </Notice>
                ) : null}
                <div className="workspace-stats">
                    <div>
                        <strong>{o.organization.adoptionStage}</strong>
                        <span>{t('도입 단계', 'Implementation stage')}</span>
                    </div>
                    <div>
                        <strong>{o.organization.status}</strong>
                        <span>{t('계약 상태', 'Contract status')}</span>
                    </div>
                </div>
                <p>
                    {t(
                        '문의 → 담당자 확인 → 견적·계약 → 초기 세팅 → 고객 확인 → 병동 활성화',
                        'Inquiry → verification → quote & contract → setup → acceptance → ward activation',
                    )}
                </p>
                <Notice>
                    {t(
                        '병원 관리 권한은 각 병동의 명단·근무표를 열 수 있는 권한과 별도입니다. 해당 병동 관리자로 초대받아야 상세에 접근할 수 있습니다.',
                        'Hospital permissions are separate from ward roster and schedule access. Explicit ward membership is required to open details.',
                    )}
                </Notice>
            </Section>
            {scope.role === 'OWNER' && contract ? (
                <Section title={t('확정 견적과 도입 확인', 'Contract & setup acceptance')}>
                    <p>
                        {t('총 계약 인원', 'Contracted capacity')} {contract.capacity} · {t('초기 세팅 인원', 'Setup staff')}{' '}
                        {contract.setupStaff}
                    </p>
                    <p>
                        {t('월 이용료', 'Monthly fee')} {o.contractEstimate ? money(o.contractEstimate.monthlyGross) : '—'} ·{' '}
                        {t('초기 도입비', 'Setup fee')} {o.contractEstimate ? money(o.contractEstimate.setupGross) : '—'}
                    </p>
                    <p>
                        {date(contract.startsAt)} ~ {date(contract.endsAt)} (KST) · {contract.paymentMode}
                    </p>
                    <p>
                        {t('약관·계약 문서', 'Terms reference')}: {contract.termsRef}
                    </p>
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
                        <p>{t('계약을 수락했습니다.', 'Contract accepted.')}</p>
                    )}
                    {o.organization.adoptionStage === 'READY' && !o.organization.setupAcceptedAt ? (
                        <button
                            disabled={action.busy}
                            onClick={() =>
                                void action.run(() =>
                                    commercialPost(`/organizations/${scope.ref}/accept/SETUP`, {contractHash: o.organization.contractHash}),
                                )
                            }
                        >
                            {t('초기 세팅 결과를 확인하고 수락', 'Confirm & accept initial setup')}
                        </button>
                    ) : null}
                    <Link to={scopePath(scope, 'billing')}>{t('요금·납부 확인', 'Review billing')}</Link>
                </Section>
            ) : null}
            <Section title={t('연결 병동', 'Linked wards')}>
                {scope.role === 'OWNER' ? (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void action.run(() => commercialPost(`/organizations/${scope.ref}/ward-links`, {wardCode: wardCode.trim()}));
                        }}
                    >
                        <Field label={t('연결할 병동 코드', 'Ward code to connect')}>
                            <input
                                type="text"
                                maxLength={100}
                                required
                                value={wardCode}
                                onChange={(event) => setWardCode(event.target.value)}
                            />
                        </Field>
                        <button disabled={action.busy}>{t('병동 OWNER에게 연결 요청', 'Request link from ward owner')}</button>
                    </form>
                ) : null}
                <div className="workspace-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('병동', 'Ward')}</th>
                                <th>{t('활성 편성 인원', 'Active staff')}</th>
                                <th>{t('상태', 'Status')}</th>
                                <th>{t('작업', 'Action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {o.wards.map((w) => (
                                <tr key={w.id}>
                                    <td>{w.name ?? t('공유 동의 대기', 'Awaiting sharing consent')}</td>
                                    <td>{w.staff ?? '—'}</td>
                                    <td>
                                        {w.status}
                                        <br />
                                        {w.currentMonth} · {w.scheduleStatus ?? '—'}
                                        <br />
                                        {date(w.updatedAt)}
                                        <br />
                                        {w.contactName}
                                    </td>
                                    <td>
                                        {w.canOpenWard ? (
                                            <Link to={scopePath({type: 'WARD', ref: String(w.wardId)})}>{t('병동 열기', 'Open ward')}</Link>
                                        ) : null}
                                        {scope.role === 'OWNER' && (w.status === 'QUOTED' || w.status === 'CONSENTED') ? (
                                            <button
                                                disabled={action.busy}
                                                onClick={() =>
                                                    void action.run(() =>
                                                        commercialPost(`/ward-links/${w.id}/decision`, {
                                                            expectedVersion: w.version,
                                                            action: 'ORG_ACCEPT',
                                                            contractHash: w.contractHash,
                                                        }),
                                                    )
                                                }
                                            >
                                                {t('계약 연결 동의', 'Accept contract link')}
                                            </button>
                                        ) : null}
                                        {scope.role === 'OWNER' && (w.status === 'ACTIVE' || w.status === 'DETACH_PENDING') ? (
                                            <button
                                                className="secondary"
                                                disabled={action.busy}
                                                onClick={() =>
                                                    void action.run(() =>
                                                        commercialPost(`/ward-links/${w.id}/decision`, {
                                                            expectedVersion: w.version,
                                                            action: 'ORG_DETACH',
                                                        }),
                                                    )
                                                }
                                            >
                                                {t('분리 동의', 'Consent to detach')}
                                            </button>
                                        ) : null}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <ActionsFeedback action={action} />
            </Section>
        </>
    );
}
function Inbox({context}: {context: AccessContext}) {
    const t = useCopy();
    const action = useAction();
    const accountId = useAuthStore((s) => s.accountId);
    const [reauth, setReauth] = useState('');
    const [responsibility, setResponsibility] = useState(false);
    return (
        <>
            <Section title={t('받은 초대', 'Your invitations')}>
                {!context.invitations?.length ? <p>{t('대기 중인 초대가 없습니다.', 'No pending invitations.')}</p> : null}
                {context.invitations?.map((i) => (
                    <div className="workspace-review" key={`${i.type}:${i.invitation.id}`}>
                        <h3>
                            {i.name} · {i.invitation.role ?? 'EDITOR'}
                        </h3>
                        <p>
                            {t('만료', 'Expires')} {date(i.invitation.expiresAt)}
                        </p>
                        {['ACCEPT', 'DECLINE'].map((command) => (
                            <button
                                className={command === 'DECLINE' ? 'secondary' : ''}
                                key={command}
                                disabled={action.busy}
                                onClick={() =>
                                    void action.run(() =>
                                        commercialPost(
                                            i.type === 'WARD'
                                                ? `/ward-invitations/${i.invitation.id}/${command}`
                                                : `/invitations/${i.invitation.id}/${command}`,
                                            {expectedVersion: i.invitation.version},
                                        ),
                                    )
                                }
                            >
                                {command === 'ACCEPT' ? t('수락하고 참여', 'Accept invitation') : t('거절', 'Decline')}
                            </button>
                        ))}
                    </div>
                ))}
            </Section>
            <Section title={t('OWNER 인계 요청', 'Ownership transfer requests')}>
                <Reauthenticate onVerified={setReauth} />
                <label className="workspace-check">
                    <input type="checkbox" checked={responsibility} onChange={(event) => setResponsibility(event.target.checked)} />
                    <span>
                        {t(
                            '기존 카드 갱신 중단과 후불 계약이 있다면 담당 책임 인수에 동의합니다.',
                            'I agree to stop the previous payment mandate and accept responsibility for any postpaid contract.',
                        )}
                    </span>
                </label>
                {context.transfers?.map((tr: Transfer) => (
                    <div className="workspace-review" key={tr.id}>
                        <p>
                            {tr.scopeType} {tr.scopeRef} · {date(tr.expiresAt)}
                        </p>
                        {(tr.toAccountId === accountId ? ['ACCEPT', 'DECLINE'] : ['CANCEL']).map((command) => (
                            <button
                                className={command === 'ACCEPT' ? '' : 'secondary'}
                                key={command}
                                disabled={action.busy || (command === 'ACCEPT' && (!reauth || !responsibility))}
                                onClick={() =>
                                    void action.run(() =>
                                        commercialPost(`/owner-transfers/${tr.id}/${command}`, {
                                            expectedVersion: tr.version,
                                            reauthenticationToken: reauth || 'not-required',
                                            stopRenewal: responsibility,
                                            acceptContractResponsibility: responsibility,
                                        }),
                                    )
                                }
                            >
                                {command === 'ACCEPT'
                                    ? t('인계 수락', 'Accept transfer')
                                    : command === 'DECLINE'
                                      ? t('거절', 'Decline')
                                      : t('요청 취소', 'Cancel request')}
                            </button>
                        ))}
                    </div>
                ))}
            </Section>
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
                            <span>{order.status}</span>
                        </div>
                    </div>
                    <p>
                        {t('PG 검증', 'Provider verified')}: {date(order.verifiedAt)}
                    </p>
                    <p>
                        {t('서비스 적용', 'Service applied')}: {date(order.appliedAt)}
                    </p>
                    {order.failureCode ? <Notice>{order.failureCode}</Notice> : null}
                    {order.status === 'AWAITING_PAYMENT' ? (
                        <button
                            disabled={action.busy}
                            onClick={() =>
                                void action.run(async () => {
                                    if (paymentKey.current)
                                        return commercialPost(`/orders/${id}/CONFIRM`, {paymentReference: paymentKey.current});
                                    const ready = await commercialPost<Order>(`/orders/${id}/CREATE`);
                                    if (ready.checkoutUrl) {
                                        const url = new URL(ready.checkoutUrl);
                                        if (url.protocol !== 'https:')
                                            throw new Error(t('안전한 결제 URL을 확인할 수 없습니다.', 'Invalid payment URL.'));
                                        window.location.assign(ready.checkoutUrl);
                                    }
                                    return ready;
                                })
                            }
                        >
                            {paymentKey.current
                                ? t('승인 확인하고 적용', 'Verify approval & activate')
                                : t('PG 결제 화면 열기', 'Open payment window')}
                        </button>
                    ) : null}
                    {!['APPLIED', 'FAILED'].includes(order.status) ? (
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

function LinkContract({id}: {id: string}) {
    const t = useCopy();
    const accountId = useAuthStore((s) => s.accountId);
    const q = useQuery({
        queryKey: commercialQueryKey(accountId, 'link-contract', id),
        queryFn: () =>
            commercialGet<{
                hospitalName: string;
                ready: boolean;
                capacity: number;
                monthlyGross: number;
                setupGross: number;
                startsAt: string;
                endsAt: string;
                termsRef: string;
            }>(`/ward-links/${id}/contract`),
    });
    if (!q.data) return <ErrorView error={q.error} />;
    const d = q.data;
    return (
        <div>
            <strong>{d.hospitalName}</strong>
            {d.ready ? (
                <>
                    <p>
                        {t('병원 전체 계약 인원', 'Hospital capacity')} {d.capacity} · {t('월 이용료', 'Monthly fee')}{' '}
                        {money(d.monthlyGross)} · {t('초기 도입비', 'Setup fee')} {money(d.setupGross)}
                    </p>
                    <p>
                        {date(d.startsAt)} ~ {date(d.endsAt)} (KST)
                    </p>
                    <p>
                        {t('계약 조건', 'Terms')}: {d.termsRef}
                    </p>
                </>
            ) : (
                <p>{t('확정 견적을 기다리고 있습니다.', 'Awaiting the final quote.')}</p>
            )}
        </div>
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
            <ErrorView error={staff.error || grants.error} />
            <ActionsFeedback action={action} />
        </div>
    );
}
type TossSdk = {
    payment: (options: {customerKey: string}) => {
        requestBillingAuth: (options: {method: 'CARD'; successUrl: string; failUrl: string}) => Promise<void>;
    };
};
async function loadToss(): Promise<(key: string) => TossSdk> {
    const win = window as Window & {TossPayments?: (key: string) => TossSdk};
    if (win.TossPayments) return win.TossPayments;
    await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://js.tosspayments.com/v2/standard';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('결제창을 불러오지 못했습니다.'));
        document.head.append(script);
    });
    if (!win.TossPayments) throw new Error('결제창을 불러오지 못했습니다.');
    return win.TossPayments;
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
                {q.data?.registered
                    ? q.data.maskedCard
                    : t('등록된 자동결제 수단이 없습니다.', 'No automatic renewal method is registered.')}
            </p>
            <Notice>
                {t(
                    '매월 갱신일에 현재 계약 인원과 계약 요금으로 청구합니다. 카드 정보는 결제사 화면에서 입력하며, OWNER 인계 시 기존 카드로 갱신하지 않습니다.',
                    'Each renewal charges your contracted capacity and pricing. Enter card details on the payment provider’s screen. Ownership transfer stops renewal on the previous owner’s card.',
                )}
            </Notice>
            <Reauthenticate onVerified={setProof} />
            <label className="workspace-check">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                {t('현재 계약 조건의 매월 자동 갱신에 동의합니다.', 'I consent to monthly renewal under the current contract terms.')}
            </label>
            <button
                disabled={!proof || !consent || action.busy}
                onClick={() =>
                    void action.run(async () => {
                        const d = await commercialPost<{id: string; clientKey: string; customerKey: string; returnUrl: string}>(
                            `/billing-scopes/${scope.scopeId}/payment-method`,
                            {termsVersion: q.data?.termsVersion, reauthenticationToken: proof},
                        );
                        const sdk = await loadToss();
                        await sdk(d.clientKey)
                            .payment({customerKey: d.customerKey})
                            .requestBillingAuth({method: 'CARD', successUrl: d.returnUrl, failUrl: d.returnUrl});
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
    const location = useLocation();
    const params = useRef(new URLSearchParams(location.search));
    const [done, setDone] = useState(false);
    useEffect(() => {
        window.history.replaceState(null, '', location.pathname);
    }, [location.pathname]);
    return (
        <Section title={t('자동결제 등록 확인', 'Confirm renewal registration')}>
            <Notice>
                {done
                    ? t(
                          '등록되었습니다. 현재 계약의 다음 갱신일부터 사용합니다.',
                          'Registered for the next renewal of your current contract.',
                      )
                    : t(
                          '카드 인증 결과를 서버에서 확인한 뒤 등록합니다.',
                          'The server must verify the card authorization before registration.',
                      )}
            </Notice>
            {params.current.get('authKey') && !done ? (
                <button
                    disabled={action.busy}
                    onClick={() =>
                        void action.run(async () => {
                            await commercialPost(`/billing-registrations/${params.current.get('registration')}/confirm`, {
                                customerKey: params.current.get('customerKey'),
                                authKey: params.current.get('authKey'),
                            });
                            setDone(true);
                        })
                    }
                >
                    {t('확인하고 등록 완료', 'Verify & finish registration')}
                </button>
            ) : null}
            <ActionsFeedback action={action} />
            <Link to="/workspace">{t('관리 공간으로', 'Back to workspaces')}</Link>
        </Section>
    );
}
function Notices() {
    const t = useCopy();
    const action = useAction();
    const accountId = useAuthStore((s) => s.accountId);
    const q = useQuery({
        queryKey: commercialQueryKey(accountId, 'notices'),
        queryFn: () => commercialGet<{id: string; message: string; targetPath: string; readAt?: string}[]>('/notices'),
    });
    return (
        <Section title={t('요금·이벤트 알림', 'Billing & event notices')}>
            {q.data?.map((n) => (
                <article className="workspace-review" key={n.id}>
                    <p>{n.message}</p>
                    <Link to={n.targetPath}>{t('확인하기', 'Review')}</Link>
                    {!n.readAt ? (
                        <button
                            className="secondary"
                            disabled={action.busy}
                            onClick={() => void action.run(() => commercialPost(`/notices/${n.id}/read`))}
                        >
                            {t('읽음 표시', 'Mark as read')}
                        </button>
                    ) : null}
                </article>
            ))}
            {q.data?.length === 0 ? <p>{t('새 알림이 없습니다.', 'No new notices.')}</p> : null}
            <ErrorView error={q.error} />
            <ActionsFeedback action={action} />
        </Section>
    );
}

function Receipts() {
    const t = useCopy();
    const accountId = useAuthStore((s) => s.accountId);
    const q = useQuery({queryKey: commercialQueryKey(accountId, 'receipts'), queryFn: () => commercialGet<Order[]>('/receipts')});
    return (
        <Section title={t('내가 결제한 내역', 'My payment history')}>
            <p>
                {t(
                    '병동에서 나간 뒤에도 원결제자의 거래 내역은 보존됩니다.',
                    'Original payer receipts remain available after leaving a ward.',
                )}
            </p>
            {q.data?.map((o) => (
                <p key={o.id}>
                    <Link to={`/workspace/payment-return?orderId=${o.id}`}>
                        {money(o.gross)} · {o.status} · {date(o.verifiedAt)}
                    </Link>
                </p>
            ))}
            <ErrorView error={q.error} />
        </Section>
    );
}

function Plans() {
    const t = useCopy();
    const accountId = useAuthStore((s) => s.accountId);
    const q = useQuery({
        queryKey: commercialQueryKey(accountId, 'plans'),
        queryFn: () => commercialGet<{id: string; config: Policy}[]>('/plans'),
    });
    return (
        <Section title={t('우리 병동에 맞는 요금제', 'Plans for your ward')}>
            <Notice>
                {t(
                    '금액은 부가세 포함입니다. 관리자 계정 수와 근무표 편성 인원은 서로 다릅니다.',
                    'Prices include VAT. Administrator seats and scheduling staff are counted separately.',
                )}
            </Notice>
            <div className="workspace-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>{t('제공 기능', 'Included')}</th>
                            {q.data?.map((p) => <th key={p.id}>{p.config.plan}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            [t('월 기본료', 'Monthly base'), (p: Policy) => money(p.baseGross)],
                            [t('기본 편성 인원', 'Included staff'), (p: Policy) => String(p.includedStaff)],
                            [
                                t('추가 인원 1명 / 월', 'Each additional staff / month'),
                                (p: Policy) => (p.plan === 'FREE' ? '—' : money(p.extraStaffGross)),
                            ],
                            [
                                t('전체 생성 / 부분 조정', 'Full generation / partial adjustment'),
                                (p: Policy) =>
                                    `${p.generate} / ${p.adjust} ${p.plan === 'FREE' ? t('(최초 1회 지급)', '(once)') : t('(매월)', '(monthly)')}`,
                            ],
                            [
                                t('관리자 정원', 'Administrator seats'),
                                (p: Policy) =>
                                    p.plan === 'HOSPITAL'
                                        ? `${p.adminSeats} ${t('명 (병원 조직)', 'hospital admins')}`
                                        : String(p.adminSeats),
                            ],
                            [
                                t('새 신청·게시판 글 작성', 'New requests & posts'),
                                (p: Policy) =>
                                    p.features?.REQUEST_CREATE
                                        ? t('포함', 'Included')
                                        : t('기존 자료 유지·접수 건 처리', 'Existing records & request review'),
                            ],
                            [
                                t('병원 계약·통합 현황·방문 세팅', 'Hospital contract, overview & setup'),
                                (p: Policy) =>
                                    p.plan === 'HOSPITAL' ? t('포함 · 세팅 별도 견적', 'Included · setup quoted separately') : '—',
                            ],
                        ].map(([label, value]) => (
                            <tr key={String(label)}>
                                <th>{String(label)}</th>
                                {q.data?.map((p) => <td key={p.id}>{(value as (p: Policy) => string)(p.config)}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Notice>
                {t(
                    'Hospital은 계약 인원에 따라 전체·부분 제공량도 늘어납니다. Plus 90일 무료 이벤트는 별도 신청하며 카드 등록·자동 결제가 없습니다.',
                    'Hospital allowance scales with contracted capacity. The separate 90-day Plus promotion requires no card and never auto-charges.',
                )}
            </Notice>
            <Link to="/workspace/adoption">{t('병원 도입 견적·문의', 'Hospital quote & inquiry')}</Link>
            <ErrorView error={q.error} />
        </Section>
    );
}
function SupportBillingPanel({scope}: {scope: Scope}) {
    const t = useCopy();
    const action = useAction();
    const accountId = useAuthStore((s) => s.accountId);
    type Offer = {
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
            commercialGet<{allowance: {includedSeconds: number; usedSeconds: number; remainingSeconds: number}; offers: Offer[]}>(
                `/billing-scopes/${scope.scopeId}/support`,
            ),
    });
    return (
        <Section title={t('지원 시간과 추가 지원 견적', 'Support allowance & quotes')}>
            <p>
                {t('기본 지원 남음', 'Included support remaining')}: {Math.floor((q.data?.allowance.remainingSeconds ?? 0) / 60)}{' '}
                {t('분', 'min')}
            </p>
            <Notice>
                {t(
                    '제품 결함 복구와 초기 세팅은 월 지원 시간을 차감하지 않습니다. 추가 지원은 아래 금액과 시간에 동의한 뒤 별도 청구됩니다.',
                    'Defect recovery and initial setup do not consume the monthly allowance. Additional support is invoiced only after you accept its price and time allowance.',
                )}
            </Notice>
            {q.data?.offers.map((o) => (
                <div className="workspace-row" key={o.id}>
                    <div>
                        <strong>{o.purpose}</strong>
                        <p>
                            {money(o.gross)} · {Math.floor(o.seconds / 60)} {t('분', 'min')} · {t('기한', 'Expires')} {date(o.expiresAt)} ·{' '}
                            {o.status}
                        </p>
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
                                    void action.run(() => commercialPost(`/support-offers/${o.id}/accept`, {expectedVersion: o.version}));
                            }}
                        >
                            {t('금액·시간 확인하고 동의', 'Accept price & time')}
                        </button>
                    ) : null}
                </div>
            ))}
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
    const remaining = e.usage.find((u) => u.meter === 'FULL_GENERATE')?.remaining ?? 0;
    return (
        <Section title={t('여러 팀 전체 생성', 'Generate schedules for multiple teams')}>
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
    const {
        actions: {handleGetAccountMe},
    } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const client = useQueryClient();
    const action = useAction();
    const [mode, ref, tab = 'usage'] = location.pathname.replace(/^\/workspace\/?/, '').split('/');
    const scope = context.data?.scopes.find((s) => s.type === mode && s.ref === ref);
    const entitlement = useQuery({
        queryKey: commercialQueryKey(accountId, scope?.type, scope?.ref, 'entitlements'),
        queryFn: () => commercialGet<Entitlement>(`/scopes/${scope!.type}/${scope!.ref}/entitlements`),
        enabled: !!scope,
        refetchOnWindowFocus: 'always',
        staleTime: 5000,
    });
    const switchScope = async (next: Scope, openWard = false) => {
        await commercialPost(`/scopes/${next.type}/${next.ref}/select`);
        await client.cancelQueries();
        client.clear();
        await handleGetAccountMe();
        navigate(openWard ? ROUTE.HOME : scopePath(next, next.type === 'HOSPITAL' ? 'overview' : 'usage'));
    };
    useEffect(() => {
        if (location.hash.includes('token=')) {
            window.history.replaceState(null, '', location.pathname + location.search);
        }
    }, [location.hash, location.pathname, location.search]);
    return (
        <div className="workspace-app">
            <header className="workspace-header">
                <Link to="/workspace" className="workspace-brand">
                    dutying
                </Link>
                <nav aria-label={t('관리 메뉴', 'Workspace navigation')}>
                    <Link to="/workspace/plans">{t('요금제 비교', 'Compare plans')}</Link>
                    <Link to="/workspace/invitations">{t('초대·인계', 'Invitations')}</Link>
                    <Link to="/workspace/notices">{t('알림', 'Notices')}</Link>
                    <Link to="/workspace/receipts">{t('내 결제 내역', 'Receipts')}</Link>
                    <Link to={ROUTE.PROFILE}>{t('내 계정', 'My account')}</Link>
                </nav>
            </header>
            <main className="workspace-main">
                <div className="workspace-title">
                    <div>
                        <p>{t('병동과 병원을 위한 관리 공간', 'Your ward and hospital workspaces')}</p>
                        <h1>{scope?.name ?? t('내 관리 공간', 'My workspaces')}</h1>
                    </div>
                    {context.data?.scopes.length ? (
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
                                        {s.type === 'HOSPITAL' ? t('병원', 'Hospital') : t('병동', 'Ward')} · {s.name} · {s.role}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    ) : null}
                </div>
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
                    <Adoption onCreated={(id) => navigate(`/workspace/HOSPITAL/${id}/overview`)} />
                ) : mode === 'invitations' ? (
                    <Inbox context={context.data} />
                ) : mode === 'billing-return' ? (
                    <BillingReturn />
                ) : mode === 'notices' ? (
                    <Notices />
                ) : mode === 'payment-return' ? (
                    <PaymentReturn />
                ) : mode === 'receipts' ? (
                    <Receipts />
                ) : scope ? (
                    <>
                        <nav className="workspace-tabs" aria-label={t('범위별 메뉴', 'Scope menus')}>
                            {(scope.type === 'HOSPITAL'
                                ? [
                                      ['overview', t('병원 현황', 'Hospital overview')],
                                      ['usage', t('사용량', 'Usage')],
                                      ['members', t('병원 관리자', 'Hospital admins')],
                                      ...(scope.role === 'OWNER' ? [['billing', t('요금·견적', 'Billing & quotes')]] : []),
                                      ['support', t('도입·지원', 'Support')],
                                  ]
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
                        {entitlement.data ? (
                            tab === 'ai-batch' && scope.type === 'WARD' ? (
                                <AiBatchPanel scope={scope} e={entitlement.data} />
                            ) : tab === 'members' ? (
                                <MembersPanel key={scope.scopeId} scope={scope} e={entitlement.data} />
                            ) : tab === 'billing' ? (
                                <BillingPanel key={scope.scopeId} scope={scope} e={entitlement.data} />
                            ) : tab === 'links' && scope.type === 'WARD' && scope.role === 'OWNER' ? (
                                <LinksPanel scope={scope} />
                            ) : tab === 'overview' && scope.type === 'HOSPITAL' ? (
                                <OrganizationPanel scope={scope} />
                            ) : tab === 'support' ? (
                                <>
                                    <Section title={t('도입·운영 지원 요청', 'Implementation & support')}>
                                        <RequestForm scope={scope} kind="SUPPORT" />
                                        {scope.role === 'OWNER' ? <SupportBillingPanel scope={scope} /> : null}
                                        {scope.type === 'WARD' && scope.role === 'OWNER' ? <SupportConsentPanel scope={scope} /> : null}
                                    </Section>
                                    {scope.role === 'OWNER' ? (
                                        <Section title={t('범위 종료·보관 요청', 'Request closure & archive')}>
                                            <Notice>
                                                {t(
                                                    '종료 시 미수·환불·연결을 확인한 뒤 보관합니다. 기존 자료를 즉시 삭제하지 않습니다.',
                                                    'Outstanding invoices, refunds and links are reviewed before archiving. Existing data is preserved.',
                                                )}
                                            </Notice>
                                            <RequestForm scope={scope} kind="CLOSURE" />
                                        </Section>
                                    ) : null}
                                </>
                            ) : (
                                <UsagePanel scope={scope} e={entitlement.data} />
                            )
                        ) : (
                            <ErrorView error={entitlement.error} />
                        )}
                    </>
                ) : (
                    <>
                        <Section title={t('어디서 시작할까요?', 'Where would you like to start?')}>
                            <div className="workspace-grid">
                                <Link className="workspace-choice" to={ROUTE.ONBOARDING_WARD_CREATE}>
                                    <h3>{t('병동 만들기', 'Create a ward')}</h3>
                                    <p>{t('하나의 병동에서 근무표를 편성합니다.', 'Create schedules for one ward.')}</p>
                                </Link>
                                <Link className="workspace-choice" to={ROUTE.ENTER_WARD}>
                                    <h3>{t('병동 들어가기', 'Join a ward')}</h3>
                                    <p>{t('관리자 초대를 수락하고 참여합니다.', 'Accept an administrator invitation.')}</p>
                                </Link>
                                <Link className="workspace-choice" to="/workspace/adoption">
                                    <h3>{t('병원 전체 도입', 'Hospital rollout')}</h3>
                                    <p>{t('여러 병동의 계약과 운영 현황을 관리합니다.', 'Manage contracts and overview across wards.')}</p>
                                </Link>
                            </div>
                        </Section>
                        <Section title={t('내 병동·병원', 'My wards & hospitals')}>
                            {context.data.scopes.map((s) => (
                                <button
                                    className="workspace-choice"
                                    key={s.scopeId}
                                    disabled={action.busy}
                                    onClick={() => void action.run(() => switchScope(s))}
                                >
                                    <strong>{s.name}</strong> · {s.type} · {s.role}
                                </button>
                            ))}
                        </Section>
                    </>
                )}
            </main>
        </div>
    );
}
