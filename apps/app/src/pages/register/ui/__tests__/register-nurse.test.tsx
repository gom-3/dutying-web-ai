import type {TPreferredLanguage, TServiceRegion} from '@dutying/domain';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {saveSocialSignupProfile, clearSocialSignupProfile} from '@/features/auth/model/social-signup';
import i18n from '@/i18n';
import {trackProductOutcome} from '@/shared/util/growth-analytics';
import {act, fireEvent, render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import RegisterNurse from '../register-nurse';
vi.mock('@/shared/util/growth-analytics', () => ({trackProductOutcome: vi.fn()}));

const mocks = vi.hoisted(() => ({
    accountMe: null as {
        name?: string;
        status?: string;
        profileImgUrl?: string | null;
        preferredLanguage?: TPreferredLanguage;
        serviceRegion?: TServiceRegion;
        resolvedLanguage?: TPreferredLanguage;
        resolvedRegion?: TServiceRegion;
    } | null,
    profileImg: {defaultProfileImgId: 1},
    registerAccountProfile: vi.fn(),
    setPhotoImage: vi.fn(),
    setRandomImage: vi.fn(),
}));

vi.mock('@/features/register', () => ({
    default: () => ({
        state: {
            accountMe: mocks.accountMe,
        },
        actions: {
            registerAccountProfile: mocks.registerAccountProfile,
        },
    }),
}));

vi.mock('@/features/file', () => ({
    default: () => ({
        profileImg: mocks.profileImg,
        setPhotoImage: mocks.setPhotoImage,
        setRandomImage: mocks.setRandomImage,
    }),
}));

vi.mock('@/entities/account/ui/profile-image', () => ({
    ProfileImage: () => <div aria-label="프로필 이미지" />,
}));

describe('RegisterNurse', () => {
    beforeEach(() => {
        vi.mocked(trackProductOutcome).mockReset();
        mocks.accountMe = null;
        mocks.registerAccountProfile.mockReset();
        mocks.registerAccountProfile.mockResolvedValue(undefined);
        mocks.setPhotoImage.mockReset();
        mocks.setRandomImage.mockReset();
        clearSocialSignupProfile();
    });

    it.each([
        {language: 'ko', name: '김민수', phone: '01012345678', region: 'KR'},
        {language: 'ja', name: '𠮷野　髙橋', phone: '09012345678', region: 'JP'},
        {language: 'en', name: "Jean-Luc O'Neill", phone: '+1 415 555 0132', region: 'EN'},
        {language: 'zh', name: '王小明', phone: '13800138000', region: 'CN'},
        {language: 'zh-TW', name: '陳怡君', phone: '0912345678', region: 'TW'},
        {language: 'th', name: 'สมหญิง ใจดี', phone: '0812345678', region: 'TH'},
        {language: 'vi', name: 'Nguyễn Thị Hương'.normalize('NFD'), phone: '0912345678', region: 'VN'},
    ] as const)('preserves and submits the real name for $language', async ({language, name, phone, region}) => {
        await i18n.changeLanguage(language);
        render(<RegisterNurse />);

        const nameInput = screen.getByLabelText(i18n.t('page.register.nurse.name'));

        fireEvent.change(nameInput, {target: {value: name}});
        expect(nameInput).toHaveValue(name);
        fireEvent.change(screen.getByLabelText(i18n.t('page.register.nurse.phoneNum')), {target: {value: phone}});
        fireEvent.click(screen.getByRole('button', {name: i18n.t('page.register.nurse.next')}));

        await waitFor(() => {
            expect(mocks.registerAccountProfile).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: name.replace(/\u3000/g, ' '),
                    phoneNum: phone,
                    preferredLanguage: language === 'zh-TW' ? 'zh' : language,
                    serviceRegion: region,
                }),
            );
        });
    });

    it('preserves IME preedit text and uses Enter to confirm a candidate without submitting the form', async () => {
        render(<RegisterNurse />);

        const nameInput = screen.getByLabelText('이름');

        fireEvent.compositionStart(nameInput);
        fireEvent.change(nameInput, {target: {value: 'ｙａｍａｄａ'}});
        expect(nameInput).toHaveValue('ｙａｍａｄａ');
        fireEvent.change(nameInput, {target: {value: '𠮷野　花子'}});
        expect(nameInput).toHaveValue('𠮷野　花子');
        expect(fireEvent.keyDown(nameInput, {key: 'Enter', keyCode: 229, isComposing: true})).toBe(false);
        fireEvent.submit(nameInput.closest('form')!);
        expect(mocks.registerAccountProfile).not.toHaveBeenCalled();

        fireEvent.compositionEnd(nameInput);
        fireEvent.change(screen.getByLabelText('연락처'), {target: {value: '01012345678'}});
        fireEvent.click(screen.getByRole('button', {name: '다음'}));

        await waitFor(() => expect(mocks.registerAccountProfile).toHaveBeenCalledWith(expect.objectContaining({name: '𠮷野 花子'})));
    });

    it.each(['Enter with isComposing', 'Safari keyCode 229'])('does not submit on %s without composition events', async (variant) => {
        render(<RegisterNurse />);

        await act(async () => {
            expect(
                fireEvent.keyDown(screen.getByLabelText('이름'), {
                    key: 'Enter',
                    keyCode: variant === 'Safari keyCode 229' ? 229 : 13,
                    isComposing: variant === 'Enter with isComposing',
                }),
            ).toBe(false);
        });
        expect(mocks.registerAccountProfile).not.toHaveBeenCalled();
    });

    it('keeps invalid or overlong names visible and explains the error instead of deleting characters', async () => {
        render(<RegisterNurse />);

        const nameInput = screen.getByLabelText('이름');
        const draft = `${'山田'.repeat(25)}🙂`;

        fireEvent.change(nameInput, {target: {value: draft}});
        fireEvent.change(screen.getByLabelText('연락처'), {target: {value: '01012345678'}});
        fireEvent.click(screen.getByRole('button', {name: '다음'}));

        await waitFor(() => expect(nameInput).toHaveAttribute('aria-invalid', 'true'));
        expect(nameInput).toHaveValue(draft);
        expect(screen.getByText(i18n.t('page.register.nurse.validation.nameInvalid'))).toBeVisible();
        expect(mocks.registerAccountProfile).not.toHaveBeenCalled();
    });

    it('preserves fullwidth phone composition and submits the normalized Japanese phone number', async () => {
        await i18n.changeLanguage('ja');
        render(<RegisterNurse />);

        fireEvent.change(screen.getByLabelText('名前'), {target: {value: '山田 花子'}});

        const phoneInput = screen.getByLabelText('連絡先');

        fireEvent.compositionStart(phoneInput);
        fireEvent.change(phoneInput, {target: {value: '０９０１２３４５６７８'}});
        expect(phoneInput).toHaveValue('０９０１２３４５６７８');
        fireEvent.compositionEnd(phoneInput);
        expect(phoneInput).toHaveValue('09012345678');
        fireEvent.click(screen.getByRole('button', {name: '次へ'}));

        await waitFor(() => expect(mocks.registerAccountProfile).toHaveBeenCalledWith(expect.objectContaining({phoneNum: '09012345678'})));
    });

    it.each(['+86 13800138000', '+886 912345678'])(
        'accepts the international number %s regardless of Korean display language or default country',
        async (phone) => {
            render(<RegisterNurse />);
            fireEvent.change(screen.getByLabelText('이름'), {target: {value: 'Global Nurse'}});
            fireEvent.change(screen.getByLabelText('연락처'), {target: {value: phone}});
            fireEvent.click(screen.getByRole('button', {name: '다음'}));
            await waitFor(() => expect(mocks.registerAccountProfile).toHaveBeenCalledWith(expect.objectContaining({phoneNum: phone})));
        },
    );

    it('keeps the selected phone country when the display language changes', async () => {
        render(<RegisterNurse />);
        fireEvent.change(screen.getByLabelText('전화번호 국가/지역'), {target: {value: 'TW'}});
        await act(async () => {
            await i18n.changeLanguage('en');
        });

        expect(screen.getByLabelText('Phone country/region')).toHaveValue('TW');
        fireEvent.change(screen.getByLabelText('Name'), {target: {value: 'Taiwan Nurse'}});
        fireEvent.change(screen.getByLabelText(i18n.t('page.register.nurse.phoneNum')), {target: {value: '0912345678'}});
        fireEvent.click(screen.getByRole('button', {name: i18n.t('page.register.nurse.next')}));
        await waitFor(() =>
            expect(mocks.registerAccountProfile).toHaveBeenCalledWith(
                expect.objectContaining({phoneNum: '0912345678', phoneCountry: 'TW', preferredLanguage: 'en'}),
            ),
        );
    });

    it('keeps malformed phone text visible and blocks submission instead of stripping letters into a valid number', async () => {
        render(<RegisterNurse />);

        const phone = screen.getByLabelText('연락처');

        fireEvent.change(screen.getByLabelText('이름'), {target: {value: 'Global Nurse'}});
        fireEvent.change(phone, {target: {value: 'call +86 13800138000'}});
        fireEvent.click(screen.getByRole('button', {name: '다음'}));
        await waitFor(() => expect(phone).toHaveAttribute('aria-invalid', 'true'));
        expect(phone).toHaveValue('call +86 13800138000');
        expect(screen.getByText(i18n.t('shared.contactPhone.invalid'))).toBeVisible();
        expect(mocks.registerAccountProfile).not.toHaveBeenCalled();
    });

    it.each(['ko', 'ja', 'en', 'zh', 'zh-TW', 'th', 'vi'])(
        'identifies a duplicate phone by server code when the UI uses %s',
        async (language) => {
            await i18n.changeLanguage(language);
            mocks.registerAccountProfile.mockRejectedValue({code: 409, serverCode: 'PHONE_ALREADY_USED', message: 'Localized error'});
            render(<RegisterNurse />);
            fireEvent.change(screen.getByLabelText(i18n.t('page.register.nurse.name')), {target: {value: 'Global Nurse'}});

            const phone = screen.getByLabelText(i18n.t('page.register.nurse.phoneNum'));

            fireEvent.change(phone, {target: {value: '+86 13800138000'}});
            fireEvent.click(screen.getByRole('button', {name: i18n.t('page.register.nurse.next')}));
            await waitFor(() => expect(phone).toHaveAttribute('aria-invalid', 'true'));
            expect(screen.getByText(i18n.t('page.register.nurse.validation.phoneDuplicate'))).toBeVisible();
        },
    );

    it('shows a localized field error if the server rejects a phone number', async () => {
        await i18n.changeLanguage('ja');
        mocks.registerAccountProfile.mockRejectedValue({
            code: 400,
            serverCode: 'INVALID_PHONE_NUMBER',
            messageKey: 'error.invalidPhoneNumber',
        });
        render(<RegisterNurse />);
        fireEvent.change(screen.getByLabelText('名前'), {target: {value: '山田 花子'}});

        const phone = screen.getByLabelText('連絡先');

        fireEvent.change(phone, {target: {value: '+86 13800138000'}});
        fireEvent.click(screen.getByRole('button', {name: '次へ'}));
        await waitFor(() => expect(phone).toHaveAttribute('aria-invalid', 'true'));
        expect(screen.getByText(i18n.t('shared.contactPhone.invalid'))).toBeVisible();
    });

    it('submits account profile with contact information without creating a nurse profile', async () => {
        const user = userEvent.setup();

        render(<RegisterNurse />);

        await user.type(screen.getByPlaceholderText('이름을 입력해주세요'), '홍길동');
        await user.type(screen.getByPlaceholderText('연락처를 입력해주세요'), '01012345678');
        await user.click(screen.getByRole('button', {name: '다음'}));

        await waitFor(() => {
            expect(mocks.registerAccountProfile).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: '홍길동',
                    phoneNum: '01012345678',
                    preferredLanguage: 'ko',
                    serviceRegion: 'KR',
                    profileImg: {defaultProfileImgId: 1},
                }),
            );
        });

        expect(screen.queryByText('성별')).not.toBeInTheDocument();
        expect(screen.queryByText('입사일')).not.toBeInTheDocument();
        expect(screen.queryByText('근무자로 참여하기')).not.toBeInTheDocument();
    });

    it('does not prefill the social name and submits the typed real name in social signup mode', async () => {
        const user = userEvent.setup();

        saveSocialSignupProfile({
            provider: 'KAKAO',
            name: '소셜홍',
            capturedAt: new Date().toISOString(),
        });

        render(<RegisterNurse mode="social" />);

        const nameInput = screen.getByPlaceholderText('이름을 입력해주세요');

        expect(nameInput).toHaveValue('');

        await user.type(nameInput, '홍길동');
        await user.type(screen.getByPlaceholderText('연락처를 입력해주세요'), '01098765432');
        await user.click(screen.getByRole('button', {name: '다음'}));

        await waitFor(() => {
            expect(mocks.registerAccountProfile).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: '홍길동',
                    phoneNum: '01098765432',
                    profileImg: {defaultProfileImgId: 1},
                }),
            );
        });
    });

    it.each(['INITIAL', 'WORKSPACE_SETUP_PENDING'])(
        'counts successful social registration at %s only after the API resolves',
        async (status) => {
            const user = userEvent.setup();

            mocks.accountMe = {status};

            let finish!: () => void;

            mocks.registerAccountProfile.mockImplementationOnce(
                () =>
                    new Promise<void>((resolve) => {
                        finish = resolve;
                    }),
            );
            render(<RegisterNurse mode="social" />);
            await user.type(screen.getByPlaceholderText('이름을 입력해주세요'), '홍길동');
            await user.type(screen.getByPlaceholderText('연락처를 입력해주세요'), '01098765432');
            await user.click(screen.getByRole('button', {name: '다음'}));
            expect(trackProductOutcome).not.toHaveBeenCalled();
            finish();
            await waitFor(() => expect(trackProductOutcome).toHaveBeenCalledExactlyOnceWith('sign_up', 'social'));
        },
    );

    it.each(['NURSE_INFO_PENDING', 'WARD_SELECT_PENDING'])('does not count an already registered account at %s again', async (status) => {
        const user = userEvent.setup();

        mocks.accountMe = {status};
        render(<RegisterNurse mode="social" />);
        await user.type(screen.getByPlaceholderText('이름을 입력해주세요'), '홍길동');
        await user.type(screen.getByPlaceholderText('연락처를 입력해주세요'), '01098765432');
        await user.click(screen.getByRole('button', {name: '다음'}));
        await waitFor(() => expect(mocks.registerAccountProfile).toHaveBeenCalledTimes(1));
        expect(trackProductOutcome).not.toHaveBeenCalled();
    });

    it('does not count a failed social registration', async () => {
        const user = userEvent.setup();

        mocks.accountMe = {status: 'INITIAL'};
        mocks.registerAccountProfile.mockRejectedValueOnce(new Error('signup failed'));
        render(<RegisterNurse mode="social" />);
        await user.type(screen.getByPlaceholderText('이름을 입력해주세요'), '홍길동');
        await user.type(screen.getByPlaceholderText('연락처를 입력해주세요'), '01098765432');
        await user.click(screen.getByRole('button', {name: '다음'}));
        await waitFor(() => expect(mocks.registerAccountProfile).toHaveBeenCalledTimes(1));
        expect(trackProductOutcome).not.toHaveBeenCalled();
    });

    it('submits an English-region international phone number', async () => {
        const user = userEvent.setup();

        mocks.accountMe = {
            preferredLanguage: 'en',
            serviceRegion: 'EN',
        };

        const {container} = render(<RegisterNurse />);
        const nameInput = container.querySelector('#name') as HTMLInputElement;
        const phoneInput = container.querySelector('#phone-num') as HTMLInputElement;

        await user.type(nameInput, 'Alex Kim');
        await user.type(phoneInput, '+1 (415) 555-0132');

        const buttons = screen.getAllByRole('button');

        await user.click(buttons[buttons.length - 1]);

        await waitFor(() => {
            expect(mocks.registerAccountProfile).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Alex Kim',
                    phoneNum: '+1 (415) 555-0132',
                    profileImg: {defaultProfileImgId: 1},
                }),
            );
        });
    });

    it('submits signup language and service region with the profile', async () => {
        const user = userEvent.setup();

        mocks.accountMe = {
            preferredLanguage: 'ja',
            serviceRegion: 'JP',
        };

        render(<RegisterNurse />);

        await user.type(screen.getByPlaceholderText('이름을 입력해주세요'), 'Yamada');
        await user.type(screen.getByPlaceholderText('연락처를 입력해주세요'), '09012345678');
        await user.click(screen.getByRole('button', {name: '다음'}));

        await waitFor(() => {
            expect(mocks.registerAccountProfile).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Yamada',
                    phoneNum: '09012345678',
                    preferredLanguage: 'ja',
                    serviceRegion: 'JP',
                    profileImg: {defaultProfileImgId: 1},
                }),
            );
        });
    });

    it('uses server-resolved signup locale before the browser language fallback', async () => {
        const user = userEvent.setup();

        mocks.accountMe = {
            resolvedLanguage: 'ja',
            resolvedRegion: 'JP',
        };

        render(<RegisterNurse />);

        await user.type(screen.getByPlaceholderText('이름을 입력해주세요'), 'Yamada');
        await user.type(screen.getByPlaceholderText('연락처를 입력해주세요'), '09012345678');
        await user.click(screen.getByRole('button', {name: '다음'}));

        await waitFor(() => {
            expect(mocks.registerAccountProfile).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Yamada',
                    phoneNum: '09012345678',
                    preferredLanguage: 'ja',
                    serviceRegion: 'JP',
                    profileImg: {defaultProfileImgId: 1},
                }),
            );
        });
    });

    it('does not prefill the account name in social signup mode', async () => {
        mocks.accountMe = {
            name: '소셜홍',
            status: 'WORKSPACE_SETUP_PENDING',
            profileImgUrl: null,
        };

        render(<RegisterNurse mode="social" />);

        const nameInput = screen.getByPlaceholderText('이름을 입력해주세요');

        await waitFor(() => {
            expect(nameInput).toHaveValue('');
        });
    });

    it('shows a contact field error when the phone number is already used', async () => {
        const user = userEvent.setup();

        mocks.registerAccountProfile.mockRejectedValue({
            code: 409,
            message: 'PHONE_NUM_ALREADY_USED',
        });

        render(<RegisterNurse />);

        const phoneInput = screen.getByPlaceholderText('연락처를 입력해주세요');

        await user.type(screen.getByPlaceholderText('이름을 입력해주세요'), '홍길동');
        await user.type(phoneInput, '01012345678');
        await user.click(screen.getByRole('button', {name: '다음'}));

        await waitFor(() => {
            expect(screen.getByText('이미 사용 중인 연락처예요. 다른 번호를 입력해 주세요.')).toBeInTheDocument();
        });

        expect(phoneInput).toHaveAttribute('aria-invalid', 'true');
    });
});
