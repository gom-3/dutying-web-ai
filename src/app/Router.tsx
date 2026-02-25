import {Suspense, lazy} from 'react';
import {Route, Routes} from 'react-router-dom';
import ROUTE from '@/shared/constant/path.ts';
import {AuthLayout, MainLayout, NotAuthLayout} from '@/widgets/layouts';

const LandingPage = lazy(() => import('@/pages/LandingPage/index.ts'));
const RefreshPage = lazy(() => import('@/pages/RefreshPage/index.tsx'));
const RedirectPage = lazy(() => import('@/pages/LoginPage/RedirectPage.tsx'));
const LoginPage = lazy(() => import('@/pages/LoginPage/index.tsx'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage/index.tsx'));
const EnterWard = lazy(() => import('@/pages/RegisterPage/ui/EnterWard.tsx'));
const RegisterWard = lazy(() => import('@/pages/RegisterPage/ui/RegisterWard.tsx'));
const MakeShiftPage = lazy(() => import('@/pages/make-shift'));
const DutyPage = lazy(() => import('@/pages/duty'));
const RequestShiftPage = lazy(() => import('@/pages/RequestShiftPage/index.tsx'));
const MemberPage = lazy(() => import('@/pages/MemberPage/index.tsx'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage/index.tsx'));

export const Router = () => {
    return (
        <Suspense fallback={<div></div>}>
            <Routes>
                <Route path={ROUTE.ROOT} element={<LandingPage />} />
                <Route path={ROUTE.REFRESH} element={<RefreshPage />} />
                {/* 인증된 사용자가 접근할 수 없는 페이지 */}
                <Route element={<NotAuthLayout />}>
                    <Route path={ROUTE.REDIRECT} element={<RedirectPage />} />
                    <Route path={ROUTE.LOGIN} element={<LoginPage />} />
                </Route>
                {/* 인증되지 않은 사용자가 접근할 수 없는 페이지 */}
                <Route element={<AuthLayout />}>
                    <Route path={ROUTE.REGISTER} element={<RegisterPage />} />
                    <Route path={ROUTE.ENTER_WARD} element={<EnterWard />} />
                    <Route path={ROUTE.REGISTER_WARD} element={<RegisterWard />} />
                    <Route element={<MainLayout />}>
                        <Route path={ROUTE.MAKE} element={<MakeShiftPage />} />
                        <Route path={ROUTE.DUTY} element={<DutyPage />} />
                        <Route path={ROUTE.REQUEST} element={<RequestShiftPage />} />
                        <Route path={ROUTE.MEMBER} element={<MemberPage />} />
                        <Route path={ROUTE.PROFILE} element={<ProfilePage />} />
                    </Route>
                </Route>
            </Routes>
        </Suspense>
    );
};
