import {useEffect, useId, useState} from 'react';
import {commercialPost, type Billing, type Entitlement, type Quote, type QuoteRequest, type Scope} from '@/features/commercial/api';
import {parseQuoteTerms, quoteTimestamp} from '@/features/commercial/quote-terms';
import {ActionsFeedback, Field, useAction, useCopy} from './workspace-ui';
import './plus-addons.css';

const money = (amount: number) => new Intl.NumberFormat('ko-KR', {style: 'currency', currency: 'KRW'}).format(amount);
const date = (value: string) =>
    new Intl.DateTimeFormat('ko-KR', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'}).format(
        new Date(quoteTimestamp(value)),
    );

export function PlusAddons({scope, entitlement: e, billing}: {scope: Scope; entitlement: Entitlement; billing?: Billing}) {
    const t = useCopy();
    const action = useAction();
    const choiceId = useId();
    const [purpose, setPurpose] = useState<'CAPACITY' | 'USAGE_PACK'>('CAPACITY');
    const [staff, setStaff] = useState('');
    const [full, setFull] = useState('0');
    const [review, setReview] = useState<{quote: Quote; identity: string}>();
    const [sentQuote, setSentQuote] = useState<string>();
    const [now, setNow] = useState(Date.now);
    const current = billing?.customer?.capacity ?? e.capacity.purchased;
    const minimum = Math.max(current + 1, e.policy.includedStaff, e.capacity.used);
    const isCapacity = purpose === 'CAPACITY';
    const validStaff = /^\d+$/.test(staff) && Number.isSafeInteger(Number(staff)) && Number(staff) >= minimum && Number(staff) <= 10000;
    const validPackCounts = /^\d*$/.test(full) && Number(full) <= 100;
    const validPacks = validPackCounts && Number(full) > 0;
    const valid = isCapacity ? validStaff : validPacks;
    const request: QuoteRequest = {
        purpose,
        plan: 'PLUS',
        capacity: isCapacity ? Number(staff) : current,
        setupStaff: 0,
        fullPacks: isCapacity ? 0 : Number(full),
        partialPacks: 0,
    };
    const identity = JSON.stringify({scopeId: scope.scopeId, request, current, version: billing?.scope.version, policy: e.policy});
    const quote = valid && review?.identity === identity ? review.quote : undefined;
    const terms = quote ? parseQuoteTerms(quote.snapshot) : undefined;
    const expired = !!quote && quoteTimestamp(quote.expiresAt) <= now;

    useEffect(() => {
        if (!quote) return;

        const timer = setTimeout(
            () => setNow(Date.now()),
            Math.max(0, Math.min(2147483647, quoteTimestamp(quote.expiresAt) - Date.now() + 25)),
        );

        return () => clearTimeout(timer);
    }, [quote]);

    const reviewAmount = () =>
        void action.run(async () => {
            if (!valid) return;

            setReview(undefined);

            const result = await commercialPost<Quote>(`/billing-scopes/${scope.scopeId}/quotes`, request);
            const snapshot = parseQuoteTerms(result.snapshot);

            if (
                !snapshot ||
                result.scopeId !== scope.scopeId ||
                result.purpose !== purpose ||
                !result.id?.trim() ||
                !result.contentHash?.trim() ||
                typeof result.expiresAt !== 'string' ||
                !(quoteTimestamp(result.expiresAt) > Date.now()) ||
                !Object.entries(request).every(([key, value]) => snapshot.request[key as keyof QuoteRequest] === value)
            )
                throw new Error(
                    t('견적 정보를 확인하지 못했어요. 다시 확인해 주세요.', 'Unable to verify this estimate. Please try again.'),
                );

            setNow(Date.now());
            setReview({quote: result, identity});
        });
    const submitRequest = () =>
        void action.run(async () => {
            if (!valid || !quote || !terms || sentQuote === quote.id) return;

            if (!(quoteTimestamp(quote.expiresAt) > Date.now())) {
                setNow(Date.now());
                throw new Error(
                    t('금액 확인 시간이 지났어요. 금액을 다시 확인해 주세요.', 'This estimate has expired. Check the amount again.'),
                );
            }

            const description = isCapacity
                ? `인원 증원 문의: ${current}명 → ${request.capacity}명. 예상 추가금 ${money(terms.totalAmount)}, 변경 후 월요금 ${money(terms.recurring.monthlyGross)}. 견적 ${quote.id}`
                : `AI 채우기 추가 문의: ${request.fullPacks}묶음, ${terms.fullUnits}회. 예상 추가금 ${money(terms.totalAmount)}. 견적 ${quote.id}`;
            const payload = {kind: isCapacity ? 'CAPACITY' : 'SUPPORT', capacity: request.capacity, invoiceId: null, description};

            await commercialPost(`/billing-scopes/${scope.scopeId}/requests`, payload, action.keyFor('addon-request', payload));
            setSentQuote(quote.id);
            action.setNotice(t('문의가 접수됐어요.', 'Your request has been submitted.'));
        });

    return (
        <details className="hospital-secondary-disclosure plus-addons">
            <summary>
                <span>{t('추가 이용 문의', 'Additional usage')}</span>
                <span className="hospital-secondary-disclosure-indicator" aria-hidden="true">
                    +
                </span>
            </summary>
            <div className="hospital-secondary-content">
                <div className="plus-addons__panel">
                    <div className="plus-addons__choices" role="radiogroup" aria-label={t('추가 이용 선택', 'Choose additional usage')}>
                        {(['CAPACITY', 'USAGE_PACK'] as const).map((value) => (
                            <label key={value} data-selected={purpose === value}>
                                <input
                                    type="radio"
                                    name={choiceId}
                                    value={value}
                                    checked={purpose === value}
                                    disabled={action.busy}
                                    onChange={() => {
                                        setPurpose(value);
                                        setReview(undefined);
                                        action.setNotice('');
                                    }}
                                />
                                <span>
                                    {value === 'CAPACITY'
                                        ? t('인원 추가', 'Additional staff')
                                        : t('AI 채우기 추가', 'Additional AI fill uses')}
                                </span>
                            </label>
                        ))}
                    </div>
                    <form
                        className="plus-addons__form"
                        onSubmit={(event) => {
                            event.preventDefault();
                            reviewAmount();
                        }}
                    >
                        {isCapacity ? (
                            <>
                                <div className="plus-addons__context">
                                    <span>{t('현재 계약 인원', 'Current staff capacity')}</span>
                                    <strong>
                                        {current}
                                        {t('명', ' staff')}
                                    </strong>
                                </div>
                                <div className="plus-addons__field">
                                    <Field label={t('늘린 뒤 총 근무 인원', 'Total staff after increase')} suffix={t('명', 'staff')}>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={5}
                                            placeholder={String(minimum)}
                                            required
                                            value={staff}
                                            disabled={action.busy}
                                            onChange={(event) => {
                                                setStaff(event.target.value);
                                                setReview(undefined);
                                                action.setNotice('');
                                            }}
                                            aria-invalid={(staff !== '' && !validStaff) || undefined}
                                        />
                                    </Field>
                                    <p className="plus-addons__pack-rate">
                                        {t('추가 1명당 월', 'Per additional staff / month')} {money(e.policy.extraStaffGross)}
                                    </p>
                                </div>
                                {staff !== '' && !validStaff ? (
                                    <p className="plus-addons__caption" role="status">
                                        {minimum}~10,000{t('명 사이의 인원을 입력해 주세요.', ' staff required.')}
                                    </p>
                                ) : null}
                                <p className="plus-addons__caption">
                                    {t(
                                        '증원 요금은 남은 이용기간에 맞춰 계산됩니다.',
                                        'The increase is prorated for the remaining service period.',
                                    )}
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="plus-addons__field">
                                    <Field label={t('AI 채우기 묶음 수', 'AI fill packs')} suffix={t('묶음', 'packs')}>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={3}
                                            value={full}
                                            disabled={action.busy}
                                            onChange={(event) => {
                                                setFull(event.target.value);
                                                setReview(undefined);
                                                action.setNotice('');
                                            }}
                                        />
                                    </Field>
                                    <p className="plus-addons__pack-rate">
                                        {e.policy.generatePackSize}
                                        {t('회 / 묶음', ' uses / pack')} · {money(e.policy.generatePackGross)}
                                    </p>
                                </div>

                                {!validPacks && full !== '0' ? (
                                    <p className="plus-addons__caption" role="status">
                                        {validPackCounts
                                            ? t('1묶음 이상 입력해 주세요.', 'Enter at least one pack.')
                                            : t('묶음 수는 0~100 사이의 정수로 입력해 주세요.', 'Enter 0–100 packs for each option.')}
                                    </p>
                                ) : null}
                            </>
                        )}
                        <button type="submit" className="secondary plus-addons__review-button" disabled={!valid || action.busy}>
                            {isCapacity
                                ? t('증원 금액 확인', 'Check staff increase amount')
                                : t('추가 금액 확인', 'Check additional amount')}
                        </button>
                    </form>
                    {quote && terms ? (
                        <div className="plus-addons__quote">
                            <div className="plus-addons__amount">
                                <span>{t('예상 추가 요금', 'Estimated additional amount')}</span>
                                <strong>{money(terms.totalAmount)}</strong>
                            </div>
                            <p className="plus-addons__caption">{t('부가세 포함', 'VAT included')}</p>
                            <dl className="plus-addons__facts">
                                {isCapacity ? (
                                    <>
                                        <dt>{t('변경 인원', 'Staff change')}</dt>
                                        <dd>
                                            {current}
                                            {t('명', ' staff')} → {request.capacity}
                                            {t('명', ' staff')}
                                        </dd>
                                        <dt>{t('변경 후 월요금', 'Monthly rate after increase')}</dt>
                                        <dd>{money(terms.recurring.monthlyGross)}</dd>
                                        <dt>{t('현재 이용 종료일', 'Current service ends')}</dt>
                                        <dd>{date(terms.periodEnd)}</dd>
                                        {billing?.scope.nextCapacity != null ? (
                                            <>
                                                <dt>{t('예약된 다음 인원', 'Scheduled next-cycle capacity')}</dt>
                                                <dd>
                                                    {billing.scope.nextCapacity}
                                                    {t('명', ' staff')}
                                                </dd>
                                            </>
                                        ) : null}
                                    </>
                                ) : (
                                    <>
                                        <dt>{t('추가 횟수', 'Additional uses')}</dt>
                                        <dd>
                                            {terms.fullUnits}
                                            {t('회', ' uses')}
                                        </dd>
                                    </>
                                )}
                            </dl>
                            {expired ? (
                                <p className="plus-addons__caption" role="status">
                                    {t(
                                        '금액 확인 시간이 지났어요. 금액을 다시 확인해 주세요.',
                                        'This estimate has expired. Check the amount again.',
                                    )}
                                </p>
                            ) : null}
                            <button
                                type="button"
                                className="plus-addons__request-primary"
                                disabled={action.busy || expired || sentQuote === quote.id}
                                onClick={submitRequest}
                            >
                                {sentQuote === quote.id
                                    ? t('문의 접수 완료', 'Request submitted')
                                    : isCapacity
                                      ? t('증원 문의하기', 'Request staff increase')
                                      : t('추가 횟수 문의', 'Request additional AI fill uses')}
                            </button>
                        </div>
                    ) : null}
                    <ActionsFeedback action={action} />
                </div>
            </div>
        </details>
    );
}
