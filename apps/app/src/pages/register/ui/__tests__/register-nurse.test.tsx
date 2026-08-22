import {beforeEach, describe, expect, it, vi} from 'vitest';
import {saveSocialSignupProfile, clearSocialSignupProfile} from '@/features/auth/model/social-signup';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import RegisterNurse from '../register-nurse';

const mocks = vi.hoisted(() => ({
    accountMe: null as {
        name?: string;
        status?: string;
        profileImgUrl?: string | null;
        preferredLanguage?: 'ko' | 'ja' | 'en';
        serviceRegion?: 'KR' | 'JP' | 'EN';
        resolvedLanguage?: 'ko' | 'ja' | 'en';
        resolvedRegion?: 'KR' | 'JP' | 'EN';
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
        mocks.accountMe = null;
        mocks.registerAccountProfile.mockReset();
        mocks.registerAccountProfile.mockResolvedValue(undefined);
        mocks.setPhotoImage.mockReset();
        mocks.setRandomImage.mockReset();
        clearSocialSignupProfile();
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
