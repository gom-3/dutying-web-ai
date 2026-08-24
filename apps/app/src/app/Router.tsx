import {Suspense, lazy} from 'react';
import {Navigate, Route, Routes} from 'react-router-dom';
import RedirectPage from '@/pages/login/redirect-page.tsx';
import ROUTE from '@/shared/constant/path.ts';
import {usePhoneDevice} from '@/shared/hook/use-phone-device';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import PageState from '@/shared/ui/PageState';
import {AuthLayout, MainLayout, NotAuthLayout} from '@/widgets/layouts';

const LandingPage = lazy(() => import('@/pages/landing'));
const FriendInvitePage = lazy(() => import('@/pages/friend-invite'));
const RefreshPage = lazy(() => import('@/pages/refresh'));
const MaintenancePage = lazy(() => import('@/pages/service-status').then((module) => ({default: module.MaintenancePage})));
const RenewalPage = lazy(() => import('@/pages/service-status').then((module) => ({default: module.RenewalPage})));
const UiPreviewPage = lazy(() => import('@/pages/ui-preview'));
const LoginPage = lazy(() => import('@/pages/login'));
const RegisterPage = lazy(() => import('@/pages/register'));
const EnterWard = lazy(() => import('@/pages/register/enter-ward-page.tsx'));
const RegisterWard = lazy(() => import('@/pages/register/register-ward-page.tsx'));
const OnboardingPage = lazy(() => import('@/pages/onboarding'));
const OnboardingWardCreatePage = lazy(() => import('@/pages/onboarding-ward-create'));
const HomePage = lazy(() => import('@/pages/home'));
const MakeShiftPage = lazy(() => import('@/pages/make-shift'));
const DutyPage = lazy(() => import('@/pages/duty'));
const RequestShiftPage = lazy(() => import('@/pages/request-shift'));
const BoardPage = lazy(() => import('@/pages/board'));
const MemberPage = lazy(() => import('@/pages/member'));
const WardSettingsPage = lazy(() => import('@/pages/ward-settings'));
const WardAdminsPage = lazy(() => import('@/pages/ward-admins'));
const WardInfoSettingsPage = lazy(() => import('@/pages/ward-info-settings'));
const ProfilePage = lazy(() => import('@/pages/profile'));
const DutyingPage = lazy(() => import('@/pages/dutying'));
const DutyingNoticesPage = lazy(() => import('@/pages/dutying/notices'));
const DutyingNoticeDetailPage = lazy(() => import('@/pages/dutying/notice-detail'));
const NotFoundPage = lazy(() => import('@/pages/error').then((module) => ({default: module.NotFoundPage})));

export const Router = () => {
    const {t} = useTypedTranslation();
    const isPhoneDevice = usePhoneDevice();

    if (isPhoneDevice) {
        return (
            <Suspense
                fallback={
                    <PageState
                        tone="loading"
                        layout="screen"
                        title={t('page.state.loadingTitle')}
                        description={t('page.state.loadingDescription')}
                    />
                }
            >
                <Routes>
                    <Route path={ROUTE.ROOT} element={<LandingPage />} />
                    <Route path={ROUTE.FRIEND_INVITE} element={<FriendInvitePage />} />
                    <Route path={ROUTE.MAINTENANCE} element={<MaintenancePage />} />
                    <Route path={ROUTE.RENEWAL} element={<RenewalPage />} />
                    <Route path="*" element={<Navigate to={ROUTE.ROOT} replace />} />
                </Routes>
            </Suspense>
        );
    }

    return (
        <Suspense
            fallback={
                <PageState
                    tone="loading"
                    layout="screen"
                    title={t('page.state.loadingTitle')}
                    description={t('page.state.loadingDescription')}
                />
            }
        >
            <Routes>
                <Route path={ROUTE.ROOT} element={<LandingPage />} />
                <Route path={ROUTE.FRIEND_INVITE} element={<FriendInvitePage />} />
                <Route path={ROUTE.REFRESH} element={<RefreshPage />} />
                <Route path={ROUTE.MAINTENANCE} element={<MaintenancePage />} />
                <Route path={ROUTE.RENEWAL} element={<RenewalPage />} />
                <Route path={ROUTE.REDIRECT} element={<RedirectPage />} />
                {import.meta.env.DEV ? <Route path={ROUTE.UI_PREVIEW} element={<UiPreviewPage />} /> : null}
                {/* 인증된 사용자가 접근할 수 없는 페이지 */}
                <Route element={<NotAuthLayout />}>
                    <Route path={ROUTE.LOGIN} element={<LoginPage />} />
                    <Route path={ROUTE.SIGN_UP} element={<LoginPage />} />
                </Route>
                {/* 인증되지 않은 사용자가 접근할 수 없는 페이지 */}
                <Route element={<AuthLayout />}>
                    <Route path={ROUTE.REGISTER} element={<RegisterPage />} />
                    <Route path={ROUTE.ENTER_WARD} element={<EnterWard />} />
                    <Route path={ROUTE.REGISTER_WARD} element={<RegisterWard />} />
                    <Route path={ROUTE.ONBOARDING} element={<OnboardingPage />} />
                    <Route path={ROUTE.ONBOARDING_WARD_CREATE} element={<OnboardingWardCreatePage />} />
                    <Route element={<MainLayout />}>
                        <Route path={ROUTE.HOME} element={<HomePage />} />
                        <Route path={ROUTE.MAKE} element={<MakeShiftPage />} />
                        <Route path={ROUTE.DUTY} element={<DutyPage />} />
                        <Route path={ROUTE.REQUEST} element={<RequestShiftPage />} />
                        <Route path={ROUTE.BOARD} element={<BoardPage />} />
                        <Route path={ROUTE.MEMBER} element={<MemberPage />} />
                        <Route path={ROUTE.WARD_SETTINGS} element={<WardSettingsPage />} />
                        <Route path={ROUTE.WARD_ADMINS} element={<WardAdminsPage />} />
                        <Route path={ROUTE.WARD_INFO_SETTINGS} element={<WardInfoSettingsPage />} />
                        <Route path={ROUTE.PROFILE} element={<ProfilePage />} />
                        <Route path={ROUTE.DUTYING} element={<DutyingPage />} />
                        <Route path={ROUTE.DUTYING_NOTICES} element={<DutyingNoticesPage />} />
                        <Route path={ROUTE.DUTYING_NOTICE_DETAIL} element={<DutyingNoticeDetailPage />} />
                    </Route>
                </Route>
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </Suspense>
    );
};
