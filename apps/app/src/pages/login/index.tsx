import {cn} from '@dutying/utils/style';
import {ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, Lock, Mail} from 'lucide-react';
import {type FormEvent, useCallback, useEffect, useRef, useState} from 'react';
import {Link, useLocation, useNavigate} from 'react-router';
import useAuth from '@/features/auth';
import {getIsDemoSignupLoginReason} from '@/features/auth/model/demo-session';
import {buildSocialSignupRegisterPath} from '@/features/auth/model/social-signup';
import {AuthAPI} from '@/shared/api';
import {AppleIcon, KakaoIcon} from '@/shared/assets/svg';
import {buildAuthAuthorizeUrl, sanitizeInternalPath} from '@/shared/config/runtime';
import ROUTE from '@/shared/constant/path';
import './index.css';

type TSignupErrors = Partial<Record<'name' | 'email' | 'password' | 'passwordConfirm', string>>;
type TPasswordResetErrors = Partial<Record<'email' | 'resetToken' | 'newPassword' | 'newPasswordConfirm', string>>;

const FIELD_CLASS =
    'h-11 w-full rounded-[12px] border border-transparent bg-gray-7 px-3.5 text-[15px] font-medium text-sub-1 outline-none transition-colors placeholder:text-gray-4 focus-visible:bg-main-light';
const PASSWORD_MIN_LENGTH = 8;
const EMAIL_VERIFICATION_CODE_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_VISUAL_SLIDES = ['/img/login-slide-1.png', '/img/login-slide-2.png', '/img/login-slide-3.png'];
const LOGIN_VISUAL_AUTO_ROTATE_MS = 4000;
const LOGIN_VISUAL_MANUAL_RESUME_MS = 3000;
const INVALID_LOGIN_CREDENTIALS_MESSAGE = '아이디 또는 비밀번호가 올바르지 않습니다.';
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
        actions: {handleLogin},
    } = useAuth();
    const params = new URLSearchParams(search);
    const nextPath = sanitizeInternalPath(params.get('next'), ROUTE.MAKE);
    const isDemoSignupFlow = getIsDemoSignupLoginReason(search);
    const isSignupPage = pathname === ROUTE.SIGN_UP;
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [signupName, setSignupName] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupEmailVerificationToken, setSignupEmailVerificationToken] = useState<string | null>(null);
    const [signupPassword, setSignupPassword] = useState('');
    const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);
    const [loginNotice, setLoginNotice] = useState<string | null>(null);
    const [signupErrors, setSignupErrors] = useState<TSignupErrors>({});
    const [signupError, setSignupError] = useState<string | null>(null);
    const [signupVerificationMessage, setSignupVerificationMessage] = useState<string | null>(null);
    const [signupVerificationError, setSignupVerificationError] = useState<string | null>(null);
    const [signupVerificationCode, setSignupVerificationCode] = useState('');
    const [hasRequestedSignupVerification, setHasRequestedSignupVerification] = useState(false);
    const [isSignupEmailVerified, setIsSignupEmailVerified] = useState(false);
    const [isPasswordResetMode, setIsPasswordResetMode] = useState(false);
    const [passwordResetEmail, setPasswordResetEmail] = useState('');
    const [passwordResetToken, setPasswordResetToken] = useState<string | null>(null);
    const [passwordResetCode, setPasswordResetCode] = useState('');
    const [passwordResetNewPassword, setPasswordResetNewPassword] = useState('');
    const [passwordResetNewPasswordConfirm, setPasswordResetNewPasswordConfirm] = useState('');
    const [passwordResetErrors, setPasswordResetErrors] = useState<TPasswordResetErrors>({});
    const [passwordResetMessage, setPasswordResetMessage] = useState<string | null>(null);
    const [passwordResetError, setPasswordResetError] = useState<string | null>(null);
    const [hasRequestedPasswordReset, setHasRequestedPasswordReset] = useState(false);
    const [isPasswordResetTokenVerified, setIsPasswordResetTokenVerified] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSendingVerification, setIsSendingVerification] = useState(false);
    const [isConfirmingSignupVerification, setIsConfirmingSignupVerification] = useState(false);
    const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
    const [isConfirmingPasswordReset, setIsConfirmingPasswordReset] = useState(false);
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [loginVisualSlideIndex, setLoginVisualSlideIndex] = useState(0);
    const loginVisualAutoRotateTimerRef = useRef<number | null>(null);
    const scheduleLoginVisualAutoRotateRef = useRef<(delay: number) => void>(() => undefined);
    const isSignupEmailValid = EMAIL_PATTERN.test(signupEmail.trim());
    const isPasswordResetEmailValid = EMAIL_PATTERN.test(passwordResetEmail.trim());
    const hasSignupVerificationCode = signupEmailVerificationToken?.length === EMAIL_VERIFICATION_CODE_LENGTH;
    const hasPasswordResetCode = passwordResetToken?.length === EMAIL_VERIFICATION_CODE_LENGTH;
    const isLoginDisabled = !loginEmail.trim() || !loginPassword || isSubmitting;
    const isSignupBusy = isSubmitting || isSendingVerification || isConfirmingSignupVerification;
    const isSignupDisabled = isSignupBusy;
    const isPasswordResetBusy = isSendingPasswordReset || isConfirmingPasswordReset || isResettingPassword;
    const isPasswordResetDisabled = isPasswordResetBusy;
    const socialAuthorizeNextPath = isSignupPage ? buildSocialSignupRegisterPath() : nextPath;
    const kakaoAuthorizeUrl = buildAuthAuthorizeUrl('kakao', socialAuthorizeNextPath);
    const appleAuthorizeUrl = buildAuthAuthorizeUrl('apple', socialAuthorizeNextPath);
    const currentLoginVisualPage = loginVisualSlideIndex + 1;
    const totalLoginVisualPages = LOGIN_VISUAL_SLIDES.length;
    const title = isSignupPage ? '회원가입' : isPasswordResetMode ? '비밀번호 찾기' : '로그인';
    const clearLoginVisualAutoRotateTimer = useCallback(() => {
        if (loginVisualAutoRotateTimerRef.current === null) {
            return;
        }

        window.clearTimeout(loginVisualAutoRotateTimerRef.current);
        loginVisualAutoRotateTimerRef.current = null;
    }, []);

    scheduleLoginVisualAutoRotateRef.current = (delay: number) => {
        clearLoginVisualAutoRotateTimer();
        loginVisualAutoRotateTimerRef.current = window.setTimeout(() => {
            setLoginVisualSlideIndex((current) => (current + 1) % LOGIN_VISUAL_SLIDES.length);
            scheduleLoginVisualAutoRotateRef.current(LOGIN_VISUAL_AUTO_ROTATE_MS);
        }, delay);
    };

    const shouldShowPasswordResetFromLoginError = loginError === INVALID_LOGIN_CREDENTIALS_MESSAGE;
    const showPreviousLoginVisualSlide = () => {
        setLoginVisualSlideIndex((current) => (current - 1 + totalLoginVisualPages) % totalLoginVisualPages);
        scheduleLoginVisualAutoRotateRef.current(LOGIN_VISUAL_MANUAL_RESUME_MS);
    };
    const showNextLoginVisualSlide = () => {
        setLoginVisualSlideIndex((current) => (current + 1) % totalLoginVisualPages);
        scheduleLoginVisualAutoRotateRef.current(LOGIN_VISUAL_MANUAL_RESUME_MS);
    };

    useEffect(() => {
        scheduleLoginVisualAutoRotateRef.current(LOGIN_VISUAL_AUTO_ROTATE_MS);

        return clearLoginVisualAutoRotateTimer;
    }, [clearLoginVisualAutoRotateTimer]);

    const validateSignup = () => {
        const nextErrors: TSignupErrors = {};
        let nextVerificationError: string | null = null;
        const isEmailValid = EMAIL_PATTERN.test(signupEmail.trim());

        if (!signupName.trim()) {
            nextErrors.name = '이름을 입력해 주세요.';
        }

        if (!isEmailValid) {
            nextErrors.email = '올바른 이메일 주소를 입력해 주세요.';
        }

        if (isEmailValid && !isSignupEmailVerified) {
            if (!hasRequestedSignupVerification) {
                nextVerificationError = '이메일 인증을 완료해 주세요.';
            } else if (!hasSignupVerificationCode) {
                nextVerificationError = '6자리 인증번호를 입력해 주세요.';
            } else {
                nextVerificationError = '인증번호 확인을 완료해 주세요.';
            }
        }

        if (signupPassword.length < PASSWORD_MIN_LENGTH) {
            nextErrors.password = `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.`;
        }

        if (!signupPasswordConfirm) {
            nextErrors.passwordConfirm = '비밀번호를 다시 입력해 주세요.';
        } else if (signupPassword !== signupPasswordConfirm) {
            nextErrors.passwordConfirm = '비밀번호가 서로 달라요.';
        }

        setSignupErrors(nextErrors);
        setSignupVerificationError(nextVerificationError);
        if (nextVerificationError) {
            setSignupVerificationMessage(null);
        }

        return Object.keys(nextErrors).length === 0 && !nextVerificationError;
    };
    const validatePasswordReset = () => {
        const nextErrors: TPasswordResetErrors = {};
        const isEmailValid = EMAIL_PATTERN.test(passwordResetEmail.trim());

        if (!isEmailValid) {
            nextErrors.email = '올바른 이메일 주소를 입력해 주세요.';
        }

        if (isEmailValid && !isPasswordResetTokenVerified) {
            if (!hasRequestedPasswordReset) {
                nextErrors.resetToken = '이메일 인증을 완료해 주세요.';
            } else if (!hasPasswordResetCode) {
                nextErrors.resetToken = '6자리 인증번호를 입력해 주세요.';
            } else {
                nextErrors.resetToken = '인증번호 확인을 완료해 주세요.';
            }
        }

        if (passwordResetNewPassword.length < PASSWORD_MIN_LENGTH) {
            nextErrors.newPassword = `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.`;
        }

        if (!passwordResetNewPasswordConfirm) {
            nextErrors.newPasswordConfirm = '비밀번호를 다시 입력해 주세요.';
        } else if (passwordResetNewPassword !== passwordResetNewPasswordConfirm) {
            nextErrors.newPasswordConfirm = '비밀번호가 서로 달라요.';
        }

        setPasswordResetErrors(nextErrors);
        if (nextErrors.resetToken) {
            setPasswordResetMessage(null);
        }

        return Object.keys(nextErrors).length === 0;
    };
    const clearSignupErrors = (...fields: Array<keyof TSignupErrors>) => {
        setSignupErrors((errors) => {
            if (fields.every((field) => !errors[field])) {
                return errors;
            }

            const nextErrors = {...errors};

            fields.forEach((field) => {
                delete nextErrors[field];
            });

            return nextErrors;
        });
    };
    const handleSignupEmailChange = (value: string) => {
        setSignupEmail(value);
        setSignupEmailVerificationToken(null);
        setSignupVerificationCode('');
        setHasRequestedSignupVerification(false);
        setIsSignupEmailVerified(false);
        setSignupVerificationMessage(null);
        setSignupVerificationError(null);

        if (EMAIL_PATTERN.test(value.trim())) {
            clearSignupErrors('email');
        }
    };
    const handleSignupNameChange = (value: string) => {
        setSignupName(value);

        if (value.trim()) {
            clearSignupErrors('name');
        }
    };
    const handleSignupPasswordChange = (value: string) => {
        const fieldsToClear: Array<keyof TSignupErrors> = [];

        setSignupPassword(value);

        if (value.length >= PASSWORD_MIN_LENGTH) {
            fieldsToClear.push('password');
        }

        if (signupPasswordConfirm && value === signupPasswordConfirm) {
            fieldsToClear.push('passwordConfirm');
        }

        if (fieldsToClear.length > 0) {
            clearSignupErrors(...fieldsToClear);
        }
    };
    const handleSignupPasswordConfirmChange = (value: string) => {
        setSignupPasswordConfirm(value);

        if (value && signupPassword === value) {
            clearSignupErrors('passwordConfirm');
        }
    };
    const handleSignupVerificationCodeChange = (value: string) => {
        const normalizedCode = value.replace(/\D/g, '').slice(0, EMAIL_VERIFICATION_CODE_LENGTH);
        setSignupVerificationCode(normalizedCode);
        setSignupEmailVerificationToken(normalizedCode.length === EMAIL_VERIFICATION_CODE_LENGTH ? normalizedCode : null);
        setIsSignupEmailVerified(false);
        setSignupVerificationMessage(null);
        setSignupVerificationError(null);
    };
    const handlePasswordResetEmailChange = (value: string) => {
        setPasswordResetEmail(value);
        setPasswordResetToken(null);
        setPasswordResetCode('');
        setHasRequestedPasswordReset(false);
        setIsPasswordResetTokenVerified(false);
        setPasswordResetMessage(null);
        setPasswordResetError(null);
        setPasswordResetErrors((errors) => ({...errors, email: undefined, resetToken: undefined}));
    };
    const handlePasswordResetCodeChange = (value: string) => {
        const normalizedCode = value.replace(/\D/g, '').slice(0, EMAIL_VERIFICATION_CODE_LENGTH);
        setPasswordResetCode(normalizedCode);
        setPasswordResetToken(normalizedCode.length === EMAIL_VERIFICATION_CODE_LENGTH ? normalizedCode : null);
        setIsPasswordResetTokenVerified(false);
        setPasswordResetMessage(null);
        setPasswordResetError(null);
        setPasswordResetErrors((errors) => ({...errors, resetToken: undefined}));
    };
    const handlePasswordResetNewPasswordChange = (value: string) => {
        setPasswordResetNewPassword(value);
        setPasswordResetErrors((errors) => ({...errors, newPassword: undefined}));
    };
    const handlePasswordResetNewPasswordConfirmChange = (value: string) => {
        setPasswordResetNewPasswordConfirm(value);
        setPasswordResetErrors((errors) => ({...errors, newPasswordConfirm: undefined}));
    };
    const handleOpenPasswordReset = () => {
        setIsPasswordResetMode(true);
        setLoginError(null);
        setLoginNotice(null);
        setPasswordResetEmail(loginEmail.trim());
    };
    const handleClosePasswordReset = () => {
        setIsPasswordResetMode(false);
        setPasswordResetError(null);
        setPasswordResetMessage(null);
        setPasswordResetErrors({});
    };
    const handleSendSignupEmailVerification = async () => {
        setHasRequestedSignupVerification(true);
        setSignupVerificationMessage(null);
        setSignupVerificationError(null);
        setSignupEmailVerificationToken(null);
        setSignupVerificationCode('');
        setIsSignupEmailVerified(false);

        if (!isSignupEmailValid) {
            setSignupErrors((errors) => ({...errors, email: '올바른 이메일 주소를 입력해 주세요.'}));

            return;
        }

        setSignupErrors((errors) => ({...errors, email: undefined}));
        setIsSendingVerification(true);

        try {
            await AuthAPI.sendAdminEmailVerification({email: signupEmail.trim()});
            setSignupVerificationMessage('인증 메일을 보냈어요. 메일함에서 인증번호를 확인해 입력해 주세요.');
        } catch (error) {
            setSignupVerificationError(error instanceof Error ? error.message : '인증 메일을 보내지 못했어요. 다시 시도해 주세요.');
        } finally {
            setIsSendingVerification(false);
        }
    };
    const handleConfirmSignupEmailVerification = async () => {
        setSignupVerificationMessage(null);
        setSignupVerificationError(null);

        if (!isSignupEmailValid) {
            setSignupErrors((errors) => ({...errors, email: '올바른 이메일 주소를 입력해 주세요.'}));

            return;
        }

        if (!hasSignupVerificationCode) {
            setSignupVerificationError('6자리 인증번호를 입력해 주세요.');

            return;
        }

        setIsConfirmingSignupVerification(true);

        try {
            await AuthAPI.confirmAdminEmailVerification({
                email: signupEmail.trim(),
                emailVerificationToken: signupEmailVerificationToken ?? '',
            });
            setIsSignupEmailVerified(true);
            setSignupVerificationMessage('이메일 인증이 완료됐어요.');
        } catch {
            setIsSignupEmailVerified(false);
            setSignupVerificationError('인증번호가 올바르지 않아요. 다시 확인해 주세요.');
        } finally {
            setIsConfirmingSignupVerification(false);
        }
    };
    const handleSendPasswordReset = async () => {
        setHasRequestedPasswordReset(true);
        setPasswordResetMessage(null);
        setPasswordResetError(null);
        setPasswordResetToken(null);
        setPasswordResetCode('');
        setIsPasswordResetTokenVerified(false);

        if (!isPasswordResetEmailValid) {
            setPasswordResetErrors((errors) => ({...errors, email: '올바른 이메일 주소를 입력해 주세요.'}));

            return;
        }

        setPasswordResetErrors((errors) => ({...errors, email: undefined}));
        setIsSendingPasswordReset(true);

        try {
            await AuthAPI.requestAdminPasswordReset({email: passwordResetEmail.trim()});
            setPasswordResetMessage('인증 메일을 보냈어요. 메일함에서 인증번호를 확인해 입력해 주세요.');
        } catch (error) {
            setPasswordResetError(error instanceof Error ? error.message : '인증 메일을 보내지 못했어요. 다시 시도해 주세요.');
        } finally {
            setIsSendingPasswordReset(false);
        }
    };
    const handleConfirmPasswordResetToken = async () => {
        setPasswordResetMessage(null);
        setPasswordResetError(null);

        if (!isPasswordResetEmailValid) {
            setPasswordResetErrors((errors) => ({...errors, email: '올바른 이메일 주소를 입력해 주세요.'}));

            return;
        }

        if (!hasPasswordResetCode) {
            setPasswordResetErrors((errors) => ({...errors, resetToken: '6자리 인증번호를 입력해 주세요.'}));

            return;
        }

        setPasswordResetErrors((errors) => ({...errors, resetToken: undefined}));
        setIsConfirmingPasswordReset(true);

        try {
            await AuthAPI.confirmAdminPasswordResetToken({
                email: passwordResetEmail.trim(),
                resetToken: passwordResetToken ?? '',
            });
            setIsPasswordResetTokenVerified(true);
            setPasswordResetMessage('인증번호를 확인했어요. 새 비밀번호를 입력해 주세요.');
            setPasswordResetErrors((errors) => ({...errors, resetToken: undefined}));
        } catch {
            setIsPasswordResetTokenVerified(false);
            setPasswordResetError('인증번호가 올바르지 않아요. 다시 확인해 주세요.');
        } finally {
            setIsConfirmingPasswordReset(false);
        }
    };
    const handlePasswordLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoginError(null);
        setLoginNotice(null);

        if (!loginEmail.trim() || !loginPassword) {
            setLoginError('이메일과 비밀번호를 입력해 주세요.');

            return;
        }

        setIsSubmitting(true);

        try {
            const response = await AuthAPI.passwordLogin({
                email: loginEmail.trim(),
                password: loginPassword,
            });

            handleLogin(response.accessToken, nextPath);
        } catch (error) {
            setLoginError(error instanceof Error ? error.message : '로그인하지 못했어요. 다시 시도해 주세요.');
        } finally {
            setIsSubmitting(false);
        }
    };
    const handlePasswordReset = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPasswordResetError(null);

        if (!validatePasswordReset()) {
            return;
        }

        setIsResettingPassword(true);

        try {
            await AuthAPI.resetAdminPassword({
                email: passwordResetEmail.trim(),
                resetToken: passwordResetToken ?? '',
                newPassword: passwordResetNewPassword,
            });
            setLoginEmail(passwordResetEmail.trim());
            setLoginPassword('');
            setLoginNotice('비밀번호가 변경됐어요. 새 비밀번호로 로그인해 주세요.');
            setIsPasswordResetMode(false);
            setPasswordResetToken(null);
            setPasswordResetCode('');
            setIsPasswordResetTokenVerified(false);
            setPasswordResetNewPassword('');
            setPasswordResetNewPasswordConfirm('');
            setPasswordResetMessage(null);
            setPasswordResetErrors({});
        } catch (error) {
            setPasswordResetError(error instanceof Error ? error.message : '비밀번호를 변경하지 못했어요. 다시 시도해 주세요.');
        } finally {
            setIsResettingPassword(false);
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
                name: signupName.trim(),
                email: signupEmail.trim(),
                emailVerificationToken: signupEmailVerificationToken ?? undefined,
                password: signupPassword,
            });

            handleLogin(response.accessToken, ROUTE.REGISTER);
        } catch (error) {
            setSignupError(error instanceof Error ? error.message : '가입을 완료하지 못했어요. 다시 시도해 주세요.');
        } finally {
            setIsSubmitting(false);
        }
    };
    return (
        <div className="flex min-h-screen w-full overflow-x-hidden bg-white">
            <aside className="login-visual-panel" aria-label="로그인 이미지 슬라이드">
                {LOGIN_VISUAL_SLIDES.map((src, index) => (
                    <img
                        key={src}
                        src={src}
                        alt=""
                        aria-hidden="true"
                        className={cn('login-visual-slide', index === loginVisualSlideIndex && 'login-visual-slide-active')}
                    />
                ))}
                <button
                    type="button"
                    className="login-visual-arrow login-visual-arrow-prev"
                    onClick={showPreviousLoginVisualSlide}
                    aria-label="이전 이미지"
                    title="이전 이미지"
                >
                    <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className="login-visual-arrow login-visual-arrow-next"
                    onClick={showNextLoginVisualSlide}
                    aria-label="다음 이미지"
                    title="다음 이미지"
                >
                    <ChevronRight className="h-6 w-6" aria-hidden="true" />
                </button>
                <div className="login-visual-page" aria-live="polite">
                    {currentLoginVisualPage}/{totalLoginVisualPages}
                </div>
            </aside>

            <div className="z-10 flex min-h-screen w-full min-w-0 flex-1 shrink-0 flex-col items-center bg-white px-5 py-10 md:px-16 xl:px-26.25">
                <button type="button" className="flex cursor-pointer items-center" onClick={() => navigate(ROUTE.ROOT)}>
                    <img src="/img/group-19.png" alt="" aria-hidden="true" className="mt-8 h-[34px] w-auto max-w-[166px] object-contain" />
                </button>

                <div className={`mt-6 w-full ${isSignupPage ? 'max-w-[560px]' : 'max-w-[480px]'} md:mt-10`}>
                    {isDemoSignupFlow ? (
                        <div className="mb-6 rounded-[16px] border border-main-3/40 bg-main-light px-5 py-4">
                            <p className="font-apple text-sm font-semibold text-main-1">체험 계정을 정식 계정으로 전환해요</p>
                            <p className="mt-1 font-apple text-sm leading-6 text-sub-2.5">
                                계정을 만든 뒤 새 병동을 만들면 이후에도 데이터를 이어서 관리할 수 있어요.
                            </p>
                        </div>
                    ) : null}

                    <div className="mx-auto mt-7 w-full max-w-[334px] text-center">
                        <h1 className="font-apple text-[32px] font-semibold text-text-1">{title}</h1>
                    </div>

                    {!isSignupPage && !isPasswordResetMode ? (
                        <form onSubmit={handlePasswordLogin} className="mx-auto mt-7 w-full max-w-[334px] space-y-4">
                            <div>
                                <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    이메일
                                </label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-4" />
                                    <input
                                        id="login-email"
                                        value={loginEmail}
                                        type="email"
                                        className={`${FIELD_CLASS} pl-9`}
                                        placeholder="이메일을 입력하세요"
                                        autoComplete="email"
                                        onChange={(event) => setLoginEmail(event.target.value)}
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
                            {loginNotice ? (
                                <p role="status" className="rounded-[12px] bg-main-light px-3 py-2 text-sm text-main-1">
                                    {loginNotice}
                                </p>
                            ) : null}
                            {loginError ? (
                                <div>
                                    <p role="alert" className="rounded-[12px] bg-[#FFF7F8] px-3 py-2 text-sm text-red">
                                        {loginError}
                                    </p>
                                    {shouldShowPasswordResetFromLoginError ? (
                                        <div className="mt-2 flex justify-end">
                                            <button
                                                type="button"
                                                className="cursor-pointer text-sm font-semibold text-main-1 underline underline-offset-[3px]"
                                                onClick={handleOpenPasswordReset}
                                            >
                                                비밀번호 찾기
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                            <button
                                type="submit"
                                disabled={isLoginDisabled}
                                className="mx-auto flex h-[44px] w-full max-w-[334px] cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[1px] border-main-1 bg-main-1 px-[12px] text-sm font-semibold text-white transition-colors hover:bg-[#5832E7] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-gray-6 disabled:text-gray-3"
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                로그인
                            </button>
                            <div className="flex items-center justify-start text-sm">
                                <Link to={ROUTE.SIGN_UP} className="font-semibold text-main-1 underline underline-offset-[3px]">
                                    회원가입
                                </Link>
                            </div>
                        </form>
                    ) : null}

                    {!isSignupPage && isPasswordResetMode ? (
                        <form onSubmit={handlePasswordReset} className="mx-auto mt-7 w-full max-w-[334px] space-y-4">
                            <div>
                                <label htmlFor="password-reset-email" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    이메일
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        id="password-reset-email"
                                        value={passwordResetEmail}
                                        type="email"
                                        className={cn(getInputClassName(Boolean(passwordResetErrors.email)), 'min-w-0')}
                                        placeholder="이메일을 입력해 주세요"
                                        autoComplete="email"
                                        onChange={(event) => handlePasswordResetEmailChange(event.target.value)}
                                        aria-invalid={Boolean(passwordResetErrors.email)}
                                        aria-describedby={passwordResetErrors.email ? 'password-reset-email-error' : undefined}
                                    />
                                    <button
                                        type="button"
                                        disabled={!isPasswordResetEmailValid || isSendingPasswordReset}
                                        className="flex h-11 w-[76px] shrink-0 cursor-pointer items-center justify-center rounded-[12px] bg-sub-1 px-2 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-6 disabled:text-gray-3"
                                        onClick={handleSendPasswordReset}
                                    >
                                        {isSendingPasswordReset ? <Loader2 className="h-4 w-4 animate-spin" /> : hasRequestedPasswordReset ? '재전송' : '인증'}
                                    </button>
                                </div>
                                <FieldError id="password-reset-email-error" message={passwordResetErrors.email} />
                                {hasRequestedPasswordReset ? (
                                    <div className="mt-2">
                                        <div className="flex gap-2">
                                        <input
                                            id="password-reset-code"
                                            value={passwordResetCode}
                                            type="text"
                                            className={cn(getInputClassName(Boolean(passwordResetErrors.resetToken)), 'min-w-0')}
                                            placeholder="6자리 인증번호"
                                            aria-label="비밀번호 재설정 인증번호"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            maxLength={EMAIL_VERIFICATION_CODE_LENGTH}
                                            pattern="[0-9]{6}"
                                            onChange={(event) => handlePasswordResetCodeChange(event.target.value)}
                                            aria-invalid={Boolean(passwordResetErrors.resetToken)}
                                            aria-describedby={passwordResetErrors.resetToken ? 'password-reset-code-error' : undefined}
                                        />
                                            <button
                                                type="button"
                                                disabled={!hasPasswordResetCode || isConfirmingPasswordReset || isPasswordResetTokenVerified}
                                                className="flex h-11 w-[76px] shrink-0 cursor-pointer items-center justify-center rounded-[12px] bg-main-1 px-2 text-sm font-semibold text-white transition-colors hover:bg-[#5832E7] disabled:cursor-not-allowed disabled:bg-gray-6 disabled:text-gray-3"
                                                onClick={handleConfirmPasswordResetToken}
                                            >
                                                {isConfirmingPasswordReset ? <Loader2 className="h-4 w-4 animate-spin" /> : isPasswordResetTokenVerified ? '완료' : '확인'}
                                            </button>
                                        </div>
                                        <FieldError id="password-reset-code-error" message={passwordResetErrors.resetToken} />
                                    </div>
                                ) : null}
                                {passwordResetMessage ? <p className="mt-1 text-xs text-main-1">{passwordResetMessage}</p> : null}
                                {!hasRequestedPasswordReset ? (
                                    <FieldError id="password-reset-code-error" message={passwordResetErrors.resetToken} />
                                ) : null}
                            </div>

                            <div>
                                <label htmlFor="password-reset-new-password" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    새 비밀번호
                                </label>
                                <input
                                    id="password-reset-new-password"
                                    value={passwordResetNewPassword}
                                    type="password"
                                    className={getInputClassName(Boolean(passwordResetErrors.newPassword))}
                                    placeholder="새 비밀번호를 입력해 주세요"
                                    autoComplete="new-password"
                                    onChange={(event) => handlePasswordResetNewPasswordChange(event.target.value)}
                                    aria-invalid={Boolean(passwordResetErrors.newPassword)}
                                    aria-describedby={passwordResetErrors.newPassword ? 'password-reset-new-password-error' : undefined}
                                />
                                <FieldError id="password-reset-new-password-error" message={passwordResetErrors.newPassword} />
                            </div>

                            <div>
                                <label htmlFor="password-reset-new-password-confirm" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    새 비밀번호 확인
                                </label>
                                <input
                                    id="password-reset-new-password-confirm"
                                    value={passwordResetNewPasswordConfirm}
                                    type="password"
                                    className={getInputClassName(Boolean(passwordResetErrors.newPasswordConfirm))}
                                    placeholder="새 비밀번호를 다시 입력해 주세요"
                                    autoComplete="new-password"
                                    onChange={(event) => handlePasswordResetNewPasswordConfirmChange(event.target.value)}
                                    aria-invalid={Boolean(passwordResetErrors.newPasswordConfirm)}
                                    aria-describedby={passwordResetErrors.newPasswordConfirm ? 'password-reset-new-password-confirm-error' : undefined}
                                />
                                <FieldError id="password-reset-new-password-confirm-error" message={passwordResetErrors.newPasswordConfirm} />
                            </div>

                            {passwordResetError ? (
                                <p role="alert" className="rounded-[12px] bg-[#FFF7F8] px-3 py-2 text-sm text-red">
                                    {passwordResetError}
                                </p>
                            ) : null}

                            <button
                                type="submit"
                                disabled={isPasswordResetDisabled}
                                className="mx-auto flex h-[44px] w-full max-w-[334px] cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[1px] border-main-1 bg-main-1 px-[12px] text-sm font-semibold text-white transition-colors hover:bg-[#5832E7] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-gray-6 disabled:text-gray-3"
                            >
                                {isResettingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                비밀번호 재설정
                            </button>
                            <p className="text-center text-sm text-gray-3">
                                <button
                                    type="button"
                                    className="cursor-pointer font-semibold text-main-1 underline underline-offset-[3px]"
                                    onClick={handleClosePasswordReset}
                                >
                                    로그인으로 돌아가기
                                </button>
                            </p>
                        </form>
                    ) : null}

                    {isSignupPage ? (
                        <form onSubmit={handlePasswordSignup} className="mx-auto mt-7 w-full max-w-[334px] space-y-4">
                            <div>
                                <label htmlFor="signup-name" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    이름
                                </label>
                                <input
                                    id="signup-name"
                                    value={signupName}
                                    type="text"
                                    className={getInputClassName(Boolean(signupErrors.name))}
                                    placeholder="이름을 입력해 주세요"
                                    autoComplete="name"
                                    onChange={(event) => handleSignupNameChange(event.target.value)}
                                    aria-invalid={Boolean(signupErrors.name)}
                                    aria-describedby={signupErrors.name ? 'signup-name-error' : undefined}
                                />
                                <FieldError id="signup-name-error" message={signupErrors.name} />
                            </div>

                            <div>
                                <label htmlFor="signup-email" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    이메일
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        id="signup-email"
                                        value={signupEmail}
                                        type="email"
                                        className={cn(getInputClassName(Boolean(signupErrors.email)), 'min-w-0')}
                                        placeholder="이메일을 입력해 주세요"
                                        autoComplete="email"
                                        onChange={(event) => handleSignupEmailChange(event.target.value)}
                                        aria-invalid={Boolean(signupErrors.email)}
                                        aria-describedby={signupErrors.email ? 'signup-email-error' : undefined}
                                    />
                                    <button
                                        type="button"
                                        disabled={!isSignupEmailValid || isSendingVerification}
                                        className="flex h-11 w-[76px] shrink-0 cursor-pointer items-center justify-center rounded-[12px] bg-sub-1 px-2 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-6 disabled:text-gray-3"
                                        onClick={handleSendSignupEmailVerification}
                                    >
                                        {isSendingVerification ? <Loader2 className="h-4 w-4 animate-spin" /> : hasRequestedSignupVerification ? '재전송' : '인증'}
                                    </button>
                                </div>
                                <FieldError id="signup-email-error" message={signupErrors.email} />
                                {hasRequestedSignupVerification ? (
                                    <div className="mt-2 flex gap-2">
                                        <input
                                            id="signup-verification-code"
                                            value={signupVerificationCode}
                                            type="text"
                                            className={cn(getInputClassName(Boolean(signupVerificationError)), 'min-w-0')}
                                            placeholder="6자리 인증번호"
                                            aria-label="이메일 인증번호"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            maxLength={EMAIL_VERIFICATION_CODE_LENGTH}
                                            pattern="[0-9]{6}"
                                            onChange={(event) => handleSignupVerificationCodeChange(event.target.value)}
                                            aria-invalid={Boolean(signupVerificationError)}
                                            aria-describedby={signupVerificationError ? 'signup-verification-error' : undefined}
                                        />
                                        <button
                                            type="button"
                                            disabled={!hasSignupVerificationCode || isConfirmingSignupVerification || isSignupEmailVerified}
                                            className="flex h-11 w-[76px] shrink-0 cursor-pointer items-center justify-center rounded-[12px] bg-main-1 px-2 text-sm font-semibold text-white transition-colors hover:bg-[#5832E7] disabled:cursor-not-allowed disabled:bg-gray-6 disabled:text-gray-3"
                                            onClick={handleConfirmSignupEmailVerification}
                                        >
                                            {isConfirmingSignupVerification ? <Loader2 className="h-4 w-4 animate-spin" /> : isSignupEmailVerified ? '완료' : '확인'}
                                        </button>
                                    </div>
                                ) : null}
                                {signupVerificationMessage ? <p className="mt-1 text-xs text-main-1">{signupVerificationMessage}</p> : null}
                                <FieldError id="signup-verification-error" message={signupVerificationError ?? undefined} />
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
                                    onChange={(event) => handleSignupPasswordChange(event.target.value)}
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
                                    onChange={(event) => handleSignupPasswordConfirmChange(event.target.value)}
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
                                className="mx-auto flex h-[44px] w-full max-w-[334px] cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[1px] border-main-1 bg-main-1 px-[12px] text-sm font-semibold text-white transition-colors hover:bg-[#5832E7] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-gray-6 disabled:text-gray-3"
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
                    ) : null}

                    {!isPasswordResetMode ? (
                        <div className="mx-auto mt-7 w-full max-w-[334px] border-t border-gray-6 pt-6">
                            <div className="grid grid-cols-1 gap-3">
                                <a
                                    href={kakaoAuthorizeUrl}
                                    className="mx-auto flex h-[44px] w-full max-w-[334px] cursor-pointer items-center justify-center rounded-[12px] border border-[1px] border-[#F2D600] bg-[#FEE500] px-[12px] text-sm font-semibold text-sub-1 shadow-banner"
                                >
                                    <KakaoIcon className="mr-3 h-5 w-5" />
                                    {isSignupPage ? '카카오로 시작하기' : '카카오로 계속하기'}
                                </a>
                                <a
                                    href={appleAuthorizeUrl}
                                    className="mx-auto flex h-[44px] w-full max-w-[334px] cursor-pointer items-center justify-center rounded-[12px] border border-[1px] border-[#231F20] bg-[#231F20] px-[12px] text-sm font-semibold text-white shadow-banner"
                                >
                                    <AppleIcon className="mr-3 h-5 w-5" />
                                    {isSignupPage ? 'Apple로 시작하기' : 'Apple로 계속하기'}
                                </a>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
