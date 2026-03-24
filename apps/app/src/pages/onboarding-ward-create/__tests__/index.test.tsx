import {screen, waitFor, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type * as SharedApiModule from '@/shared/api';
import {render, userEvent} from '@/shared/util/test-utils';
import OnboardingWardCreatePage from '../index';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const mockCreateWard = vi.fn();
const mockNavigate = vi.fn();
const mockParseOnboardingWardExcel = vi.fn();
const typedTranslations = {
    'page.onboardingWardCreate.skillLevelModal.title': '숙련도 단계 설정',
    'page.onboardingWardCreate.skillLevelModal.description': '기준은 자유롭게 정할 수 있어요',
    'page.onboardingWardCreate.skillLevelModal.colorLabel': '색상',
    'page.onboardingWardCreate.skillLevelModal.high': '높음',
    'page.onboardingWardCreate.skillLevelModal.low': '낮음',
    'page.onboardingWardCreate.skillLevelModal.levelLabel': '숙련도',
    'page.onboardingWardCreate.skillLevelModal.categoryLabel': '구분',
    'page.onboardingWardCreate.skillLevelModal.autoAssign': '자동 배정',
    'page.onboardingWardCreate.skillLevelModal.autoAssignTooltip': '등록된 간호사 목록을 단계별로 분배해서 자동으로 1차 배정합니다.',
    'page.onboardingWardCreate.skillLevelModal.cancel': '취소',
    'page.onboardingWardCreate.skillLevelModal.complete': '완료',
} as const;

vi.mock('react-hot-toast', () => ({
    default: {
        success: (...args: unknown[]) => toastSuccess(...args),
        error: (...args: unknown[]) => toastError(...args),
    },
}));

vi.mock('react-router', async () => {
    const actual = await vi.importActual('react-router');

    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

vi.mock('@/features/register', () => ({
    default: () => ({
        actions: {
            createWard: mockCreateWard,
        },
    }),
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string, values?: Record<string, string | number>) => {
            if (key === 'page.onboardingWardCreate.skillLevelModal.levelCountOption') {
                return `${values?.levelCount ?? ''}단계`;
            }

            if (key === 'page.onboardingWardCreate.skillLevelModal.levelDisplay') {
                return `LV. ${values?.level ?? ''}`;
            }

            return typedTranslations[key as keyof typeof typedTranslations] ?? key;
        },
    }),
}));

vi.mock('@/shared/api', async () => {
    const actual = (await vi.importActual('@/shared/api')) as typeof SharedApiModule;

    return {
        ...actual,
        FileAPI: {
            ...actual.FileAPI,
            parseOnboardingWardExcel: (...args: unknown[]) => mockParseOnboardingWardExcel(...args),
        },
    };
});

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
        toastError.mockReset();
        mockParseOnboardingWardExcel.mockReset();
    });

    it('uploads a file, injects parsed data, and moves through onboarding steps', async () => {
        const user = userEvent.setup();
        const {container} = render(<OnboardingWardCreatePage />);
        const uploadInput = container.querySelector('input[type="file"]') as HTMLInputElement;

        mockParseOnboardingWardExcel.mockResolvedValue({
            wardName: '중환자실',
            hospitalName: '듀팅병원',
            shiftTypes: [
                {name: '데이', shortName: 'D'},
                {name: '오프', shortName: 'O', isOff: true},
            ],
            teams: [{name: 'A팀'}],
            nurses: [
                {
                    name: '신규 간호사',
                    teamName: 'A팀',
                    possibleShiftShortNames: ['D'],
                    employmentDate: '2025-01-01',
                },
            ],
        });

        await user.upload(uploadInput, new File(['mock'], 'march-duty.xlsx', {type: 'application/vnd.ms-excel'}));

        await waitFor(() => {
            expect(screen.getByText('업로드됨: march-duty.xlsx')).toBeInTheDocument();
        });

        expect(mockParseOnboardingWardExcel).toHaveBeenCalledTimes(1);
        expect(toastSuccess).toHaveBeenCalledWith('엑셀 데이터를 불러왔어요.');

        await user.click(screen.getByRole('button', {name: '다음'}));

        expect(screen.getByText('근무 유형')).toBeInTheDocument();
        expect(screen.getByDisplayValue('데이')).toBeInTheDocument();
        expect(screen.getByDisplayValue('오프')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '다음'}));

        expect(screen.getAllByText('간호사 추가하기')[0]).toBeInTheDocument();
        expect(screen.getByDisplayValue('신규 간호사')).toBeInTheDocument();
    });

    it('shows upload warnings when the parse api partially succeeds', async () => {
        const user = userEvent.setup();
        const {container} = render(<OnboardingWardCreatePage />);
        const uploadInput = container.querySelector('input[type="file"]') as HTMLInputElement;

        mockParseOnboardingWardExcel.mockResolvedValue({
            nurses: [{name: '신규 간호사', teamName: 'A팀'}],
            warnings: ['2행 데이터를 해석하지 못했어요.'],
        });

        await user.upload(uploadInput, new File(['mock'], 'march-duty.xlsx', {type: 'application/vnd.ms-excel'}));

        await waitFor(() => {
            expect(screen.getByTestId('upload-warning')).toBeInTheDocument();
        });

        expect(screen.getByText('2행 데이터를 해석하지 못했어요.')).toBeInTheDocument();
        expect(toastError).toHaveBeenCalledWith('일부 데이터만 반영했어요. 누락된 항목을 확인해 주세요.');
    });

    it('shows upload error guidance when the parse api fails', async () => {
        const user = userEvent.setup();
        const {container} = render(<OnboardingWardCreatePage />);
        const uploadInput = container.querySelector('input[type="file"]') as HTMLInputElement;

        mockParseOnboardingWardExcel.mockRejectedValue(new Error('업로드한 파일 형식이 올바르지 않습니다.'));

        await user.upload(uploadInput, new File(['mock'], 'march-duty.xlsx', {type: 'application/vnd.ms-excel'}));

        await waitFor(() => {
            expect(screen.getByTestId('upload-error')).toBeInTheDocument();
        });

        expect(screen.getByText('업로드한 파일 형식이 올바르지 않습니다.')).toBeInTheDocument();
        expect(toastError).toHaveBeenCalledWith('업로드한 파일 형식이 올바르지 않습니다.');
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
    }, 10_000);

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
