import i18n from 'i18next';
import {MemoryRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import '@/i18n';
import {useEditAccount} from '@/features/account/model';
import useAuth from '@/features/auth';
import useProfileImage from '@/features/file';
import ROUTE from '@/shared/constant/path';
import {fireEvent, render, screen, userEvent, waitFor, within} from '@/shared/util/test-utils';
import ProfilePage from '..';

vi.mock('@/features/auth', () => ({
    default: vi.fn(),
}));

vi.mock('@/features/account/model', () => ({
    useEditAccount: vi.fn(),
}));

vi.mock('@/features/file', () => ({
    default: vi.fn(),
}));

vi.mock('@/entities/account/ui/profile-image', () => ({
    ProfileImage: ({name}: {name: string}) => <div aria-label={`${name} 프로필 이미지`} />,
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseEditAccount = vi.mocked(useEditAccount);
const mockedUseProfileImage = vi.mocked(useProfileImage);
const mockHandleLogout = vi.fn();
const mockDeleteAccount = vi.fn();
const mockHandleEditAccountBasic = vi.fn();
const mockUpdateBirthDate = vi.fn();
const mockUpdateAccountPreferences = vi.fn();

describe('ProfilePage account actions', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('ko');
        mockHandleLogout.mockReset();
        mockDeleteAccount.mockReset();
        mockHandleEditAccountBasic.mockReset();
        mockUpdateBirthDate.mockReset();
        mockUpdateAccountPreferences.mockReset();
        mockHandleEditAccountBasic.mockResolvedValue(true);
        mockUpdateBirthDate.mockResolvedValue(true);
        mockUpdateAccountPreferences.mockResolvedValue(true);
        mockedUseAuth.mockReturnValue({
            state: {
                accountMe: {
                    accountId: 7,
                    wardId: null,
                    nurseId: null,
                    email: 'user@example.com',
                    name: '홍길동',
                    phoneNum: '01012345678',
                    profileImgUrl: '',
                    birthDate: null,
                    status: 'WARD_SELECT_PENDING',
                    preferredLanguage: 'ko',
                    serviceRegion: 'KR',
                },
                accountMeStatus: 'success',
                _loaded: true,
            },
            actions: {
                handleGetAccountMe: vi.fn(),
                handleLogout: mockHandleLogout,
            },
        } as never);
        mockedUseEditAccount.mockReturnValue({
            quitWard: vi.fn(),
            handleEditProfile: vi.fn(),
            handleEditAccountBasic: mockHandleEditAccountBasic,
            updateBirthDate: mockUpdateBirthDate,
            updateAccountPreferences: mockUpdateAccountPreferences,
            deleteAccount: mockDeleteAccount,
        });
        mockedUseProfileImage.mockReturnValue({
            profileImg: undefined,
            isLoading: false,
            setRandomImage: vi.fn(),
            setPhotoImage: vi.fn(),
            resetProfileImage: vi.fn(),
        });
    });

    it('fills the phone input from accountMe when no nurse profile is loaded', () => {
        const {container} = render(
            <MemoryRouter>
                <ProfilePage />
            </MemoryRouter>,
        );

        expect(container.querySelector('#phoneNum')).toHaveValue('01012345678');
        expect(container.querySelector('#phoneNum')).toBeEnabled();
    });

    it('updates the account phone number when no nurse profile is loaded', async () => {
        render(
            <MemoryRouter>
                <ProfilePage />
            </MemoryRouter>,
        );

        const phoneInput = screen.getByLabelText('전화번호');

        await userEvent.clear(phoneInput);
        await userEvent.type(phoneInput, '01098765432');
        await userEvent.click(screen.getByRole('button', {name: '변경사항 저장'}));

        await waitFor(() => {
            expect(mockHandleEditAccountBasic).toHaveBeenCalledWith('홍길동', {}, '01098765432');
        });
    });

    it('updates birthDate through the dedicated account endpoint', async () => {
        render(
            <MemoryRouter>
                <ProfilePage />
            </MemoryRouter>,
        );

        const birthDateInput = screen.getByLabelText('생년월일');

        expect(birthDateInput).toHaveAttribute('type', 'text');
        expect(birthDateInput).toHaveAttribute('inputmode', 'numeric');

        fireEvent.change(birthDateInput, {target: {value: '19960314'}});

        expect(birthDateInput).toHaveValue('1996-03-14');

        await userEvent.click(screen.getByRole('button', {name: '변경사항 저장'}));

        await waitFor(() => {
            expect(mockUpdateBirthDate).toHaveBeenCalledWith('1996-03-14');
        });
        expect(mockHandleEditAccountBasic).not.toHaveBeenCalled();
    });

    it('accepts an international phone number for a Japanese profile', async () => {
        mockedUseAuth.mockReturnValue({
            state: {
                accountMe: {
                    accountId: 7,
                    wardId: null,
                    nurseId: null,
                    email: 'user@example.com',
                    name: 'Yamada',
                    phoneNum: '',
                    profileImgUrl: '',
                    birthDate: null,
                    status: 'WARD_SELECT_PENDING',
                    preferredLanguage: 'ja',
                    serviceRegion: 'JP',
                },
                accountMeStatus: 'success',
                _loaded: true,
            },
            actions: {
                handleGetAccountMe: vi.fn(),
                handleLogout: mockHandleLogout,
            },
        } as never);

        const {container} = render(
            <MemoryRouter>
                <ProfilePage />
            </MemoryRouter>,
        );
        const phoneInput = container.querySelector('#phoneNum') as HTMLInputElement;

        await userEvent.clear(phoneInput);
        await userEvent.type(phoneInput, '+81 90-1234-5678');

        const buttons = screen.getAllByRole('button');

        await userEvent.click(buttons[buttons.length - 1]);

        await waitFor(() => {
            expect(mockHandleEditAccountBasic).toHaveBeenCalledWith('Yamada', {}, '+81 90-1234-5678');
        });
    });

    it('saves preferred language with the main save button', async () => {
        render(
            <MemoryRouter>
                <ProfilePage />
            </MemoryRouter>,
        );

        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {expanded: false}));
        await userEvent.click(screen.getAllByRole('option')[1]);
        expect(screen.queryByRole('button', {name: '언어 설정 저장'})).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: '변경사항 저장'}));

        await waitFor(() => {
            expect(mockUpdateAccountPreferences).toHaveBeenCalledWith({
                preferredLanguage: 'ja',
                serviceRegion: 'JP',
            });
        });
        expect(mockHandleEditAccountBasic).not.toHaveBeenCalled();
    });

    it('로그아웃 버튼을 누르면 확인 팝업을 먼저 띄운다', async () => {
        render(
            <MemoryRouter>
                <ProfilePage />
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByRole('button', {name: '로그아웃'}));

        const dialog = screen.getByRole('dialog', {name: '로그아웃할까요?'});

        expect(dialog).toBeInTheDocument();
        expect(within(dialog).getByText('현재 계정에서 로그아웃하고 첫 화면으로 이동해요.')).toBeInTheDocument();
        expect(mockHandleLogout).not.toHaveBeenCalled();

        await userEvent.click(within(dialog).getByRole('button', {name: '로그아웃'}));

        await waitFor(() => {
            expect(mockHandleLogout).toHaveBeenCalledWith(ROUTE.ROOT);
        });
    });

    it('회원 탈퇴 버튼을 누르면 확인 팝업에서 확정한 뒤 탈퇴한다', async () => {
        render(
            <MemoryRouter>
                <ProfilePage />
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByRole('button', {name: '회원 탈퇴'}));

        const dialog = screen.getByRole('dialog', {name: '회원 탈퇴할까요?'});

        expect(dialog).toBeInTheDocument();
        expect(within(dialog).getByText('탈퇴하면 계정 정보가 삭제되며 되돌릴 수 없어요.')).toBeInTheDocument();
        expect(mockDeleteAccount).not.toHaveBeenCalled();

        await userEvent.click(within(dialog).getByRole('button', {name: '탈퇴하기'}));

        await waitFor(() => {
            expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
        });
    });
});
