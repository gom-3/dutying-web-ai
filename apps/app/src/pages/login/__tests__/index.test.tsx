import {MemoryRouter, Route, Routes} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import ROUTE from '@/shared/constant/path';
import {act, fireEvent, render, screen, userEvent} from '@/shared/util/test-utils';
import LoginPage from '../index';

const {
    mockConfirmEmailVerification,
    mockConfirmPasswordResetToken,
    mockHandleLogin,
    mockPasswordLogin,
    mockPasswordReset,
    mockPasswordResetRequest,
    mockPasswordSignup,
    mockSendAdminEmailVerification,
} = vi.hoisted(() => ({
    mockConfirmEmailVerification: vi.fn(),
    mockConfirmPasswordResetToken: vi.fn(),
    mockHandleLogin: vi.fn(),
    mockPasswordLogin: vi.fn(),
    mockPasswordReset: vi.fn(),
    mockPasswordResetRequest: vi.fn(),
    mockPasswordSignup: vi.fn(),
    mockSendAdminEmailVerification: vi.fn(),
}));

vi.mock('@/features/auth', () => ({
    default: () => ({
        actions: {
            handleLogin: mockHandleLogin,
        },
    }),
}));

vi.mock('@/shared/api', () => ({
    AuthAPI: {
        passwordLogin: mockPasswordLogin,
        passwordSignup: mockPasswordSignup,
        confirmAdminEmailVerification: mockConfirmEmailVerification,
        requestAdminPasswordReset: mockPasswordResetRequest,
        confirmAdminPasswordResetToken: mockConfirmPasswordResetToken,
        resetAdminPassword: mockPasswordReset,
        sendAdminEmailVerification: mockSendAdminEmailVerification,
    },
}));

const INVALID_LOGIN_CREDENTIALS_MESSAGE = '아이디 또는 비밀번호가 올바르지 않습니다.';

const openPasswordResetAfterInvalidLogin = async (user: ReturnType<typeof userEvent.setup>) => {
    mockPasswordLogin.mockRejectedValueOnce(new Error(INVALID_LOGIN_CREDENTIALS_MESSAGE));

    await user.type(screen.getByLabelText('이메일'), 'admin@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'wrong-password');
    await user.click(screen.getByRole('button', {name: '로그인'}));
    await screen.findByText(INVALID_LOGIN_CREDENTIALS_MESSAGE);
    await user.click(screen.getByRole('button', {name: '비밀번호 찾기'}));
};

describe('LoginPage', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('VITE_APP_PUBLIC_URL', 'https://app.dutying.ai');
        vi.stubEnv('VITE_SERVER_URL', 'https://api.dutying.ai');
    });

    it('renders sign-in as the default admin login page with a signup entry', () => {
        render(
            <MemoryRouter initialEntries={[ROUTE.SIGN_IN]}>
                <Routes>
                    <Route path={ROUTE.SIGN_IN} element={<LoginPage />} />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', {name: '로그인'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '이전 이미지'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '다음 이미지'})).toBeInTheDocument();
        expect(screen.getByText('1/3')).toBeInTheDocument();
        const visualImages = document.querySelectorAll('.login-visual-slide');
        expect(visualImages).toHaveLength(3);
        expect(visualImages[0]).toHaveAttribute('loading', 'eager');
        expect(visualImages[1]).toHaveAttribute('loading', 'lazy');
        expect(visualImages[1]).not.toHaveAttribute('src');
        expect(document.querySelector('source[type="image/webp"]')).toHaveAttribute(
            'srcset',
            '/img/login-slide-1.webp',
        );
        expect(screen.queryByLabelText('병원명 또는 기관명')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '비밀번호 찾기'})).not.toBeInTheDocument();
        expect(screen.getByText('아직 계정이 없나요?')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '회원가입'})).toHaveAttribute('href', ROUTE.SIGN_UP);
        expect(screen.getByRole('link', {name: '카카오로 계속하기'})).toHaveAttribute(
            'href',
            'https://api.dutying.ai/oauth2/authorization/admin/kakao?nextPageUrl=https%3A%2F%2Fapp.dutying.ai%2Fhome',
        );
        expect(screen.getByRole('link', {name: 'Apple로 계속하기'})).toHaveAttribute(
            'href',
            'https://api.dutying.ai/oauth2/authorization/admin/apple?nextPageUrl=https%3A%2F%2Fapp.dutying.ai%2Fhome',
        );
    });

    it('resumes visual auto rotation 3 seconds after manual navigation', () => {
        vi.useFakeTimers();

        try {
            render(
                <MemoryRouter initialEntries={[ROUTE.SIGN_IN]}>
                    <Routes>
                        <Route path={ROUTE.SIGN_IN} element={<LoginPage />} />
                    </Routes>
                </MemoryRouter>,
            );

            expect(screen.getByText('1/3')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', {name: '다음 이미지'}));
            expect(screen.getByText('2/3')).toBeInTheDocument();

            act(() => {
                vi.advanceTimersByTime(2999);
            });
            expect(screen.getByText('2/3')).toBeInTheDocument();

            act(() => {
                vi.advanceTimersByTime(1);
            });
            expect(screen.getByText('3/3')).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('shows password reset under the invalid login message only after credential failure', async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={[ROUTE.SIGN_IN]}>
                <Routes>
                    <Route path={ROUTE.SIGN_IN} element={<LoginPage />} />
                </Routes>
            </MemoryRouter>,
        );

        mockPasswordLogin.mockRejectedValueOnce(new Error(INVALID_LOGIN_CREDENTIALS_MESSAGE));

        await user.type(screen.getByLabelText('이메일'), 'admin@example.com');
        await user.type(screen.getByLabelText('비밀번호'), 'wrong-password');
        await user.click(screen.getByRole('button', {name: '로그인'}));

        const loginError = await screen.findByRole('alert');
        const passwordResetButton = screen.getByRole('button', {name: '비밀번호 찾기'});

        expect(loginError).toHaveTextContent(INVALID_LOGIN_CREDENTIALS_MESSAGE);
        expect(loginError.nextElementSibling).toContainElement(passwordResetButton);
    });

    it('renders sign-up as a separate account page with social buttons', () => {
        render(
            <MemoryRouter initialEntries={[`${ROUTE.SIGN_UP}?reason=demo-expired&next=%2Fregister`]}>
                <Routes>
                    <Route path={ROUTE.SIGN_UP} element={<LoginPage />} />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByText('체험 계정을 정식 계정으로 전환해요')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: '회원가입'})).toBeInTheDocument();
        expect(screen.getByLabelText('이름')).toBeInTheDocument();
        expect(screen.getByLabelText('이메일')).toBeInTheDocument();
        expect(screen.queryByLabelText('병원명 또는 기관명')).not.toBeInTheDocument();
        expect(screen.getByRole('link', {name: '로그인'})).toHaveAttribute('href', ROUTE.SIGN_IN);
        expect(screen.getByRole('link', {name: '카카오로 시작하기'})).toHaveAttribute(
            'href',
            'https://api.dutying.ai/oauth2/authorization/admin/kakao?nextPageUrl=https%3A%2F%2Fapp.dutying.ai%2Fregister%3FsocialSignup%3D1',
        );
    });

    it('requests email verification and sends the entered token when signing up', async () => {
        const user = userEvent.setup();

        mockSendAdminEmailVerification.mockResolvedValueOnce({email: 'admin@example.com'});
        mockConfirmEmailVerification.mockResolvedValueOnce(undefined);
        mockPasswordSignup.mockResolvedValueOnce({accessToken: 'admin-token'});

        render(
            <MemoryRouter initialEntries={[ROUTE.SIGN_UP]}>
                <Routes>
                    <Route path={ROUTE.SIGN_UP} element={<LoginPage />} />
                </Routes>
            </MemoryRouter>,
        );

        await user.type(screen.getByLabelText('이름'), '김관리');
        await user.type(screen.getByLabelText('이메일'), 'admin@example.com');
        await user.click(screen.getByRole('button', {name: '인증'}));
        expect(await screen.findByText('인증 메일을 보냈어요. 메일함에서 인증번호를 확인해 입력해 주세요.')).toBeInTheDocument();
        await user.type(screen.getByLabelText('이메일 인증번호'), 'abc1234567');
        await user.click(screen.getByRole('button', {name: '확인'}));
        expect(await screen.findByText('이메일 인증이 완료됐어요.')).toBeInTheDocument();
        await user.type(screen.getByLabelText('비밀번호'), 'password1234');
        await user.type(screen.getByLabelText('비밀번호 확인'), 'password1234');
        await user.click(screen.getAllByRole('checkbox')[0]);
        await user.click(screen.getByRole('button', {name: '계정 만들기'}));

        expect(mockSendAdminEmailVerification).toHaveBeenCalledWith({email: 'admin@example.com'});
        expect(mockConfirmEmailVerification).toHaveBeenCalledWith({email: 'admin@example.com', emailVerificationToken: '123456'});
        expect(mockPasswordSignup).toHaveBeenCalledWith({
            name: '김관리',
            email: 'admin@example.com',
            emailVerificationToken: '123456',
            password: 'password1234',
            legalAgreements: [
                expect.objectContaining({
                    documentType: 'TERMS_OF_SERVICE',
                    documentVersion: '2026-06-20',
                    documentUrl: 'https://www.notion.so/37698c0fae2580d1a3d2dcbb0c163fc9?source=copy_link',
                    agreed: true,
                    agreedAt: expect.any(String),
                    preferredLanguage: 'ko',
                    locale: 'ko-KR',
                    serviceRegion: 'KR',
                }),
            ],
        });
        expect(mockHandleLogin).toHaveBeenCalledWith('admin-token', ROUTE.REGISTER);
    });

    it('includes the optional marketing agreement only when selected', async () => {
        const user = userEvent.setup();

        mockSendAdminEmailVerification.mockResolvedValueOnce({email: 'admin@example.com'});
        mockConfirmEmailVerification.mockResolvedValueOnce(undefined);
        mockPasswordSignup.mockResolvedValueOnce({accessToken: 'admin-token'});

        render(
            <MemoryRouter initialEntries={[ROUTE.SIGN_UP]}>
                <Routes>
                    <Route path={ROUTE.SIGN_UP} element={<LoginPage />} />
                </Routes>
            </MemoryRouter>,
        );

        await user.type(screen.getByLabelText('이름'), '김관리');
        await user.type(screen.getByLabelText('이메일'), 'admin@example.com');
        await user.click(screen.getByRole('button', {name: '인증'}));
        await screen.findByText('인증 메일을 보냈어요. 메일함에서 인증번호를 확인해 입력해 주세요.');
        await user.type(screen.getByLabelText('이메일 인증번호'), '123456');
        await user.click(screen.getByRole('button', {name: '확인'}));
        await screen.findByText('이메일 인증이 완료됐어요.');
        await user.type(screen.getByLabelText('비밀번호'), 'password1234');
        await user.type(screen.getByLabelText('비밀번호 확인'), 'password1234');

        const [termsCheckbox, marketingCheckbox] = screen.getAllByRole('checkbox');

        await user.click(termsCheckbox);
        await user.click(marketingCheckbox);
        await user.click(screen.getByRole('button', {name: '계정 만들기'}));

        expect(mockPasswordSignup).toHaveBeenCalledWith(
            expect.objectContaining({
                legalAgreements: [
                    expect.objectContaining({documentType: 'TERMS_OF_SERVICE'}),
                    expect.objectContaining({
                        documentType: 'MARKETING_COMMUNICATIONS',
                        documentVersion: '2026-06-20',
                        agreed: true,
                        agreedAt: expect.any(String),
                    }),
                ],
            }),
        );
    });

    it('shows required signup field errors when creating an account with empty fields', async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={[ROUTE.SIGN_UP]}>
                <Routes>
                    <Route path={ROUTE.SIGN_UP} element={<LoginPage />} />
                </Routes>
            </MemoryRouter>,
        );

        await user.click(screen.getByRole('button', {name: '계정 만들기'}));

        expect(screen.getByLabelText('이름')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('이메일')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('비밀번호')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('비밀번호 확인')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByText('이름을 입력해 주세요.')).toBeInTheDocument();
        expect(screen.getByText('올바른 이메일 주소를 입력해 주세요.')).toBeInTheDocument();
        expect(screen.getByText('비밀번호는 8자 이상 입력해 주세요.')).toBeInTheDocument();
        expect(screen.getByText('비밀번호를 다시 입력해 주세요.')).toBeInTheDocument();
        expect(screen.getByText('이용약관에 동의해 주세요.')).toBeInTheDocument();
        expect(mockPasswordSignup).not.toHaveBeenCalled();
    });

    it('clears signup field errors as soon as the current input becomes valid', async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={[ROUTE.SIGN_UP]}>
                <Routes>
                    <Route path={ROUTE.SIGN_UP} element={<LoginPage />} />
                </Routes>
            </MemoryRouter>,
        );

        const emailInput = screen.getByLabelText('이메일');
        const passwordInput = screen.getByLabelText('비밀번호');
        const passwordConfirmInput = screen.getByLabelText('비밀번호 확인');

        await user.click(screen.getByRole('button', {name: '계정 만들기'}));

        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
        expect(passwordConfirmInput).toHaveAttribute('aria-invalid', 'true');

        await user.type(emailInput, 'admin@example.com');
        await user.type(passwordInput, 'password1234');
        await user.type(passwordConfirmInput, 'password1234');

        expect(emailInput).toHaveAttribute('aria-invalid', 'false');
        expect(passwordInput).toHaveAttribute('aria-invalid', 'false');
        expect(passwordConfirmInput).toHaveAttribute('aria-invalid', 'false');
        expect(screen.queryByText('올바른 이메일 주소를 입력해 주세요.')).not.toBeInTheDocument();
        expect(screen.queryByText('비밀번호는 8자 이상 입력해 주세요.')).not.toBeInTheDocument();
        expect(screen.queryByText('비밀번호를 다시 입력해 주세요.')).not.toBeInTheDocument();
    });

    it('clears the signup password confirmation error when either password field makes the values match', async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={[ROUTE.SIGN_UP]}>
                <Routes>
                    <Route path={ROUTE.SIGN_UP} element={<LoginPage />} />
                </Routes>
            </MemoryRouter>,
        );

        const passwordInput = screen.getByLabelText('비밀번호');
        const passwordConfirmInput = screen.getByLabelText('비밀번호 확인');

        await user.type(screen.getByLabelText('이름'), '김관리');
        await user.type(screen.getByLabelText('이메일'), 'admin@example.com');
        await user.type(passwordInput, 'password1234');
        await user.type(passwordConfirmInput, 'different1234');
        await user.click(screen.getByRole('button', {name: '계정 만들기'}));

        expect(screen.getByText('비밀번호가 서로 달라요.')).toBeInTheDocument();
        expect(passwordConfirmInput).toHaveAttribute('aria-invalid', 'true');

        await user.clear(passwordInput);
        await user.type(passwordInput, 'different1234');

        expect(passwordConfirmInput).toHaveAttribute('aria-invalid', 'false');
        expect(screen.queryByText('비밀번호가 서로 달라요.')).not.toBeInTheDocument();
    });

    it('shows the missing email verification state when creating an account before confirmation', async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={[ROUTE.SIGN_UP]}>
                <Routes>
                    <Route path={ROUTE.SIGN_UP} element={<LoginPage />} />
                </Routes>
            </MemoryRouter>,
        );

        await user.type(screen.getByLabelText('이름'), '김관리');
        await user.type(screen.getByLabelText('이메일'), 'admin@example.com');
        await user.type(screen.getByLabelText('비밀번호'), 'password1234');
        await user.type(screen.getByLabelText('비밀번호 확인'), 'password1234');
        await user.click(screen.getByRole('button', {name: '계정 만들기'}));

        expect(screen.getByText('이메일 인증을 완료해 주세요.')).toBeInTheDocument();
        expect(mockPasswordSignup).not.toHaveBeenCalled();
    });

    it('highlights the required name field when creating an account without a name', async () => {
        const user = userEvent.setup();

        mockSendAdminEmailVerification.mockResolvedValueOnce({email: 'admin@example.com'});
        mockConfirmEmailVerification.mockResolvedValueOnce(undefined);

        render(
            <MemoryRouter initialEntries={[ROUTE.SIGN_UP]}>
                <Routes>
                    <Route path={ROUTE.SIGN_UP} element={<LoginPage />} />
                </Routes>
            </MemoryRouter>,
        );

        const nameInput = screen.getByLabelText('이름');

        await user.type(screen.getByLabelText('이메일'), 'admin@example.com');
        await user.click(screen.getByRole('button', {name: '인증'}));
        expect(await screen.findByText('인증 메일을 보냈어요. 메일함에서 인증번호를 확인해 입력해 주세요.')).toBeInTheDocument();
        await user.type(screen.getByLabelText('이메일 인증번호'), '123456');
        await user.click(screen.getByRole('button', {name: '확인'}));
        expect(await screen.findByText('이메일 인증이 완료됐어요.')).toBeInTheDocument();
        await user.type(screen.getByLabelText('비밀번호'), 'password1234');
        await user.type(screen.getByLabelText('비밀번호 확인'), 'password1234');
        await user.click(screen.getByRole('button', {name: '계정 만들기'}));

        expect(nameInput).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByText('이름을 입력해 주세요.')).toBeInTheDocument();
        expect(mockPasswordSignup).not.toHaveBeenCalled();

        await user.type(nameInput, '김관리');

        expect(nameInput).toHaveAttribute('aria-invalid', 'false');
        expect(screen.queryByText('이름을 입력해 주세요.')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '계정 만들기'})).toBeEnabled();
    });

    it('shows required password reset field errors only after submitting the reset form', async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={[ROUTE.SIGN_IN]}>
                <Routes>
                    <Route path={ROUTE.SIGN_IN} element={<LoginPage />} />
                </Routes>
            </MemoryRouter>,
        );

        await openPasswordResetAfterInvalidLogin(user);
        await user.clear(screen.getByLabelText('이메일'));

        expect(screen.queryByText('올바른 이메일 주소를 입력해 주세요.')).not.toBeInTheDocument();
        expect(screen.queryByText('비밀번호는 8자 이상 입력해 주세요.')).not.toBeInTheDocument();
        expect(screen.queryByText('비밀번호를 다시 입력해 주세요.')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '비밀번호 재설정'})).toBeEnabled();

        await user.click(screen.getByRole('button', {name: '비밀번호 재설정'}));

        expect(screen.getByLabelText('이메일')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('새 비밀번호')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('새 비밀번호 확인')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByText('올바른 이메일 주소를 입력해 주세요.')).toBeInTheDocument();
        expect(screen.getByText('비밀번호는 8자 이상 입력해 주세요.')).toBeInTheDocument();
        expect(screen.getByText('비밀번호를 다시 입력해 주세요.')).toBeInTheDocument();
        expect(mockPasswordReset).not.toHaveBeenCalled();
    });

    it('shows the missing password reset verification state before confirmation', async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={[ROUTE.SIGN_IN]}>
                <Routes>
                    <Route path={ROUTE.SIGN_IN} element={<LoginPage />} />
                </Routes>
            </MemoryRouter>,
        );

        await openPasswordResetAfterInvalidLogin(user);
        await user.type(screen.getByLabelText('새 비밀번호'), 'new-password123');
        await user.type(screen.getByLabelText('새 비밀번호 확인'), 'new-password123');
        await user.click(screen.getByRole('button', {name: '비밀번호 재설정'}));

        expect(screen.getByText('이메일 인증을 완료해 주세요.')).toBeInTheDocument();
        expect(mockPasswordReset).not.toHaveBeenCalled();
    });

    it('resets a forgotten password with an emailed six digit token', async () => {
        const user = userEvent.setup();

        mockPasswordResetRequest.mockResolvedValueOnce({email: 'admin@example.com'});
        mockConfirmPasswordResetToken.mockResolvedValueOnce(undefined);
        mockPasswordReset.mockResolvedValueOnce(undefined);

        render(
            <MemoryRouter initialEntries={[ROUTE.SIGN_IN]}>
                <Routes>
                    <Route path={ROUTE.SIGN_IN} element={<LoginPage />} />
                </Routes>
            </MemoryRouter>,
        );

        await openPasswordResetAfterInvalidLogin(user);
        expect(screen.getByRole('heading', {name: '비밀번호 찾기'})).toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '인증'}));
        expect(await screen.findByText('인증 메일을 보냈어요. 메일함에서 인증번호를 확인해 입력해 주세요.')).toBeInTheDocument();
        await user.type(screen.getByLabelText('비밀번호 재설정 인증번호'), 'abc6543210');
        await user.click(screen.getByRole('button', {name: '확인'}));
        expect(await screen.findByText('인증번호를 확인했어요. 새 비밀번호를 입력해 주세요.')).toBeInTheDocument();
        await user.type(screen.getByLabelText('새 비밀번호'), 'new-password123');
        await user.type(screen.getByLabelText('새 비밀번호 확인'), 'new-password123');
        await user.click(screen.getByRole('button', {name: '비밀번호 재설정'}));

        expect(mockPasswordResetRequest).toHaveBeenCalledWith({email: 'admin@example.com'});
        expect(mockConfirmPasswordResetToken).toHaveBeenCalledWith({email: 'admin@example.com', resetToken: '654321'});
        expect(mockPasswordReset).toHaveBeenCalledWith({
            email: 'admin@example.com',
            resetToken: '654321',
            newPassword: 'new-password123',
        });
        expect(await screen.findByText('비밀번호가 변경됐어요. 새 비밀번호로 로그인해 주세요.')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: '로그인'})).toBeInTheDocument();
    });
});
