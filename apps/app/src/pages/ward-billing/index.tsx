import {useQuery} from '@tanstack/react-query';
import {Link, Navigate, useLocation} from 'react-router';
import useAuthStore from '@/features/auth/model/store';
import {commercialGet, commercialQueryKey, getOnlyWardScope, useCommercialContext, type Entitlement} from '@/features/commercial/api';
import {useWorkspaceNavigation} from '@/features/commercial/hospital-entry';
import {wardBillingPath, wardPaymentReturnPath} from '@/features/commercial/ward-billing-path';
import WorkspacePage, {BillingPanel, BillingReturn, PaymentReturn, UsagePanel} from '@/pages/workspace';
import {ActionsFeedback, ErrorView, useAction, useCopy} from '@/pages/workspace/workspace-ui';
import ROUTE from '@/shared/constant/path';
import PageState from '@/shared/ui/PageState';
import './ward-billing.css';

/** Keep existing bookmarks and provider return URLs, then enter the site's ward billing flow. */
export function LegacyWorkspaceRoute() {
    const location = useLocation();
    const context = useCommercialContext();
    const [type, ref, tab] = location.pathname.replace(/^\/workspace\/?/, '').split('/');
    const singleWard = !context.isError && context.data?.enabled ? getOnlyWardScope(context.data.scopes) : undefined;

    if (type === 'billing-return' || type === 'payment-return')
        return <Navigate replace to={wardPaymentReturnPath(type, location.search)} />;

    if (type === 'WARD' && ref && (!tab || tab === 'usage' || tab === 'billing'))
        return <Navigate replace to={wardBillingPath(ref, tab === 'billing' ? 'billing' : 'usage') + location.search} />;

    if (!type && singleWard && new URLSearchParams(location.search).get('choose') !== '1')
        return <Navigate replace to={wardBillingPath(singleWard.ref, 'usage')} />;

    return <WorkspacePage />;
}

export default function WardBillingPage() {
    const t = useCopy();
    const location = useLocation();
    const context = useCommercialContext();
    const accountId = useAuthStore((state) => state.accountId);
    const wardId = useAuthStore((state) => state.wardId);
    const action = useAction();
    const select = useWorkspaceNavigation();
    const [ref, view] = location.pathname.replace(/^\/billing\/?/, '').split('/');
    const callback = ref === 'billing-return' || ref === 'payment-return';
    const wards = context.data?.enabled && !context.isError ? context.data.scopes.filter((scope) => scope.type === 'WARD') : [];
    const scope = ref
        ? wards.find((ward) => String(ward.ref) === ref)
        : (wards.find((ward) => String(ward.ref) === String(wardId)) ?? getOnlyWardScope(wards));
    const selected = !!scope && String(scope.ref) === String(wardId);
    const usage = view === 'usage';
    const entitlement = useQuery({
        queryKey: commercialQueryKey(accountId, 'WARD', scope?.ref, 'entitlements'),
        queryFn: () => commercialGet<Entitlement>(`/scopes/WARD/${scope!.ref}/entitlements`),
        enabled: !callback && selected && context.data?.configurationReady !== false,
        retry: false,
        staleTime: 5000,
        refetchOnWindowFocus: 'always',
    });

    if (!ref && scope) return <Navigate replace to={wardBillingPath(scope.ref)} />;

    return (
        <div className="ward-billing-page workspace-app">
            <header className="ward-billing-page__header">
                <p>{scope?.name ?? t('내 병동', 'My ward')}</p>
                <h1>{t('요금제·결제', 'Plans & billing')}</h1>
            </header>
            {scope && !callback ? (
                <nav className="ward-billing-page__tabs" aria-label={t('요금제·결제 메뉴', 'Plans and billing navigation')}>
                    <Link to={wardBillingPath(scope.ref, 'usage')} aria-current={usage ? 'page' : undefined}>
                        {t('이용 현황', 'Usage')}
                    </Link>
                    <Link to={wardBillingPath(scope.ref)} aria-current={!usage ? 'page' : undefined}>
                        {t('구독·결제', 'Subscription & billing')}
                    </Link>
                </nav>
            ) : null}
            <div className="ward-billing-page__body">
                <ActionsFeedback action={action} />
                {callback ? (
                    ref === 'billing-return' ? (
                        <BillingReturn
                            key={accountId}
                            backPath={ROUTE.BILLING}
                            paymentReturnPath={wardPaymentReturnPath('payment-return')}
                        />
                    ) : (
                        <PaymentReturn key={accountId} backPath={ROUTE.BILLING} />
                    )
                ) : context.isPending ? (
                    <PageState tone="loading" title={t('병동 정보를 불러오는 중이에요', 'Loading your ward')} />
                ) : context.isError ? (
                    <div>
                        <ErrorView error={context.error} />
                        <button type="button" onClick={() => void context.refetch()}>
                            {t('다시 불러오기', 'Retry')}
                        </button>
                    </div>
                ) : !context.data?.enabled || context.data.configurationReady === false ? (
                    <PageState
                        tone="empty"
                        title={t('요금제를 준비하고 있어요', 'Plans are being prepared')}
                        description={t(
                            '준비가 완료되면 이용량과 구독을 확인할 수 있어요.',
                            'Usage and subscriptions will be available when configuration is complete.',
                        )}
                    />
                ) : scope && !selected ? (
                    <section className="workspace-section">
                        <h2>{scope.name}</h2>
                        <p>
                            {t(
                                '이 병동으로 전환한 뒤 요금제와 결제를 확인해 주세요.',
                                'Switch to this ward to review its plan and payments.',
                            )}
                        </p>
                        <button
                            type="button"
                            disabled={action.busy}
                            onClick={() =>
                                void action.run(() => select(scope, false, wardBillingPath(scope.ref, usage ? 'usage' : 'billing')))
                            }
                        >
                            {t('이 병동으로 전환', 'Switch to this ward')}
                        </button>
                    </section>
                ) : scope ? (
                    entitlement.isPending ? (
                        <PageState tone="loading" title={t('이용 정보를 불러오는 중이에요', 'Loading usage')} />
                    ) : entitlement.isError ? (
                        <div>
                            <ErrorView error={entitlement.error} />
                            <button type="button" onClick={() => void entitlement.refetch()}>
                                {t('다시 불러오기', 'Retry')}
                            </button>
                        </div>
                    ) : usage ? (
                        <UsagePanel
                            key={`${accountId}:${scope.scopeId}`}
                            scope={scope}
                            e={entitlement.data}
                            billingPath={wardBillingPath(scope.ref)}
                        />
                    ) : (
                        <BillingPanel
                            key={`${accountId}:${scope.scopeId}`}
                            scope={scope}
                            e={entitlement.data}
                            embedded
                            cardRegistrationVersion={context.data.cardRegistrationVersion}
                            paymentReturnPath={wardPaymentReturnPath('payment-return')}
                        />
                    )
                ) : wards.length ? (
                    <section className="workspace-section">
                        <h2>{t('결제를 관리할 병동을 선택해 주세요', 'Choose a ward')}</h2>
                        {ref ? (
                            <p>{t('요청한 병동의 관리 권한을 확인할 수 없어요.', 'Access to the requested ward could not be verified.')}</p>
                        ) : null}
                        <ul>
                            {wards.map((ward) => (
                                <li key={ward.scopeId}>
                                    <Link className="workspace-button secondary" to={wardBillingPath(ward.ref)}>
                                        {ward.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : (
                    <section className="workspace-section">
                        <h2>{t('관리할 병동이 없어요', 'No ward available')}</h2>
                        <Link className="workspace-button" to={ROUTE.ONBOARDING_WARD_CREATE}>
                            {t('새 병동 만들기', 'Create a ward')}
                        </Link>
                        <Link className="workspace-button secondary" to={ROUTE.ENTER_WARD}>
                            {t('초대 코드로 병동 참여', 'Join with an invite code')}
                        </Link>
                    </section>
                )}
            </div>
        </div>
    );
}
