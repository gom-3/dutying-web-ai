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
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
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
const getInputClassName = (hasError: boolean) => cn(FIELD_CLASS, hasError && 'border-red bg-[#FFF7F8] focus-visible:bg-white');
const PasswordVisibilityButton = ({
    visible,
    onClick,
    showLabel,
    hideLabel,
}: {
    visible: boolean;
    onClick: () => void;
    showLabel: string;
    hideLabel: string;
}) => (
    <button
        type="button"
        className="absolute top-1/2 right-3 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-gray-4 transition-colors hover:bg-gray-6 hover:text-sub-1"
        onClick={onClick}
        aria-label={visible ? hideLabel : showLabel}
        title={visible ? hideLabel : showLabel}
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
    const {t} = useTypedTranslation();
    const navigate = useNavigate();
    const {pathname, search} = useLocation();
    const {
        actions: {handleLogin},
    } = useAuth();
    const params = new URLSearchParams(search);
    const nextPath = sanitizeInternalPath(params.get('next'), ROUTE.HOME);
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
    const invalidLoginCredentialsMessage = t('page.login.feedback.invalidCredentials');
    const legacyInvalidLoginCredentialsServerText = t('page.login.feedback.legacyInvalidCredentialsServerText');
    const title = isSignupPage
        ? t('page.login.signupTitle')
        : isPasswordResetMode
          ? t('page.login.passwordResetTitle')
          : t('page.login.title');
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

    const shouldShowPasswordResetFromLoginError =
        loginError === invalidLoginCredentialsMessage || loginError === legacyInvalidLoginCredentialsServerText;
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
            nextErrors.name = t('page.login.validation.nameRequired');
        }

        if (!isEmailValid) {
            nextErrors.email = t('page.login.validation.emailInvalid');
        }

        if (isEmailValid && !isSignupEmailVerified) {
            if (!hasRequestedSignupVerification) {
                nextVerificationError = t('page.login.validation.emailVerificationRequired');
            } else if (!hasSignupVerificationCode) {
                nextVerificationError = t('page.login.validation.verificationCodeRequired');
            } else {
                nextVerificationError = t('page.login.validation.verificationConfirmRequired');
            }
        }

        if (signupPassword.length < PASSWORD_MIN_LENGTH) {
            nextErrors.password = t('page.login.validation.passwordMinLength', {count: PASSWORD_MIN_LENGTH});
        }

        if (!signupPasswordConfirm) {
            nextErrors.passwordConfirm = t('page.login.validation.passwordConfirmRequired');
        } else if (signupPassword !== signupPasswordConfirm) {
            nextErrors.passwordConfirm = t('page.login.validation.passwordMismatch');
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
            nextErrors.email = t('page.login.validation.emailInvalid');
        }

        if (isEmailValid && !isPasswordResetTokenVerified) {
            if (!hasRequestedPasswordReset) {
                nextErrors.resetToken = t('page.login.validation.emailVerificationRequired');
            } else if (!hasPasswordResetCode) {
                nextErrors.resetToken = t('page.login.validation.verificationCodeRequired');
            } else {
                nextErrors.resetToken = t('page.login.validation.verificationConfirmRequired');
            }
        }

        if (passwordResetNewPassword.length < PASSWORD_MIN_LENGTH) {
            nextErrors.newPassword = t('page.login.validation.passwordMinLength', {count: PASSWORD_MIN_LENGTH});
        }

        if (!passwordResetNewPasswordConfirm) {
            nextErrors.newPasswordConfirm = t('page.login.validation.passwordConfirmRequired');
        } else if (passwordResetNewPassword !== passwordResetNewPasswordConfirm) {
            nextErrors.newPasswordConfirm = t('page.login.validation.passwordMismatch');
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
            setSignupErrors((errors) => ({...errors, email: t('page.login.validation.emailInvalid')}));

            return;
        }

        setSignupErrors((errors) => ({...errors, email: undefined}));
        setIsSendingVerification(true);

        try {
            await AuthAPI.sendAdminEmailVerification({email: signupEmail.trim()});
            setSignupVerificationMessage(t('page.login.feedback.verificationSent'));
        } catch (error) {
            setSignupVerificationError(error instanceof Error ? error.message : t('page.login.feedback.verificationFailed'));
        } finally {
            setIsSendingVerification(false);
        }
    };
    const handleConfirmSignupEmailVerification = async () => {
        setSignupVerificationMessage(null);
        setSignupVerificationError(null);

        if (!isSignupEmailValid) {
            setSignupErrors((errors) => ({...errors, email: t('page.login.validation.emailInvalid')}));

            return;
        }

        if (!hasSignupVerificationCode) {
            setSignupVerificationError(t('page.login.validation.verificationCodeRequired'));

            return;
        }

        setIsConfirmingSignupVerification(true);

        try {
            await AuthAPI.confirmAdminEmailVerification({
                email: signupEmail.trim(),
                emailVerificationToken: signupEmailVerificationToken ?? '',
            });
            setIsSignupEmailVerified(true);
            setSignupVerificationMessage(t('page.login.feedback.emailVerified'));
        } catch {
            setIsSignupEmailVerified(false);
            setSignupVerificationError(t('page.login.feedback.verificationInvalid'));
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
            setPasswordResetErrors((errors) => ({...errors, email: t('page.login.validation.emailInvalid')}));

            return;
        }

        setPasswordResetErrors((errors) => ({...errors, email: undefined}));
        setIsSendingPasswordReset(true);

        try {
            await AuthAPI.requestAdminPasswordReset({email: passwordResetEmail.trim()});
            setPasswordResetMessage(t('page.login.feedback.verificationSent'));
        } catch (error) {
            setPasswordResetError(error instanceof Error ? error.message : t('page.login.feedback.verificationFailed'));
        } finally {
            setIsSendingPasswordReset(false);
        }
    };
    const handleConfirmPasswordResetToken = async () => {
        setPasswordResetMessage(null);
        setPasswordResetError(null);

        if (!isPasswordResetEmailValid) {
            setPasswordResetErrors((errors) => ({...errors, email: t('page.login.validation.emailInvalid')}));

            return;
        }

        if (!hasPasswordResetCode) {
            setPasswordResetErrors((errors) => ({...errors, resetToken: t('page.login.validation.verificationCodeRequired')}));

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
            setPasswordResetMessage(t('page.login.feedback.passwordResetTokenVerified'));
            setPasswordResetErrors((errors) => ({...errors, resetToken: undefined}));
        } catch {
            setIsPasswordResetTokenVerified(false);
            setPasswordResetError(t('page.login.feedback.verificationInvalid'));
        } finally {
            setIsConfirmingPasswordReset(false);
        }
    };
    const handlePasswordLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoginError(null);
        setLoginNotice(null);

        if (!loginEmail.trim() || !loginPassword) {
            setLoginError(t('page.login.validation.loginRequired'));

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
            setLoginError(error instanceof Error ? error.message : t('page.login.feedback.loginFailed'));
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
            setLoginNotice(t('page.login.feedback.passwordResetSuccess'));
            setIsPasswordResetMode(false);
            setPasswordResetToken(null);
            setPasswordResetCode('');
            setIsPasswordResetTokenVerified(false);
            setPasswordResetNewPassword('');
            setPasswordResetNewPasswordConfirm('');
            setPasswordResetMessage(null);
            setPasswordResetErrors({});
        } catch (error) {
            setPasswordResetError(error instanceof Error ? error.message : t('page.login.feedback.passwordResetFailed'));
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
            setSignupError(error instanceof Error ? error.message : t('page.login.feedback.signupFailed'));
        } finally {
            setIsSubmitting(false);
        }
    };
    return (
        <div className="flex min-h-screen w-full overflow-x-hidden bg-white">
            <aside className="login-visual-panel" aria-label={t('page.login.loginVisualAria')}>
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
                    aria-label={t('page.login.previousImage')}
                    title={t('page.login.previousImage')}
                >
                    <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className="login-visual-arrow login-visual-arrow-next"
                    onClick={showNextLoginVisualSlide}
                    aria-label={t('page.login.nextImage')}
                    title={t('page.login.nextImage')}
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
                            <p className="font-apple text-sm font-semibold text-main-1">{t('page.login.demoSignupTitle')}</p>
                            <p className="mt-1 font-apple text-sm leading-6 text-sub-2.5">
                                {t('page.login.demoSignupDescription')}
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
                                    {t('page.login.email')}
                                </label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-4" />
                                    <input
                                        id="login-email"
                                        value={loginEmail}
                                        type="email"
                                        className={`${FIELD_CLASS} pl-9`}
                                        placeholder={t('page.login.emailPlaceholder')}
                                        autoComplete="email"
                                        onChange={(event) => setLoginEmail(event.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    {t('page.login.password')}
                                </label>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-4" />
                                    <input
                                        id="login-password"
                                        value={loginPassword}
                                        type={isPasswordVisible ? 'text' : 'password'}
                                        className={`${FIELD_CLASS} px-9`}
                                        placeholder={t('page.login.passwordPlaceholder')}
                                        autoComplete="current-password"
                                        onChange={(event) => setLoginPassword(event.target.value)}
                                    />
                                    <PasswordVisibilityButton
                                        visible={isPasswordVisible}
                                        onClick={() => setIsPasswordVisible((visible) => !visible)}
                                        showLabel={t('page.login.showPassword')}
                                        hideLabel={t('page.login.hidePassword')}
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
                                                {t('page.login.forgotPassword')}
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                            <button
                                type="submit"
                                disabled={isLoginDisabled}
                                className="mx-auto flex h-[44px] w-full max-w-[334px] cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[1px] border-main-1 bg-main-1 px-[12px] text-sm font-semibold text-white transition-colors hover:bg-main-1-hover disabled:cursor-not-allowed disabled:border-transparent disabled:bg-gray-6 disabled:text-gray-3"
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {t('page.login.submitLogin')}
                            </button>
                            <p className="text-center text-sm text-gray-3">
                                {t('page.login.noAccountPrompt')}{' '}
                                <Link to={ROUTE.SIGN_UP} className="font-semibold text-main-1 underline underline-offset-[3px]">
                                    {t('page.login.signupLink')}
                                </Link>
                            </p>
                        </form>
                    ) : null}

                    {!isSignupPage && isPasswordResetMode ? (
                        <form onSubmit={handlePasswordReset} className="mx-auto mt-7 w-full max-w-[334px] space-y-4">
                            <div>
                                <label htmlFor="password-reset-email" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    {t('page.login.email')}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        id="password-reset-email"
                                        value={passwordResetEmail}
                                        type="email"
                                        className={cn(getInputClassName(Boolean(passwordResetErrors.email)), 'min-w-0')}
                                        placeholder={t('page.login.emailSignupPlaceholder')}
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
                                        {isSendingPasswordReset ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : hasRequestedPasswordReset ? (
                                            t('page.login.verificationResend')
                                        ) : (
                                            t('page.login.verificationSend')
                                        )}
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
                                            placeholder={t('page.login.sixDigitVerificationCodePlaceholder')}
                                            aria-label={t('page.login.passwordResetVerificationCodeAria')}
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
                                                className="flex h-11 w-[76px] shrink-0 cursor-pointer items-center justify-center rounded-[12px] bg-main-1 px-2 text-sm font-semibold text-white transition-colors hover:bg-main-1-hover disabled:cursor-not-allowed disabled:bg-gray-6 disabled:text-gray-3"
                                                onClick={handleConfirmPasswordResetToken}
                                            >
                                                {isConfirmingPasswordReset ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : isPasswordResetTokenVerified ? (
                                                    t('page.login.verificationComplete')
                                                ) : (
                                                    t('page.login.verificationConfirm')
                                                )}
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
                                    {t('page.login.newPassword')}
                                </label>
                                <input
                                    id="password-reset-new-password"
                                    value={passwordResetNewPassword}
                                    type="password"
                                    className={getInputClassName(Boolean(passwordResetErrors.newPassword))}
                                    placeholder={t('page.login.newPasswordPlaceholder')}
                                    autoComplete="new-password"
                                    onChange={(event) => handlePasswordResetNewPasswordChange(event.target.value)}
                                    aria-invalid={Boolean(passwordResetErrors.newPassword)}
                                    aria-describedby={passwordResetErrors.newPassword ? 'password-reset-new-password-error' : undefined}
                                />
                                <FieldError id="password-reset-new-password-error" message={passwordResetErrors.newPassword} />
                            </div>

                            <div>
                                <label htmlFor="password-reset-new-password-confirm" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    {t('page.login.newPasswordConfirm')}
                                </label>
                                <input
                                    id="password-reset-new-password-confirm"
                                    value={passwordResetNewPasswordConfirm}
                                    type="password"
                                    className={getInputClassName(Boolean(passwordResetErrors.newPasswordConfirm))}
                                    placeholder={t('page.login.newPasswordConfirmPlaceholder')}
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
                                className="mx-auto flex h-[44px] w-full max-w-[334px] cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[1px] border-main-1 bg-main-1 px-[12px] text-sm font-semibold text-white transition-colors hover:bg-main-1-hover disabled:cursor-not-allowed disabled:border-transparent disabled:bg-gray-6 disabled:text-gray-3"
                            >
                                {isResettingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {t('page.login.passwordResetSubmit')}
                            </button>
                            <p className="text-center text-sm text-gray-3">
                                <button
                                    type="button"
                                    className="cursor-pointer font-semibold text-main-1 underline underline-offset-[3px]"
                                    onClick={handleClosePasswordReset}
                                >
                                    {t('page.login.backToLogin')}
                                </button>
                            </p>
                        </form>
                    ) : null}

                    {isSignupPage ? (
                        <form onSubmit={handlePasswordSignup} className="mx-auto mt-7 w-full max-w-[334px] space-y-4">
                            <div>
                                <label htmlFor="signup-name" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    {t('page.login.name')}
                                </label>
                                <input
                                    id="signup-name"
                                    value={signupName}
                                    type="text"
                                    className={getInputClassName(Boolean(signupErrors.name))}
                                    placeholder={t('page.login.namePlaceholder')}
                                    autoComplete="name"
                                    onChange={(event) => handleSignupNameChange(event.target.value)}
                                    aria-invalid={Boolean(signupErrors.name)}
                                    aria-describedby={signupErrors.name ? 'signup-name-error' : undefined}
                                />
                                <FieldError id="signup-name-error" message={signupErrors.name} />
                            </div>

                            <div>
                                <label htmlFor="signup-email" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    {t('page.login.email')}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        id="signup-email"
                                        value={signupEmail}
                                        type="email"
                                        className={cn(getInputClassName(Boolean(signupErrors.email)), 'min-w-0')}
                                        placeholder={t('page.login.emailSignupPlaceholder')}
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
                                        {isSendingVerification ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : hasRequestedSignupVerification ? (
                                            t('page.login.verificationResend')
                                        ) : (
                                            t('page.login.verificationSend')
                                        )}
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
                                            placeholder={t('page.login.sixDigitVerificationCodePlaceholder')}
                                            aria-label={t('page.login.verificationCodeAria')}
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
                                            className="flex h-11 w-[76px] shrink-0 cursor-pointer items-center justify-center rounded-[12px] bg-main-1 px-2 text-sm font-semibold text-white transition-colors hover:bg-main-1-hover disabled:cursor-not-allowed disabled:bg-gray-6 disabled:text-gray-3"
                                            onClick={handleConfirmSignupEmailVerification}
                                        >
                                            {isConfirmingSignupVerification ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : isSignupEmailVerified ? (
                                                t('page.login.verificationComplete')
                                            ) : (
                                                t('page.login.verificationConfirm')
                                            )}
                                        </button>
                                    </div>
                                ) : null}
                                {signupVerificationMessage ? <p className="mt-1 text-xs text-main-1">{signupVerificationMessage}</p> : null}
                                <FieldError id="signup-verification-error" message={signupVerificationError ?? undefined} />
                            </div>

                            <div>
                                <label htmlFor="signup-password" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    {t('page.login.password')}
                                </label>
                                <input
                                    id="signup-password"
                                    value={signupPassword}
                                    type="password"
                                    className={getInputClassName(Boolean(signupErrors.password))}
                                    placeholder={t('page.login.passwordSignupPlaceholder')}
                                    autoComplete="new-password"
                                    onChange={(event) => handleSignupPasswordChange(event.target.value)}
                                    aria-invalid={Boolean(signupErrors.password)}
                                    aria-describedby={signupErrors.password ? 'signup-password-error' : undefined}
                                />
                                <FieldError id="signup-password-error" message={signupErrors.password} />
                            </div>

                            <div>
                                <label htmlFor="signup-password-confirm" className="mb-1.5 block text-sm font-medium text-sub-2">
                                    {t('page.login.passwordConfirm')}
                                </label>
                                <input
                                    id="signup-password-confirm"
                                    value={signupPasswordConfirm}
                                    type="password"
                                    className={getInputClassName(Boolean(signupErrors.passwordConfirm))}
                                    placeholder={t('page.login.passwordConfirmPlaceholder')}
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
                                className="mx-auto flex h-[44px] w-full max-w-[334px] cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[1px] border-main-1 bg-main-1 px-[12px] text-sm font-semibold text-white transition-colors hover:bg-main-1-hover disabled:cursor-not-allowed disabled:border-transparent disabled:bg-gray-6 disabled:text-gray-3"
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {t('page.login.submitSignup')}
                            </button>
                            <p className="text-center text-sm text-gray-3">
                                {t('page.login.hasAccountPrompt')}{' '}
                                <Link to={ROUTE.SIGN_IN} className="font-semibold text-main-1 underline underline-offset-[3px]">
                                    {t('page.login.loginLink')}
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
                                    {isSignupPage ? t('page.login.kakaoStart') : t('page.login.kakaoContinue')}
                                </a>
                                <a
                                    href={appleAuthorizeUrl}
                                    className="mx-auto flex h-[44px] w-full max-w-[334px] cursor-pointer items-center justify-center rounded-[12px] border border-[1px] border-[#231F20] bg-[#231F20] px-[12px] text-sm font-semibold text-white shadow-banner"
                                >
                                    <AppleIcon className="mr-3 h-5 w-5" />
                                    {isSignupPage ? t('page.login.appleStart') : t('page.login.appleContinue')}
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
