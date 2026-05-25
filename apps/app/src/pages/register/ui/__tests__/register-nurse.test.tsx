import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import RegisterNurse from '../register-nurse';

const mocks = vi.hoisted(() => ({
    profileImg: {defaultProfileImgId: 1},
    registerAccountAndNurse: vi.fn(),
    setPhotoImage: vi.fn(),
    setRandomImage: vi.fn(),
}));

vi.mock('@/features/register', () => ({
    default: () => ({
        state: {
            accountMe: null,
        },
        actions: {
            registerAccountAndNurse: mocks.registerAccountAndNurse,
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
        mocks.registerAccountAndNurse.mockReset();
        mocks.registerAccountAndNurse.mockResolvedValue(undefined);
        mocks.setPhotoImage.mockReset();
        mocks.setRandomImage.mockReset();
    });

    it('submits server-required hidden nurse defaults while keeping gender and employment date out of the UI', async () => {
        const user = userEvent.setup();
        const today = new Date().toISOString().slice(0, 10);

        render(<RegisterNurse />);

        await user.type(screen.getByPlaceholderText('이름을 입력하세요'), '홍길동');
        await user.type(screen.getByPlaceholderText('전화번호를 입력하세요'), '01012341234');
        await user.click(screen.getByRole('button', {name: '다음'}));

        await waitFor(() => {
            expect(mocks.registerAccountAndNurse).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: '홍길동',
                    phoneNum: '01012341234',
                    gender: '여',
                    employmentDate: today,
                    isWorker: true,
                    profileImg: {defaultProfileImgId: 1},
                }),
            );
        });

        expect(screen.queryByText('성별')).not.toBeInTheDocument();
        expect(screen.queryByText('입사일')).not.toBeInTheDocument();
    });
});
