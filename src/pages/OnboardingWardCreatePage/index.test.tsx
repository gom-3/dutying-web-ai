import {screen, waitFor, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, userEvent} from '@/shared/util/test-utils';
import OnboardingWardCreatePage from './index';

const toastSuccess = vi.fn();
const mockCreateWard = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-hot-toast', () => ({
    default: {
        success: (...args: unknown[]) => toastSuccess(...args),
    },
}));

vi.mock('react-router', async () => {
    const actual = await vi.importActual('react-router');

    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

vi.mock('@/features/auth/useRegister', () => ({
    default: () => ({
        actions: {
            createWard: mockCreateWard,
        },
    }),
}));

const prepareValidFinalStep = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', {name: '건너뛰기'}));
    await user.click(screen.getByRole('button', {name: '다음'}));

    await user.click(screen.getByRole('button', {name: /간호사 2팀/}));
    await user.click(screen.getAllByRole('button', {name: '간호사 추가하기'})[0]);
    await user.click(screen.getByRole('button', {name: /간호사 3팀/}));
    await user.click(screen.getAllByRole('button', {name: '간호사 추가하기'})[0]);
    await user.click(screen.getByRole('button', {name: /간호사 1팀/}));
    await user.click(screen.getByRole('button', {name: '다음'}));
};

describe('OnboardingWardCreatePage', () => {
    beforeEach(() => {
        mockCreateWard.mockReset();
        mockNavigate.mockReset();
        toastSuccess.mockReset();
    });

    it('uploads a mock file and moves through onboarding steps', async () => {
        const user = userEvent.setup();
        const {container} = render(<OnboardingWardCreatePage />);
        const uploadInput = container.querySelector('input[type="file"]') as HTMLInputElement;

        await user.upload(uploadInput, new File(['mock'], 'march-duty.xlsx', {type: 'application/vnd.ms-excel'}));

        expect(screen.getByText('업로드됨: march-duty.xlsx')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '다음'}));

        expect(screen.getByText('근무 유형')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '다음'}));

        expect(screen.getAllByText('간호사 추가하기')[0]).toBeInTheDocument();
    });

    it('disables next in step 2 when a shift type is invalid', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await user.click(screen.getByRole('button', {name: '다음'}));
        await user.click(screen.getByRole('button', {name: '근무 추가하기'}));

        expect(screen.getByRole('button', {name: '다음'})).toBeDisabled();
    });

    it('disables next in step 3 when any team has no nurses', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await user.click(screen.getByRole('button', {name: '다음'}));
        await user.click(screen.getByRole('button', {name: '다음'}));
        await user.click(screen.getByRole('button', {name: /팀 추가하기/}));

        expect(screen.getByRole('button', {name: '다음'})).toBeDisabled();
    });

    it('disables next in step 3 when a nurse name is empty', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await user.click(screen.getByRole('button', {name: '다음'}));
        await user.click(screen.getByRole('button', {name: '다음'}));

        const nurseInputs = screen.getAllByDisplayValue(/홍길동|김하늘|박연우|이서윤/);

        await user.clear(nurseInputs[0] as HTMLInputElement);

        expect(screen.getByRole('button', {name: '다음'})).toBeDisabled();
    });

    it('allows skip to bypass validation and move to the next step', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await user.click(screen.getByRole('button', {name: '다음'}));
        await user.click(screen.getByRole('button', {name: '근무 추가하기'}));

        expect(screen.getByRole('button', {name: '다음'})).toBeDisabled();

        await user.click(screen.getByRole('button', {name: '건너뛰기'}));

        expect(screen.getAllByText('간호사 추가하기')[0]).toBeInTheDocument();
    });

    it('disables completion when step 2 remains invalid after skipping ahead', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await user.click(screen.getByRole('button', {name: '다음'}));
        await user.click(screen.getByRole('button', {name: '근무 추가하기'}));
        await user.click(screen.getByRole('button', {name: '건너뛰기'}));

        await user.click(screen.getByRole('button', {name: /간호사 2팀/}));
        await user.click(screen.getAllByRole('button', {name: '간호사 추가하기'})[0]);
        await user.click(screen.getByRole('button', {name: /간호사 3팀/}));
        await user.click(screen.getAllByRole('button', {name: '간호사 추가하기'})[0]);

        await user.click(screen.getByRole('button', {name: '다음'}));

        expect(screen.getByRole('button', {name: '완료'})).toBeDisabled();
    });

    it('shows submitting and success UI when ward creation succeeds', async () => {
        const user = userEvent.setup();

        let resolveCreateWard!: () => void;

        mockCreateWard.mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    resolveCreateWard = resolve;
                }),
        );

        render(<OnboardingWardCreatePage />);

        await prepareValidFinalStep(user);
        await user.click(screen.getByRole('button', {name: '숙련도 설정'}));
        await user.selectOptions(screen.getByDisplayValue('5단계'), '3');
        await user.click(within(screen.getByRole('dialog')).getByRole('button', {name: '완료'}));

        expect(screen.getAllByText((content) => content.includes('LV. 3')).length).toBeGreaterThan(0);

        await user.click(screen.getByRole('button', {name: '완료'}));

        expect(screen.getByTestId('ward-create-submitting')).toBeInTheDocument();
        expect(mockCreateWard).toHaveBeenCalledWith(
            expect.objectContaining({
                name: '듀팅 병동',
                hospitalName: '듀팅 병원',
                shiftTeams: expect.any(Array),
                wardShiftTypes: expect.any(Array),
            }),
            {navigateOnLinked: false},
        );

        resolveCreateWard();

        await waitFor(() => {
            expect(screen.getByTestId('ward-create-success')).toBeInTheDocument();
        });

        expect(screen.getByRole('button', {name: '근무표 만들러 가기'})).toBeInTheDocument();
        expect(toastSuccess).toHaveBeenCalledWith('병동 생성을 완료했어요.');

        await user.click(screen.getByRole('button', {name: '근무표 만들러 가기'}));

        expect(mockNavigate).toHaveBeenCalledWith('/make');
    });

    it('shows retryable error UI when ward creation fails', async () => {
        const user = userEvent.setup();

        mockCreateWard.mockRejectedValueOnce(new Error('서버 오류입니다.'));
        mockCreateWard.mockResolvedValueOnce(undefined);

        render(<OnboardingWardCreatePage />);

        await prepareValidFinalStep(user);
        await user.click(screen.getByRole('button', {name: '완료'}));

        await waitFor(() => {
            expect(screen.getByTestId('ward-create-error')).toBeInTheDocument();
        });

        expect(screen.getByText('서버 오류입니다.')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '다시 시도'}));

        await waitFor(() => {
            expect(screen.getByTestId('ward-create-success')).toBeInTheDocument();
        });

        expect(mockCreateWard).toHaveBeenCalledTimes(2);
    });
});
