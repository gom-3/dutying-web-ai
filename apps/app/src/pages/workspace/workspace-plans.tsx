import {cn} from '@dutying/utils/style';
import {useQuery} from '@tanstack/react-query';
import {useId} from 'react';
import {Link} from 'react-router';
import useAuthStore from '@/features/auth/model/store';
import {commercialError, commercialGet, commercialQueryKey, type Policy} from '@/features/commercial/api';
import {ChannelTalkLink} from '@/shared/ui/channel-talk-link';
import {InfoTip} from './info-tip';
import {useCopy} from './workspace-ui';
import './workspace-plans.css';

type TCatalogPlan = {
    id: string;
    plan?: string;
    displayName?: string;
    config?: Policy | null;
    configured?: boolean;
    source?: 'POLICY' | 'LEGACY' | 'UNCONFIGURED';
};
type TConfiguredPlan = TCatalogPlan & {config: Policy};
type TCopy = ReturnType<typeof useCopy>;

const planOrder = ['FREE', 'PLUS', 'HOSPITAL'];
const quantity = (value: number, t: TCopy) =>
    Number.isFinite(value) && value >= 0 ? new Intl.NumberFormat('ko-KR').format(value) : t('확인 필요', 'Check details');
const price = (value: number, t: TCopy) =>
    Number.isFinite(value) && value >= 0
        ? `${new Intl.NumberFormat('ko-KR').format(value)}${t('원', ' KRW')}`
        : t('요금 확인 필요', 'Price unavailable');
const canonicalNames: Record<string, string[]> = {FREE: ['free', '무료'], PLUS: ['plus'], HOSPITAL: ['hospital', '병원']};
const name = (plan: string, t: TCopy, displayName?: string) => {
    const label = displayName?.trim();

    if (label && !canonicalNames[plan]?.includes(label.toLowerCase())) return label;

    return plan === 'FREE' ? t('무료', 'Free') : plan === 'HOSPITAL' ? t('병원', 'Hospital') : 'Plus';
};
const catalogPlanName = (plan: TCatalogPlan) => plan.plan ?? plan.config?.plan ?? plan.id;

function UnconfiguredPlanCard({plan, displayName}: {plan: string; displayName?: string}) {
    const t = useCopy();

    return (
        <article className="workspace-plans-card workspace-plans-card-unconfigured">
            <header>
                <h3>{name(plan, t, displayName)}</h3>
            </header>
            <div className="workspace-plans-unavailable">
                <strong>{t('요금제 설정 중', 'Plan being configured')}</strong>
                <p>{t('요금과 제공량이 준비되면 안내됩니다.', 'Prices and allowances will appear when available.')}</p>
            </div>
            <span className="workspace-plans-action workspace-plans-action-disabled" aria-disabled="true">
                {t('준비 중', 'Not available yet')}
            </span>
        </article>
    );
}

function PlanCard({policy, displayName}: {policy: Policy; displayName?: string}) {
    const t = useCopy();
    const hospital = policy.plan === 'HOSPITAL';
    const free = policy.plan === 'FREE';
    const period = free ? t('처음 한 번 제공', 'Granted once') : t('매월 제공', 'Included each month');
    const purpose = hospital
        ? t('여러 병동을 병원 단위로 함께 관리', 'Manage multiple wards together')
        : free
          ? t('직접 근무표를 만들고 기본 AI 시작', 'Build schedules and try the core AI tools')
          : t('한 병동에서 AI로 근무표를 꾸준히 작성', 'Create your ward’s schedules regularly with AI');

    return (
        <article className={cn('workspace-plans-card', policy.plan === 'PLUS' && 'workspace-plans-card-plus')}>
            <header>
                <h3>{name(policy.plan, t, displayName)}</h3>
                <p className="workspace-plans-purpose">{purpose}</p>
            </header>
            <div className="workspace-plans-price">
                <span>{t('월 기본료', 'Monthly base')}</span>
                <strong>{price(policy.baseGross, t)}</strong>
                <span>{t('부가세 포함', 'VAT included')}</span>
            </div>
            <dl className="workspace-plans-facts">
                <div>
                    <dt>
                        {t('기본 편성 인원', 'Included staff')}
                        <InfoTip label={t('편성 인원 안내', 'About staff capacity')}>
                            {t(
                                '근무표에 편성하는 인원입니다. 서비스를 관리하는 관리자 계정 수와는 다릅니다.',
                                'Staff are people included in schedules. Administrator accounts are counted separately.',
                            )}
                        </InfoTip>
                    </dt>
                    <dd>
                        {quantity(policy.includedStaff, t)}
                        {t('명', ' staff')}
                    </dd>
                </div>
                <div className="workspace-plans-ai-period">
                    <dt>{t('AI 제공 주기', 'AI allowance period')}</dt>
                    <dd>{period}</dd>
                </div>
                <div>
                    <dt>{t('전체 생성', 'Full generation')}</dt>
                    <dd>
                        {quantity(policy.generate, t)}
                        {t('회', ' uses')}
                    </dd>
                </div>
                <div>
                    <dt>{t('부분 조정', 'Partial adjustment')}</dt>
                    <dd>
                        {quantity(policy.adjust, t)}
                        {t('회', ' uses')}
                    </dd>
                </div>
            </dl>
            <p className="workspace-plans-card-note">
                {hospital
                    ? t('계약 인원에 따라 요금·AI 제공량이 달라집니다.', 'Price and AI allowance depend on contracted capacity.')
                    : free
                      ? t('월 이용료 없이 시작할 수 있어요.', 'Start without a monthly subscription fee.')
                      : t('선택한 병동의 결제 메뉴에서 구독하세요.', 'Subscribe from your ward’s Billing menu.')}
            </p>
            {hospital ? (
                <ChannelTalkLink className="workspace-plans-action workspace-plans-action-tonal">
                    {t('병원 도입 문의', 'Ask about hospital adoption')}
                </ChannelTalkLink>
            ) : (
                <Link className={cn('workspace-plans-action', free && 'workspace-plans-action-tonal')} to="/workspace">
                    {free ? t('병동 선택하기', 'Choose a ward') : t('Plus 사용할 병동 선택', 'Choose a ward for Plus')}
                </Link>
            )}
        </article>
    );
}

function PlanComparison({plans}: {plans: TConfiguredPlan[]}) {
    const t = useCopy();
    const feature = (included: boolean) => (included ? t('포함', 'Included') : t('기존 자료 유지', 'Existing records retained'));

    return (
        <details className="workspace-plans-comparison">
            <summary>
                {t('세부 기능 비교', 'Compare all features')}
                <span aria-hidden="true" className="workspace-plans-disclosure-icon" />
            </summary>
            <div className="workspace-plans-comparison-grid">
                {plans.map(({id, config: p, displayName}) => (
                    <section
                        key={id}
                        aria-label={t(`${name(p.plan, t, displayName)} 세부 기능`, `${name(p.plan, t, displayName)} details`)}
                    >
                        <h3>{name(p.plan, t, displayName)}</h3>
                        <dl>
                            <div>
                                <dt>{t('추가 편성 인원 1명 / 월', 'Extra staff / month')}</dt>
                                <dd>{p.plan === 'FREE' ? t('인원 증설 없음', 'No extra capacity') : price(p.extraStaffGross, t)}</dd>
                            </div>
                            <div>
                                <dt>{t('관리자 계정', 'Administrator accounts')}</dt>
                                <dd>
                                    {quantity(p.adminSeats, t)}
                                    {t('명', ' accounts')}
                                </dd>
                            </div>
                            <div>
                                <dt>{t('새 신청 작성', 'Create requests')}</dt>
                                <dd>{feature(p.features?.REQUEST_CREATE === true)}</dd>
                            </div>
                            <div>
                                <dt>{t('새 게시글 작성', 'Create posts')}</dt>
                                <dd>{feature(p.features?.BOARD_CREATE === true)}</dd>
                            </div>
                            <div>
                                <dt>{t('병원 통합 현황', 'Hospital overview')}</dt>
                                <dd>{p.features?.HOSPITAL_OVERVIEW === true ? t('포함', 'Included') : t('미포함', 'Not included')}</dd>
                            </div>
                            <div>
                                <dt>{t('초기 세팅 지원', 'Initial setup support')}</dt>
                                <dd>{p.plan === 'HOSPITAL' ? t('별도 견적', 'Quoted separately') : t('직접 설정', 'Self setup')}</dd>
                            </div>
                        </dl>
                    </section>
                ))}
            </div>
        </details>
    );
}

/** Keep the existing account-scoped catalogue contract; checkout always happens in a selected ward. */
export function Plans() {
    const t = useCopy();
    const heading = useId();
    const accountId = useAuthStore((state) => state.accountId);
    const q = useQuery({
        queryKey: commercialQueryKey(accountId, 'plans'),
        queryFn: () => commercialGet<TCatalogPlan[]>('/plans'),
        enabled: accountId !== null,
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: 'always',
    });
    const catalog = (q.data ?? []).filter((plan) => planOrder.includes(catalogPlanName(plan)));
    const plans = planOrder.flatMap((plan) => {
        const entry = catalog.find(
            (entry): entry is TConfiguredPlan => catalogPlanName(entry) === plan && Boolean(entry.config) && entry.configured !== false,
        );

        return entry ? [entry] : [];
    });

    return (
        <section className="workspace-plans" aria-labelledby={heading}>
            <header className="workspace-plans-heading">
                <div>
                    <h2 id={heading}>{t('병동·병원별 요금제', 'Ward and hospital plans')}</h2>
                    <p>
                        {t(
                            '운영하는 병동의 규모와 필요한 AI에 맞게 선택하세요.',
                            'Choose the staff capacity and AI allowance your ward needs.',
                        )}
                    </p>
                </div>
                <InfoTip label={t('요금제 이용 안내', 'About plans')}>
                    {t(
                        '표시된 금액은 부가세 포함 월 기본료입니다. 추가 인원과 초기 세팅 비용은 별도이며, 결제 전 해당 병동의 최종 견적을 확인할 수 있습니다. 관리자 계정 수와 근무표 편성 인원은 별도로 계산합니다.',
                        'Monthly base prices include VAT. Extra staff and initial setup may cost more. Review the final quote in your ward before paying. Administrator accounts and scheduling staff are counted separately.',
                    )}
                </InfoTip>
            </header>
            {q.isPending ? (
                <div className="workspace-plans-state" role="status">
                    {accountId === null
                        ? t('로그인 정보를 확인하고 있습니다.', 'Checking your account…')
                        : t('요금제를 불러오는 중입니다.', 'Loading plans…')}
                </div>
            ) : null}
            {q.isError ? (
                <div className="workspace-plans-state workspace-plans-state-error" role="alert">
                    <h3>{t('요금제를 불러오지 못했습니다', 'Unable to load plans')}</h3>
                    <p>{commercialError(q.error)}</p>
                    <button
                        className="workspace-plans-action workspace-plans-action-tonal"
                        type="button"
                        disabled={q.isFetching}
                        onClick={() => void q.refetch()}
                    >
                        {t('다시 불러오기', 'Try again')}
                    </button>
                </div>
            ) : null}
            {q.isSuccess && !catalog.length ? (
                <div className="workspace-plans-state">
                    <h3>{t('현재 안내할 요금제가 없습니다', 'No plans are available yet')}</h3>
                    <p>{t('요금제가 준비되면 이곳에 안내됩니다.', 'Available plans will appear here.')}</p>
                    <button
                        className="workspace-plans-action workspace-plans-action-tonal"
                        type="button"
                        disabled={q.isFetching}
                        onClick={() => void q.refetch()}
                    >
                        {t('다시 확인하기', 'Check again')}
                    </button>
                </div>
            ) : null}
            {q.isSuccess && catalog.length ? (
                <>
                    <div className="workspace-plans-grid">
                        {planOrder.map((plan) => {
                            const configured = plans.find((entry) => catalogPlanName(entry) === plan);

                            return configured ? (
                                <PlanCard key={plan} policy={configured.config} displayName={configured.displayName} />
                            ) : (
                                <UnconfiguredPlanCard
                                    key={plan}
                                    plan={plan}
                                    displayName={catalog.find((entry) => catalogPlanName(entry) === plan)?.displayName}
                                />
                            );
                        })}
                    </div>
                    {plans.length ? <PlanComparison plans={plans} /> : null}
                </>
            ) : null}
        </section>
    );
}
