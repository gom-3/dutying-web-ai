import {cn} from '@dutying/utils/style';
import {Eye, EyeOff, Loader2, Lock, UserRound} from 'lucide-react';
import {type FormEvent, useState} from 'react';
import {Carousel} from 'react-responsive-carousel';
import {Link, useLocation, useNavigate} from 'react-router';
import useAuth from '@/features/auth';
import {getIsDemoSignupLoginReason} from '@/features/auth/model/demo-session';
import {AuthAPI} from '@/shared/api';
import {AppleIcon, BackCircle, FullLogo, KakaoIcon, LogoSymbolFill, NextCircle} from '@/shared/assets/svg';
import {buildAuthAuthorizeUrl, RUNTIME_CONFIG, sanitizeInternalPath} from '@/shared/config/runtime';
import ROUTE from '@/shared/constant/path';
import 'react-responsive-carousel/lib/styles/carousel.min.css';
import './index.css';

type TSignupErrors = Partial<Record<'loginId' | 'password' | 'passwordConfirm', string>>;

const FIELD_CLASS =
    'h-11 w-full rounded-[12px] border border-transparent bg-gray-7 px-3.5 text-[15px] font-medium text-sub-1 outline-none transition-colors placeholder:text-gray-4 focus-visible:bg-main-light';
const PASSWORD_MIN_LENGTH = 8;
const LOGIN_ID_PATTERN = /^[A-Za-z0-9._-]{4,40}$/;
const getInputClassName = (hasError: boolean) => cn(FIELD_CLASS, hasError && 'border-red bg-[#FFF7F8] focus-visible:bg-white');
const PasswordVisibilityButton = ({visible, onClick}: {visible: boolean; onClick: () => void}) => (
    <button
        type="button"
        className="absolute top-1/2 right-3 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-gray-4 transition-colors hover:bg-gray-6 hover:text-sub-1"
        onClick={onClick}
        aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
        title={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
    >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
);
const FieldError = ({id, message}: {id: string; message?: string}) =>
    message ? (
        <p id={id} className="mt-1 text-xs text-red">
            {message}
        </p>
    ) : null;

function LoginPage() {
    const navigate = useNavigate();
    const {pathname, search} = useLocation();
    const {
        actions: {handleDevSignupBypass, handleLogin},
    } = useAuth();
    const params = new URLSearchParams(search);
    const nextPath = sanitizeInternalPath(params.get('next'), ROUTE.MAKE);
    const isDemoSignupFlow = getIsDemoSignupLoginReason(search);
    const isSignupPage = pathname === ROUTE.SIGN_UP;
    const canUseDevSignupBypass = import.meta.env.DEV && isSignupPage;
    const [loginId, setLoginId] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [signupLoginId, setSignupLoginId] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);
    const [signupErrors, setSignupErrors] = useState<TSignupErrors>({});
    const [signupError, setSignupError] = useState<string | null>(null);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isLoginDisabled = !loginId.trim() || !loginPassword || isSubmitting;
    const isSignupDisabled = !signupLoginId.trim() || !signupPassword || !signupPasswordConfirm || isSubmitting;
    const title = isSignupPage ? '\ud68c\uc6d0\uac00\uc785' : '\ub85c\uadf8\uc778';
    const validateSignup = () => {
        const nextErrors: TSignupErrors = {};

        if (!LOGIN_ID_PATTERN.test(signupLoginId.trim())) {
            nextErrors.loginId = '아이디는 영문, 숫자, 점, 밑줄, 하이픈으로 4자 이상 입력해 주세요.';
        }

        if (signupPassword.length < PASSWORD_MIN_LENGTH) {
            nextErrors.password = `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.`;
        }

        if (signupPassword !== signupPasswordConfirm) {
            nextErrors.passwordConfirm = '비밀번호가 서로 달라요.';
        }

        setSignupErrors(nextErrors);

        return Object.keys(nextErrors).length === 0;
    };
    const handlePasswordLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoginError(null);

        if (!loginId.trim() || !loginPassword) {
            setLoginError('아이디와 비밀번호를 입력해 주세요.');

            return;
        }

        setIsSubmitting(true);

        try {
            const response = await AuthAPI.passwordLogin({
                loginId: loginId.trim(),
                password: loginPassword,
            });

            handleLogin(response.accessToken, nextPath);
        } catch (error) {
            setLoginError(error instanceof Error ? error.message : '로그인하지 못했어요. 다시 시도해 주세요.');
        } finally {
            setIsSubmitting(false);
        }
    };
    const handlePasswordSignup = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSignupError(null);

        if (!validateSignup()) {
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await AuthAPI.passwordSignup({
                loginId: signupLoginId.trim(),
                password: signupPassword,
            });

            handleLogin(response.accessToken, ROUTE.ONBOARDING);
        } catch (error) {
            setSignupError(error instanceof Error ? error.message : '가입을 완료하지 못했어요. 다시 시도해 주세요.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen w-screen bg-white">
            <div className="hidden h-screen w-[calc(100vh/1080*1140)] min-w-0 shrink xl:block">
                <Carousel
                    autoPlay
                    infiniteLoop
                    dynamicHeight
                    stopOnHover
                    showArrows
                    interval={3000}
                    showIndicators={false}
                    showThumbs={false}
                    statusFormatter={(current, total) => `${current} / ${total}`}
                    renderArrowPrev={(click) => (
                        <BackCircle
                            className="absolute top-[50%] left-20 z-10 h-13 w-13 translate-y-[-50%] cursor-pointer"
                            onClick={click}
                        />
                    )}
                    renderArrowNext={(click) => (
                        <NextCircle
                            className="absolute top-[50%] right-20 z-10 h-13 w-13 translate-y-[-50%] cursor-pointer"
                            onClick={click}
                        />
                    )}
                >
                    <div className='h-screen w-full min-w-px bg-[url("/img/login_1.webp")] bg-cover bg-center'></div>
                    <div className='h-screen w-full min-w-px bg-[url("/img/login_2.webp")] bg-cover bg-center'></div>
                    <div className='h-screen w-full min-w-px bg-[url("/img/login_3.webp")] bg-cover bg-center'></div>
                </Carousel>
            </div>

            <div className="z-10 flex min-h-screen min-w-0 flex-1 shrink-0 flex-col items-center bg-white px-5 py-10 md:px-16 xl:px-26.25">
                <button type="button" className="flex cursor-pointer items-center" onClick={() => navigate(ROUTE.ROOT)}>
                    <LogoSymbolFill className="mr-4 h-10 w-10 md:mr-[2.3438rem] md:h-12.5 md:w-[2.9688rem]" />
                    <FullLogo className="h-10 w-36 md:h-12.5 md:w-45.25" />
                </button>

                <div className={`mt-10 w-full ${isSignupPage ? 'max-w-[560px]' : 'max-w-[480px]'} md:mt-16`}>
                    {isDemoSignupFlow ? (
                        <div className="mb-6 rounded-[16px] border border-main-3/40 bg-main-light px-5 py-4">
                            <p className="font-apple text-sm font-semibold text-main-1">체험 계정을 정식 계정으로 전환해요</p>
                            <p className="mt-1 font-apple text-sm leading-6 text-sub-2.5">
                                계정을 만든 뒤 새 병동을 만들면 이후에도 데이터를 이어서 관리할 수 있어요.
                            </p>
                        </div>
                    ) : null}

                    <div className="mx-auto mt-7 w-[334px] text-center">
                        <h1 className="font-apple text-[32px] font-semibold text-text-1">{title}</h1>
                    </div>

                    {!isSignupPage ? (
                        <form onSubmit={handlePasswordLogin} className="mx-auto mt-7 w-[334px] space-y-4">
                            <div>
                                <label htmlFor="login-id" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    아이디
                                </label>
                                <div className="relative">
                                    <UserRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-4" />
                                    <input
                                        id="login-id"
                                        value={loginId}
                                        className={`${FIELD_CLASS} pl-9`}
                                        placeholder="아이디를 입력하세요"
                                        autoComplete="username"
                                        onChange={(event) => setLoginId(event.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    비밀번호
                                </label>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-4" />
                                    <input
                                        id="login-password"
                                        value={loginPassword}
                                        type={isPasswordVisible ? 'text' : 'password'}
                                        className={`${FIELD_CLASS} px-9`}
                                        placeholder="비밀번호를 입력하세요"
                                        autoComplete="current-password"
                                        onChange={(event) => setLoginPassword(event.target.value)}
                                    />
                                    <PasswordVisibilityButton
                                        visible={isPasswordVisible}
                                        onClick={() => setIsPasswordVisible((visible) => !visible)}
                                    />
                                </div>
                            </div>
                            {loginError ? (
                                <p role="alert" className="rounded-[12px] bg-[#FFF7F8] px-3 py-2 text-sm text-red">
                                    {loginError}
                                </p>
                            ) : null}
                            <button
                                type="submit"
                                disabled={isLoginDisabled}
                                className="mx-auto flex h-[44px] w-[334px] cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[1px] border-main-1 bg-main-1 px-[12px] text-sm font-semibold text-white transition-colors hover:bg-[#5832E7] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-gray-6 disabled:text-gray-3"
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                로그인
                            </button>
                            <p className="text-center text-sm text-gray-3">
                                아직 계정이 없나요?{' '}
                                <Link to={ROUTE.SIGN_UP} className="font-semibold text-main-1 underline underline-offset-[3px]">
                                    회원가입
                                </Link>
                            </p>
                        </form>
                    ) : (
                        <form onSubmit={handlePasswordSignup} className="mx-auto mt-7 w-[334px] space-y-4">
                            <div>
                                <label htmlFor="signup-id" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    아이디
                                </label>
                                <input
                                    id="signup-id"
                                    value={signupLoginId}
                                    className={getInputClassName(Boolean(signupErrors.loginId))}
                                    placeholder="아이디를 입력해 주세요"
                                    autoComplete="username"
                                    onChange={(event) => setSignupLoginId(event.target.value)}
                                    aria-invalid={Boolean(signupErrors.loginId)}
                                    aria-describedby={signupErrors.loginId ? 'signup-id-error' : undefined}
                                />
                                <FieldError id="signup-id-error" message={signupErrors.loginId} />
                            </div>

                            <div>
                                <label htmlFor="signup-password" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    비밀번호
                                </label>
                                <input
                                    id="signup-password"
                                    value={signupPassword}
                                    type="password"
                                    className={getInputClassName(Boolean(signupErrors.password))}
                                    placeholder="비밀번호를 입력해 주세요"
                                    autoComplete="new-password"
                                    onChange={(event) => setSignupPassword(event.target.value)}
                                    aria-invalid={Boolean(signupErrors.password)}
                                    aria-describedby={signupErrors.password ? 'signup-password-error' : undefined}
                                />
                                <FieldError id="signup-password-error" message={signupErrors.password} />
                            </div>

                            <div>
                                <label htmlFor="signup-password-confirm" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    비밀번호 확인
                                </label>
                                <input
                                    id="signup-password-confirm"
                                    value={signupPasswordConfirm}
                                    type="password"
                                    className={getInputClassName(Boolean(signupErrors.passwordConfirm))}
                                    placeholder="비밀번호를 다시 입력해 주세요"
                                    autoComplete="new-password"
                                    onChange={(event) => setSignupPasswordConfirm(event.target.value)}
                                    aria-invalid={Boolean(signupErrors.passwordConfirm)}
                                    aria-describedby={signupErrors.passwordConfirm ? 'signup-password-confirm-error' : undefined}
                                />
                                <FieldError id="signup-password-confirm-error" message={signupErrors.passwordConfirm} />
                            </div>

                            {signupError ? (
                                <p role="alert" className="rounded-[12px] bg-[#FFF7F8] px-3 py-2 text-sm text-red">
                                    {signupError}
                                </p>
                            ) : null}

                            <button
                                type="submit"
                                disabled={isSignupDisabled}
                                className="mx-auto flex h-[44px] w-[334px] cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[1px] border-main-1 bg-main-1 px-[12px] text-sm font-semibold text-white transition-colors hover:bg-[#5832E7] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-gray-6 disabled:text-gray-3"
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                계정 만들기
                            </button>
                            <p className="text-center text-sm text-gray-3">
                                이미 계정이 있나요?{' '}
                                <Link to={ROUTE.SIGN_IN} className="font-semibold text-main-1 underline underline-offset-[3px]">
                                    로그인
                                </Link>
                            </p>
                        </form>
                    )}

                    <div className="mx-auto mt-7 w-[334px] border-t border-gray-6 pt-6">
                        <div className="grid grid-cols-1 gap-3">
                            <a
                                href={buildAuthAuthorizeUrl('kakao', isSignupPage ? ROUTE.ONBOARDING : nextPath)}
                                className="mx-auto flex h-[44px] w-[334px] items-center justify-center rounded-[12px] border border-[1px] border-[#F2D600] bg-[#FEE500] px-[12px] text-sm font-semibold text-sub-1 shadow-banner"
                            >
                                <KakaoIcon className="mr-3 h-5 w-5" />
                                {isSignupPage ? '카카오로 시작하기' : '카카오로 계속하기'}
                            </a>
                            {canUseDevSignupBypass ? (
                                <button
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={handleDevSignupBypass}
                                    className="mx-auto flex h-[44px] w-[334px] cursor-pointer items-center justify-center rounded-[12px] border border-dashed border-gray-6 bg-white px-[12px] text-sm font-semibold text-gray-3 transition-colors hover:bg-gray-7 disabled:cursor-not-allowed disabled:text-gray-4"
                                >
                                    DEV: skip Kakao signup
                                </button>
                            ) : null}
                            <a
                                href={buildAuthAuthorizeUrl('apple', isSignupPage ? ROUTE.ONBOARDING : nextPath)}
                                className="mx-auto flex h-[44px] w-[334px] items-center justify-center rounded-[12px] border border-[1px] border-[#231F20] bg-[#231F20] px-[12px] text-sm font-semibold text-white shadow-banner"
                            >
                                <AppleIcon className="mr-3 h-5 w-5" />
                                {isSignupPage ? 'Apple로 시작하기' : 'Apple로 계속하기'}
                            </a>
                        </div>
                    </div>
                </div>

                <div className="mt-auto flex flex-wrap justify-center gap-x-2 gap-y-1 pt-8 font-apple text-sm text-sub-3">
                    <span>계속하면</span>
                    <a href={RUNTIME_CONFIG.docs.termsOfService} className="underline underline-offset-[3px]">
                        서비스 약관
                    </a>
                    <span>및</span>
                    <a href={RUNTIME_CONFIG.docs.privacyPolicy} className="underline underline-offset-[3px]">
                        개인정보 처리방침
                    </a>
                    <span>에 동의한 것으로 간주합니다.</span>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
