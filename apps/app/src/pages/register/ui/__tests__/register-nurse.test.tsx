import {beforeEach, describe, expect, it, vi} from 'vitest';
import {saveSocialSignupProfile, clearSocialSignupProfile} from '@/features/auth/model/social-signup';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import RegisterNurse from '../register-nurse';

const mocks = vi.hoisted(() => ({
    accountMe: null as {name?: string; status?: string; profileImgUrl?: string | null} | null,
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
});
