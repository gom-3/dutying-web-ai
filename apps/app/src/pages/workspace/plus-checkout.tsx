import type {Policy} from '@/features/commercial/api';
import {useCopy} from './workspace-ui';
import './plus-checkout.css';

type TPlusPricing = Pick<Policy, 'baseGross' | 'includedStaff' | 'extraStaffGross' | 'generate' | 'adjust' | 'adminSeats'>;

const money = (value: number) =>
    new Intl.NumberFormat('ko-KR', {style: 'currency', currency: 'KRW', maximumFractionDigits: 0}).format(value);

export function PlusCheckoutProgress({reviewing = false}: {reviewing?: boolean}) {
    const t = useCopy();
    const steps = [t('금액 확인', 'Review amount'), t('카드 등록', 'Register card'), t('첫 결제·Plus 시작', 'First payment & activation')];

    return (
        <ol className="plus-checkout-steps" aria-label={t('Plus 구독 절차', 'Plus subscription steps')}>
            {steps.map((step, index) => (
                <li key={step} aria-current={index === (reviewing ? 1 : 0) ? 'step' : undefined}>
                    <span aria-hidden="true">{index + 1}</span>
                    {step}
                </li>
            ))}
        </ol>
    );
}

export function PlusCheckoutPlan({pricing, scopeName}: {pricing?: TPlusPricing; scopeName: string}) {
    const t = useCopy();

    return (
        <div className="plus-checkout-plan">
            <p className="plus-checkout-scope">
                {scopeName} · {t('병동 1개 월 구독', 'Monthly subscription for one ward')}
            </p>
            <div className="plus-checkout-price">
                <strong>{pricing ? money(pricing.baseGross) : '—'}</strong>
                <span>{t('/ 월 · 부가세 포함', '/ month · VAT included')}</span>
            </div>
            {pricing ? (
                <>
                    <ul className="plus-checkout-benefits">
                        <li>
                            <strong>
                                {pricing.includedStaff}
                                {t('명', ' staff')}
                            </strong>
                            {t(' 기본 편성 인원', ' included')}
                        </li>
                        <li>
                            <strong>
                                {pricing.generate}
                                {t('회', ' uses')}
                            </strong>
                            {t(' 전체 생성 / 월', ' full generations / month')}
                        </li>
                        <li>
                            <strong>
                                {pricing.adjust}
                                {t('회', ' uses')}
                            </strong>
                            {t(' 부분 조정 / 월', ' partial adjustments / month')}
                        </li>
                        <li>
                            <strong>
                                {pricing.adminSeats}
                                {t('명', ' seats')}
                            </strong>
                            {t(' 관리자', ' administrators')}
                        </li>
                    </ul>
                    <p className="plus-checkout-caption">
                        {t('기본 인원 초과 시 1명당 월', 'Per extra staff per month')} {money(pricing.extraStaffGross)}
                    </p>
                </>
            ) : (
                <p className="plus-checkout-caption">{t('요금제 설정 중', 'Plan being configured')}</p>
            )}
        </div>
    );
}
