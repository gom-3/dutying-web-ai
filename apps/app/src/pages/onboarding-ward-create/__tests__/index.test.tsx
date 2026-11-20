import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import type {ReactElement} from 'react';
import {MemoryRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type * as SharedApiModule from '@/shared/api';
import type * as I18nResourcesModule from '@/shared/i18n/resources.generated';
import {render as renderWithQueryClient, userEvent} from '@/shared/util/test-utils';
import OnboardingWardCreatePage from '../index';
import {
    createInitialDraft,
    goToStep,
    type TOnboardingRotationMode,
    type TTwoShiftNightRecoveryDisplay,
    updateRotationModeDraft,
    updateTwoShiftNightRecoveryDisplayDraft,
} from '../model/draft';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const mockCreateWard = vi.fn();
const mockCreateOnboardingWardDraft = vi.fn();
const mockGetOnboardingWardDraft = vi.fn();
const mockSaveOnboardingWardDraft = vi.fn();
const mockPreviewOnboardingScheduleInput = vi.fn();
const mockCompleteOnboardingWardDraft = vi.fn();
const mockNavigate = vi.fn();
const mockGetAccountMe = vi.fn().mockResolvedValue(undefined);
const mockParseOnboardingWardExcel = vi.fn();
const mockSearchHospitals = vi.fn();

let latestSavedDraftPayload: unknown = null;

const render = (element: ReactElement) =>
    renderWithQueryClient(<MemoryRouter initialEntries={['/onboarding/ward-create']}>{element}</MemoryRouter>);
const TEST_HOSPITAL_NAME = '테스트 병원';
const TEST_WARD_NAME = '테스트 병동';
const getRelativeScheduleMonth = (offset: number) => {
    const date = new Date();

    date.setDate(1);
    date.setMonth(date.getMonth() + offset);

    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    return {
        year,
        month,
        label: `${year}.${String(month).padStart(2, '0')}`,
        dayCount: new Date(year, month, 0).getDate(),
    };
};
const createScheduleTemplateFile = async (firstNurseName = '홍길동', firstShifts = ['D', 'E', 'N'], secondShifts = ['O', 'D', 'E']) => {
    const Excel = await import('exceljs');
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('schedule');

    worksheet.addRow(['간호사', '팀명', '1', '2', '3']);
    worksheet.addRow([firstNurseName, 'A팀', ...firstShifts]);
    worksheet.addRow(['김철수', 'B팀', ...secondShifts]);

    const buffer = await workbook.xlsx.writeBuffer();

    return new File([buffer as BlobPart], 'schedule-template.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
};
const typedTranslations = {} as const;

vi.mock('react-hot-toast', () => ({
    CheckmarkIcon: () => <span data-testid="toast-checkmark-icon" />,
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
            createOnboardingWardDraft: mockCreateOnboardingWardDraft,
            getOnboardingWardDraft: mockGetOnboardingWardDraft,
            saveOnboardingWardDraft: mockSaveOnboardingWardDraft,
            previewOnboardingScheduleInput: mockPreviewOnboardingScheduleInput,
            completeOnboardingWardDraft: mockCompleteOnboardingWardDraft,
        },
    }),
}));

vi.mock('@/features/auth', () => ({
    default: () => ({
        actions: {handleGetAccountMe: mockGetAccountMe},
        state: {
            accountId: 42,
            accountMe: {
                accountId: 42,
                status: 'WARD_SELECT_PENDING',
                tutorials: {
                    seen: [],
                },
            },
        },
    }),
}));

vi.mock('@/shared/hook/use-typed-translation', async () => {
    const {ko} = await vi.importActual<typeof I18nResourcesModule>('@/shared/i18n/resources.generated');
    const getCatalogValue = (key: string) => {
        const value = key.split('.').reduce<unknown>((current, part) => {
            if (!current || typeof current !== 'object') return undefined;

            return (current as Record<string, unknown>)[part];
        }, ko);

        return typeof value === 'string' ? value : undefined;
    };
    const interpolate = (template: string, values?: Record<string, string | number>) =>
        template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(values?.[token] ?? ''));

    return {
        useTypedTranslation: () => ({
            t: (key: string, values?: Record<string, string | number>) => {
                const template = getCatalogValue(key) ?? typedTranslations[key as keyof typeof typedTranslations] ?? key;

                return interpolate(template, values);
            },
        }),
    };
});

vi.mock('@/shared/api', async () => {
    const actual = (await vi.importActual('@/shared/api')) as typeof SharedApiModule;

    return {
        ...actual,
        FileAPI: {
            ...actual.FileAPI,
            parseOnboardingWardExcel: (...args: unknown[]) => mockParseOnboardingWardExcel(...args),
            recordBrowserExcelImport: vi.fn().mockResolvedValue(undefined),
        },
        HospitalAPI: {
            ...actual.HospitalAPI,
            searchHospitals: (...args: unknown[]) => mockSearchHospitals(...args),
        },
    };
});

const prepareScheduleUploadStep = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.clear(screen.getByLabelText('병원명'));
    await user.type(screen.getByLabelText('병원명'), TEST_HOSPITAL_NAME);
    await user.clear(screen.getByLabelText('병동명'));
    await user.type(screen.getByLabelText('병동명'), TEST_WARD_NAME);
    await user.click(screen.getByRole('button', {name: '다음'}));
    await user.click(screen.getByRole('button', {name: '다음'}));
};
// Editor cases restore a populated upload review instead of bypassing the new entry flow.
// Clearing that restored row also verifies that review remains open after the last value is removed.
const renderScheduleReviewStep = async () => {
    const draft = createInitialDraft();
    const team = draft.teams[0]!;
    const {year, month} = getRelativeScheduleMonth(0);
    const key = `${year}-${String(month).padStart(2, '0')}`;

    latestSavedDraftPayload = {
        flowVersion: 2,
        draftWardId: 10,
        selectedTeamId: team.id,
        sortMode: 'manual',
        draft: {
            ...goToStep(draft, 3),
            hospitalName: TEST_HOSPITAL_NAME,
            wardName: TEST_WARD_NAME,
            uploadedFileName: 'restored-schedule.xlsx',
            nurses: [],
            scheduleInputs: {
                [team.id]: {
                    [key]: {
                        year,
                        month,
                        rows: Array.from({length: 10}, (_, index) => ({
                            id: `restored-row-${index}`,
                            nurseId: null,
                            divisionNum: 1,
                            name: index === 0 ? '기존 근무자' : '',
                            shifts: {},
                        })),
                    },
                },
            },
        },
    };

    const view = render(<OnboardingWardCreatePage />);
    const firstName = await screen.findByLabelText('1행 간호사 이름');

    fireEvent.change(firstName, {target: {value: ''}});
    expect(screen.getByLabelText('1행 간호사 이름')).toHaveValue('');

    return view;
};
const moveToRotationStep = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.clear(screen.getByLabelText('병원명'));
    await user.type(screen.getByLabelText('병원명'), TEST_HOSPITAL_NAME);
    await user.clear(screen.getByLabelText('병동명'));
    await user.type(screen.getByLabelText('병동명'), TEST_WARD_NAME);
    await user.click(screen.getByRole('button', {name: '다음'}));
};
const moveToShiftTypeStep = async (user: ReturnType<typeof userEvent.setup>) => {
    await prepareScheduleUploadStep(user);
    await user.click(screen.getByRole('button', {name: '직접 작성하기'}));
    await user.click(screen.getByRole('button', {name: '다음'}));
};
const choosePreviousScheduleMonth = async (user: ReturnType<typeof userEvent.setup>) => {
    const previousMonth = getRelativeScheduleMonth(-1);

    await user.click(screen.getByRole('button', {name: /근무표 기준 월/}));

    if (previousMonth.year !== new Date().getFullYear()) {
        await user.click(screen.getByRole('button', {name: '이전 연도'}));
    }

    await user.click(screen.getByRole('button', {name: `${previousMonth.month}월`}));

    return previousMonth;
};
const renderShiftTypeStepFromRestoredDraft = async (
    rotationMode: TOnboardingRotationMode,
    options: {twoShiftNightRecoveryDisplay?: TTwoShiftNightRecoveryDisplay} = {},
) => {
    let draft = createInitialDraft();

    draft = {
        ...draft,
        hospitalName: TEST_HOSPITAL_NAME,
        wardName: TEST_WARD_NAME,
    };
    draft = updateRotationModeDraft(draft, rotationMode);

    if (rotationMode === 'TWO' && options.twoShiftNightRecoveryDisplay) {
        draft = updateTwoShiftNightRecoveryDisplayDraft(draft, options.twoShiftNightRecoveryDisplay);
    }

    latestSavedDraftPayload = {
        flowVersion: 2,
        draft: goToStep(draft, 4),
        draftWardId: 10,
        selectedTeamId: draft.teams[0]?.id ?? '',
        sortMode: 'manual',
    };

    render(<OnboardingWardCreatePage />);
    await screen.findByRole('button', {name: '근무 유형 추가하기'});
};
const moveToNurseStep = async (user: ReturnType<typeof userEvent.setup>) => {
    await moveToShiftTypeStep(user);
    await user.click(screen.getByRole('button', {name: '다음'}));
};
const prepareValidCreationState = async (user: ReturnType<typeof userEvent.setup>) => {
    await moveToNurseStep(user);
    await user.click(screen.getAllByRole('button', {name: '간호사 추가하기'})[0]);
};
const buildScheduleInputPreviewResponse = (request: {
    targetYear: number;
    targetMonth: number;
    nurseNameBlock: string;
    dutyBlock: string;
}) => {
    const names = request.nurseNameBlock.split('\n').map((name) => name.trim());
    const dutyRows = request.dutyBlock.split('\n').map((row) => row.split('\t'));
    const observedCodes = new Set<string>();
    const normalizeCode = (code: string) => {
        const normalized = code.trim().toUpperCase();

        if (normalized === '/' || normalized === '-' || normalized === 'OFF') {
            return 'O';
        }

        return normalized;
    };
    const nurses = names.map((name, rowIndex) => ({
        name,
        displayOrder: rowIndex + 1,
        initialShifts: (dutyRows[rowIndex] ?? [])
            .map((code, dayIndex) => {
                const shiftShortName = normalizeCode(code);

                if (!shiftShortName) {
                    return null;
                }

                observedCodes.add(shiftShortName);

                return {
                    date: `${request.targetYear}-${String(request.targetMonth).padStart(2, '0')}-${String(dayIndex + 1).padStart(2, '0')}`,
                    shiftShortName,
                };
            })
            .filter((shift): shift is {date: string; shiftShortName: string} => Boolean(shift)),
    }));
    const baseShiftTypes = [
        {name: '데이', shortName: 'D', color: '#4DC2AD', isOff: false, isDefault: true, classification: 'DAY'},
        {name: '이브닝', shortName: 'E', color: '#FF8BA5', isOff: false, isDefault: true, classification: 'EVENING'},
        {name: '나이트', shortName: 'N', color: '#3580FF', isOff: false, isDefault: true, classification: 'NIGHT'},
        {name: '오프', shortName: 'O', color: '#465B7A', isOff: true, isDefault: true, classification: 'OFF'},
    ];
    const customShiftTypes = Array.from(observedCodes)
        .filter((code) => !['D', 'E', 'N', 'O'].includes(code))
        .map((code) => ({
            name: code,
            shortName: code,
            color: '#94A3B8',
            isOff: false,
            isDefault: false,
            classification: 'OTHER_WORK',
        }));

    return {
        targetYear: request.targetYear,
        targetMonth: request.targetMonth,
        nurses,
        wardShiftTypes: [...baseShiftTypes, ...customShiftTypes],
        warnings: [],
        unresolvedCodes: [],
    };
};

describe('OnboardingWardCreatePage', () => {
    beforeEach(() => {
        mockCreateWard.mockReset();
        mockCreateOnboardingWardDraft.mockReset();
        mockGetOnboardingWardDraft.mockReset();
        mockSaveOnboardingWardDraft.mockReset();
        mockPreviewOnboardingScheduleInput.mockReset();
        mockCompleteOnboardingWardDraft.mockReset();
        mockNavigate.mockReset();
        toastSuccess.mockReset();
        toastError.mockReset();
        mockParseOnboardingWardExcel.mockReset();
        mockSearchHospitals.mockReset().mockResolvedValue([]);
        latestSavedDraftPayload = null;
        window.localStorage.clear();
        window.sessionStorage.clear();
        document.getElementById('tutorial')?.remove();
        mockGetOnboardingWardDraft.mockImplementation(() =>
            Promise.resolve(latestSavedDraftPayload ? {ward: {wardId: 10}, draftPayload: latestSavedDraftPayload} : null),
        );
        mockSaveOnboardingWardDraft.mockImplementation((_wardId, draftDTO) => {
            latestSavedDraftPayload = draftDTO.draftPayload;

            return Promise.resolve({ward: {wardId: 10}, draftPayload: latestSavedDraftPayload});
        });
        mockPreviewOnboardingScheduleInput.mockImplementation(buildScheduleInputPreviewResponse);
        mockCreateOnboardingWardDraft.mockResolvedValue({wardId: 10, setupStatus: 'SETUP_IN_PROGRESS', wardShiftTypes: [], shiftTeams: []});
    });

    it('renders separate hospital and ward name fields on the first step', () => {
        render(<OnboardingWardCreatePage />);

        expect(screen.getByLabelText('병원명')).toBeInTheDocument();
        expect(screen.getByLabelText('병동명')).toBeInTheDocument();
        expect(screen.getByText('(선택) 병동명')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('병원명을 입력해 주세요')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('병동명을 입력해 주세요')).toBeInTheDocument();
    });

    it('shows the rotation choices on their own step and allows every option', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await moveToRotationStep(user);

        expect(screen.getByRole('group', {name: '어떤 교대제를 운영하나요?'})).toBeInTheDocument();
        expect(screen.getByText('교대제', {selector: '.text-highlight-soft'})).toBeInTheDocument();
        expect(screen.queryByText('선택한 교대제에 맞는 근무유형과 자동 배치 제약조건을 준비해요.')).not.toBeInTheDocument();
        expect(screen.queryByText('D · E · N 근무를 사용해요.')).not.toBeInTheDocument();
        expect(screen.queryByText('주간 · 야간 근무를 사용해요.')).not.toBeInTheDocument();
        expect(screen.queryByText('D · E · N을 기본으로 두고 2교대 주간 · 야간도 함께 사용해요.')).not.toBeInTheDocument();

        expect(screen.getAllByRole('button', {name: '이전'})).toHaveLength(1);
        expect(screen.getByRole('button', {name: /3교대만 운영해요/})).toHaveAttribute('aria-pressed', 'true');

        const twoShiftButton = screen.getByRole('button', {name: /2교대만 운영해요/});
        const mixedShiftButton = screen.getByRole('button', {name: /3교대와 2교대를 함께 운영해요/});

        expect(twoShiftButton).toBeEnabled();
        expect(mixedShiftButton).toBeEnabled();
        expect(screen.queryByText('준비 중')).not.toBeInTheDocument();

        await user.click(twoShiftButton);
        expect(screen.getByRole('button', {name: /3교대만 운영해요/})).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', {name: /2교대만 운영해요/})).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', {name: /3교대와 2교대를 함께 운영해요/})).toHaveAttribute('aria-pressed', 'false');

        await user.click(mixedShiftButton);
        expect(screen.getByRole('button', {name: /3교대만 운영해요/})).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', {name: /2교대만 운영해요/})).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', {name: /3교대와 2교대를 함께 운영해요/})).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('group', {name: '야간근무 후 아침에 퇴근한 날을 어떻게 표시하나요?'})).not.toBeInTheDocument();
    });

    it('returns to ward selection from the first step', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await user.click(screen.getByRole('button', {name: '병동 선택으로'}));

        expect(mockNavigate).toHaveBeenCalledWith('/register');
    });

    it('opens the manual grid for the chosen month, pastes shifts, and carries entered names into the nurse step', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);
        await prepareScheduleUploadStep(user);

        const previousMonth = await choosePreviousScheduleMonth(user);

        await user.click(screen.getByRole('button', {name: '직접 작성하기'}));
        expect(screen.getByRole('heading', {name: '이전 근무표를 직접 작성해 주세요'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '근무표 파일 업로드'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '다시 불러오기'})).not.toBeInTheDocument();
        expect(screen.getByText(`${previousMonth.year}년 ${previousMonth.month}월`)).toBeInTheDocument();
        expect(screen.getByLabelText('1행 간호사 이름')).toHaveValue('');

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => 'emily sheparded\tD\tE\nAlexandria Elizabeth Montgomery\tN\tOFF',
            },
        });

        expect(screen.getByDisplayValue('emily sheparded')).toBeInTheDocument();
        expect(screen.getByDisplayValue('D')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Alexandria Elizabeth Montgomery')).toBeInTheDocument();
        expect(screen.getByDisplayValue('O')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '이전'}));
        expect(screen.getByRole('button', {name: /근무표 기준 월/})).toHaveTextContent(`${previousMonth.year}년 ${previousMonth.month}월`);
        await user.click(screen.getByRole('button', {name: '직접 작성하기'}));
        expect(screen.getByLabelText('1행 간호사 이름')).toHaveValue('emily sheparded');

        await user.click(screen.getByRole('button', {name: '다음'}));

        expect(screen.getByText('약자', {selector: '#onboarding-shift-short-name-label'})).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '다음'}));

        expect(screen.getAllByText('간호사 추가하기')[0]).toBeInTheDocument();
        expect(screen.getByDisplayValue('emily sheparded')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Alexandria Elizabeth Montgomery')).toBeInTheDocument();
        expect(mockPreviewOnboardingScheduleInput).toHaveBeenCalledWith(
            expect.objectContaining({nurseNameBlock: 'emily sheparded\nAlexandria Elizabeth Montgomery'}),
        );

        await user.click(screen.getByRole('button', {name: '이전'}));
        await user.click(screen.getByRole('button', {name: '이전'}));

        expect(screen.getByLabelText('1행 간호사 이름')).toHaveValue('emily sheparded');
        expect(screen.getByLabelText('2행 간호사 이름')).toHaveValue('Alexandria Elizabeth Montgomery');
    });

    it('shows the nurse order tutorial once after the first nurse is added', async () => {
        const user = userEvent.setup();
        const tutorialRoot = document.createElement('div');

        tutorialRoot.id = 'tutorial';
        document.body.appendChild(tutorialRoot);

        render(<OnboardingWardCreatePage />);
        await moveToNurseStep(user);

        expect(screen.queryByText('숙련 간호사는 위쪽으로')).not.toBeInTheDocument();

        await user.click(screen.getAllByRole('button', {name: '간호사 추가하기'})[0]);

        await waitFor(() => {
            expect(within(tutorialRoot).getByText('숙련 간호사는 위쪽으로')).toBeInTheDocument();
        });
        expect(document.getElementById('onboarding_nurse_order_sample')).toBeInTheDocument();
        expect(document.getElementById('onboarding_nurse_order_handle')).toBeInTheDocument();

        await user.click(within(tutorialRoot).getByRole('button', {name: '완료'}));

        await waitFor(() => {
            expect(within(tutorialRoot).queryByText('숙련 간호사는 위쪽으로')).not.toBeInTheDocument();
        });
        expect(window.localStorage.getItem('dutying.tutorial.dismissed.onboarding-nurse-order.v1.42')).toBe('1');

        await user.click(screen.getAllByRole('button', {name: '간호사 추가하기'})[0]);

        expect(within(tutorialRoot).queryByText('숙련 간호사는 위쪽으로')).not.toBeInTheDocument();
    });

    it('keeps schedule data separated by team and saves named rows in the completion payload', async () => {
        const user = userEvent.setup();

        mockCompleteOnboardingWardDraft.mockResolvedValue(undefined);
        await renderScheduleReviewStep();

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => '김하늘\tD\tE',
            },
        });
        await user.click(screen.getByRole('button', {name: /간호사 2팀/}));
        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => '박연우\tN\tO',
            },
        });

        expect(screen.getByDisplayValue('박연우')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: /간호사 1팀/}));
        expect(screen.getByDisplayValue('김하늘')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '다음'}));
        await user.click(screen.getByRole('button', {name: '다음'}));
        await user.click(screen.getByRole('button', {name: '완료'}));

        await waitFor(() => {
            expect(mockCompleteOnboardingWardDraft).toHaveBeenCalled();
        });

        const payload = mockCompleteOnboardingWardDraft.mock.calls[0]?.[1];
        const currentMonth = getRelativeScheduleMonth(0);

        expect(payload.shiftTeams).toEqual([
            expect.objectContaining({name: '간호사 1팀', nurseNames: ['김하늘']}),
            expect.objectContaining({name: '간호사 2팀', nurseNames: ['박연우']}),
        ]);
        expect(payload.shiftTeams[0]?.nurses?.[0]).toEqual(
            expect.objectContaining({
                name: '김하늘',
                possibleShiftShortNames: ['D', 'E', 'O', 'A'],
                initialShifts: [
                    {
                        date: `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-01`,
                        shiftShortName: 'D',
                    },
                    {
                        date: `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-02`,
                        shiftShortName: 'E',
                    },
                ],
            }),
        );
        expect(payload.shiftTeams[1]?.nurses?.[0]?.possibleShiftShortNames).toEqual(['N', 'O', 'A']);
    });

    it('keeps row count fixed after direct input and adds rows from the bottom button', async () => {
        const user = userEvent.setup();

        await renderScheduleReviewStep();

        expect(screen.getByLabelText('10행 간호사 이름')).toBeInTheDocument();
        expect(screen.queryByLabelText('11행 간호사 이름')).not.toBeInTheDocument();

        await user.type(screen.getByLabelText('9행 간호사 이름'), '김하늘');

        expect(screen.queryByLabelText('11행 간호사 이름')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '행 추가'}));

        expect(screen.getByLabelText('11행 간호사 이름')).toBeInTheDocument();
    });

    it('shows delete controls for default empty rows and removes the selected row', async () => {
        const user = userEvent.setup();

        await renderScheduleReviewStep();

        expect(screen.getByLabelText('10행 간호사 이름')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '10행 삭제'}));

        expect(screen.queryByLabelText('10행 간호사 이름')).not.toBeInTheDocument();
    });

    it('renders the current month schedule with month controls', async () => {
        const user = userEvent.setup();

        await renderScheduleReviewStep();

        const currentMonth = getRelativeScheduleMonth(0);
        const previousMonth = getRelativeScheduleMonth(-1);

        expect(screen.getByText(`${currentMonth.year}년 ${currentMonth.month}월`)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: String(currentMonth.dayCount)})).toBeInTheDocument();

        if (currentMonth.dayCount < 31) {
            expect(screen.queryByRole('button', {name: String(currentMonth.dayCount + 1)})).not.toBeInTheDocument();
        }

        const nextMonthButton = screen.getByRole('button', {name: '다음 달'});

        expect(nextMonthButton).toBeDisabled();

        await user.click(screen.getByRole('button', {name: '이전 달'}));

        expect(screen.getByText(`${previousMonth.year}년 ${previousMonth.month}월`)).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '다음 달'}));

        expect(screen.getByText(`${currentMonth.year}년 ${currentMonth.month}월`)).toBeInTheDocument();
    });

    it('reopens the saved previous month schedule after returning from shift types and after reload', async () => {
        const user = userEvent.setup();
        const view = await renderScheduleReviewStep();

        await user.click(screen.getByRole('button', {name: '이전 달'}));
        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {getData: () => '김하늘\tD\tE\tN'},
        });
        await user.click(screen.getByRole('button', {name: '다음'}));
        await user.click(screen.getByRole('button', {name: '이전'}));

        const month = getRelativeScheduleMonth(-1);

        expect(screen.getByText(`${month.year}년 ${month.month}월`)).toBeInTheDocument();
        expect(screen.getByLabelText('1행 간호사 이름')).toHaveValue('김하늘');
        expect(screen.getByLabelText('1행 1일 근무')).toHaveValue('D');
        expect(screen.getByLabelText('1행 2일 근무')).toHaveValue('E');

        await waitFor(() => expect((latestSavedDraftPayload as {draft: {currentStep: number}}).draft.currentStep).toBe(3));
        view.unmount();
        render(<OnboardingWardCreatePage />);
        await screen.findByLabelText('1행 간호사 이름');
        expect(screen.getByText(`${month.year}년 ${month.month}월`)).toBeInTheDocument();
        expect(screen.getByLabelText('1행 간호사 이름')).toHaveValue('김하늘');
        expect(screen.getByLabelText('1행 3일 근무')).toHaveValue('N');
    });

    it('shows team delete action on the schedule input step and deletes the selected team', async () => {
        const user = userEvent.setup();

        await renderScheduleReviewStep();

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => '김하늘\tD',
            },
        });

        await waitFor(() => {
            expect(screen.getByDisplayValue('김하늘')).toBeInTheDocument();
        });

        const deleteTeamButton = screen.getByRole('button', {name: '팀 삭제하기'});

        expect(deleteTeamButton.closest('.fixed-shifts-calendar-wrap')).toBeInTheDocument();

        await user.click(deleteTeamButton);

        const confirmDialog = screen.getByRole('dialog');

        expect(within(confirmDialog).getByText('팀을 삭제할까요?')).toBeInTheDocument();
        expect(within(confirmDialog).getByText(/등록된 간호사 1명과 입력한 근무표가 함께 삭제돼요/)).toBeInTheDocument();

        await user.click(within(confirmDialog).getByRole('button', {name: '삭제하기'}));

        expect(screen.queryByRole('button', {name: /간호사 1팀/})).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('김하늘')).not.toBeInTheDocument();
    });

    it('shows an empty team prompt after deleting every team on the schedule input step', async () => {
        const user = userEvent.setup();

        await renderScheduleReviewStep();

        expect(screen.getByLabelText('1행 간호사 이름')).toBeInTheDocument();

        const deleteVisibleTeam = async () => {
            await user.click(screen.getByRole('button', {name: '팀 삭제하기'}));

            const confirmDialog = screen.queryByRole('dialog');

            if (!confirmDialog) {
                return;
            }

            await user.click(within(confirmDialog).getByRole('button', {name: '삭제하기'}));
            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });
        };

        await deleteVisibleTeam();
        await deleteVisibleTeam();
        await deleteVisibleTeam();

        await waitFor(() => {
            expect(screen.queryByLabelText('1행 간호사 이름')).not.toBeInTheDocument();
        });
        expect(screen.queryByRole('button', {name: '팀 삭제하기'})).not.toBeInTheDocument();
        expect(screen.getByText('먼저 팀을 추가해 주세요.')).toBeInTheDocument();
        expect(screen.getByText('팀을 만든 뒤 초기 근무표를 입력할 수 있어요.')).toBeInTheDocument();

        const teamAddButtons = screen.getAllByRole('button', {name: /팀 추가하기/});

        await user.click(teamAddButtons[teamAddButtons.length - 1]!);

        expect(screen.getByRole('button', {name: /간호사 1팀/})).toBeInTheDocument();
        expect(screen.getByLabelText('1행 간호사 이름')).toBeInTheDocument();
    }, 10_000);

    it('replaces the reviewed schedule from the entry screen even when the new workbook has the same filename', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);
        await prepareScheduleUploadStep(user);
        fireEvent.change(screen.getByTestId('schedule-entry-upload-input'), {
            target: {files: [await createScheduleTemplateFile()]},
        });

        const firstName = await screen.findByDisplayValue('홍길동');

        fireEvent.paste(firstName, {clipboardData: {getData: () => '수정한 근무자\tN'}});
        expect(firstName).toHaveValue('수정한 근무자');
        expect(screen.queryByRole('button', {name: '근무표 파일 업로드'})).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '다시 불러오기'}));

        expect(screen.getByRole('button', {name: '사진·엑셀 올리기'})).toBeEnabled();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '건너뛰기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '직접 작성하기'})).not.toBeInTheDocument();
        fireEvent.change(screen.getByTestId('schedule-entry-upload-input'), {
            target: {files: [await createScheduleTemplateFile('새 근무자')]},
        });

        const reloadedName = await screen.findByDisplayValue('새 근무자');

        expect(screen.getByRole('heading', {name: '불러온 근무표를 확인해 주세요'})).toBeInTheDocument();
        fireEvent.keyDown(reloadedName, {key: 'z', ctrlKey: true});
        expect(screen.getByLabelText('1행 간호사 이름')).toHaveValue('새 근무자');
        expect(screen.queryByDisplayValue('수정한 근무자')).not.toBeInTheDocument();
        expect(mockParseOnboardingWardExcel).not.toHaveBeenCalled();
        expect(screen.getByRole('button', {name: /A팀/})).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', {name: /B팀/})).toBeInTheDocument();
        expect(screen.getByDisplayValue('D')).toBeInTheDocument();
        expect(screen.getByDisplayValue('E')).toBeInTheDocument();
        expect(screen.getByDisplayValue('N')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: /B팀/}));

        expect(screen.getByDisplayValue('김철수')).toBeInTheDocument();
        expect(screen.getByDisplayValue('O')).toBeInTheDocument();
    });

    it('restores a manual restriction from an older draft while replacing its blanket defaults for other nurses', async () => {
        const user = userEvent.setup();
        const draft = createInitialDraft();
        const team = draft.teams[0]!;
        const [first, second] = draft.nurses;
        const workIds = draft.shiftTypes.filter((type) => ['D', 'N'].includes(type.shortName)).map((type) => type.id);

        latestSavedDraftPayload = {
            flowVersion: 2,
            draftWardId: 10,
            selectedTeamId: team.id,
            sortMode: 'manual',
            draft: {
                ...goToStep(draft, 4),
                hospitalName: TEST_HOSPITAL_NAME,
                wardName: TEST_WARD_NAME,
                uploadedFileName: 'previous.xlsx',
                onboardingSignals: {...draft.onboardingSignals, possibleShiftsEdited: true},
                nurses: [{...first, possibleShiftTypeIds: workIds}, second],
                scheduleInputs: {
                    [team.id]: {
                        '2026-11': {
                            year: 2026,
                            month: 11,
                            rows: [
                                {id: 'legacy-1', nurseId: null, name: first!.name, shifts: {'1': 'N'}},
                                {id: 'legacy-2', nurseId: null, name: second!.name, shifts: {'1': 'E'}},
                            ],
                        },
                    },
                },
            },
        };
        render(<OnboardingWardCreatePage />);
        await screen.findByRole('button', {name: '근무 유형 추가하기'});
        await user.click(screen.getByRole('button', {name: '다음'}));

        const pressed = (name: string) => {
            const row = screen.getByDisplayValue(name).closest<HTMLElement>('[data-rfd-draggable-id]')!;

            return within(row)
                .getAllByRole('button', {pressed: true})
                .map((button) => button.textContent);
        };

        expect(pressed(first!.name)).toEqual(['D', 'N']);
        expect(pressed(second!.name)).toEqual(['E']);
    });

    it('preselects individual work shifts, keeps edits on return, and refreshes them when the workbook is replaced', async () => {
        const user = userEvent.setup();
        const next = () => user.click(screen.getByRole('button', {name: '다음'}));
        const previous = () => user.click(screen.getByRole('button', {name: '이전'}));
        const upload = async (file: File) => {
            fireEvent.change(screen.getByTestId('schedule-entry-upload-input'), {target: {files: [file]}});
            await screen.findByRole('heading', {name: '불러온 근무표를 확인해 주세요'});
            await next();
            await next();
            await screen.findByRole('button', {name: '완료'});
        };
        const selectedWork = () =>
            screen
                .getAllByRole('button', {pressed: true})
                .map((button) => button.textContent)
                .filter((code) => ['D', 'E', 'N'].includes(code ?? ''));
        const page = render(<OnboardingWardCreatePage />);

        await prepareScheduleUploadStep(user);
        await upload(await createScheduleTemplateFile('홍길동', ['N', 'O', 'N']));
        expect(selectedWork()).toEqual(['N']);
        expect(screen.queryByRole('button', {name: 'O'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'A'})).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: 'D'}));
        await previous();
        await previous();
        await next();
        await next();
        expect(selectedWork()).toEqual(['D', 'N']);

        page.unmount();
        render(<OnboardingWardCreatePage />);
        await screen.findByRole('button', {name: '완료'});
        expect(selectedWork()).toEqual(['D', 'N']);

        await previous();
        await previous();
        await user.click(screen.getByRole('button', {name: '다시 불러오기'}));
        await upload(await createScheduleTemplateFile('홍길동', ['E', 'O', 'E'], ['D', 'N', 'O']));
        expect(selectedWork()).toEqual(['E']);
        await user.click(screen.getByRole('button', {name: 'B팀'}));
        expect(selectedWork()).toEqual(['D', 'N']);
        await user.click(screen.getByRole('button', {name: '완료'}));
        expect(mockCompleteOnboardingWardDraft.mock.calls[0]?.[1]?.shiftTeams[0]?.nurses[0]?.possibleShiftShortNames).toEqual([
            'E',
            'O',
            'A',
        ]);
    });

    it('shows distinct colors for different original photo labels and keeps repeated labels consistent', async () => {
        const user = userEvent.setup();
        const warning = '빗금의 의미를 확인해 주세요.';
        const file = new File(['image'], 'ward.jpg', {type: 'image/jpeg'});

        mockParseOnboardingWardExcel.mockResolvedValueOnce({
            nurses: [
                {
                    name: '근무자',
                    assignments: {'2025-03-01': 'O', '2025-03-02': 'N', '2025-03-03': 'D'},
                    unmapped_assignments: {
                        '2025-03-04': 'Ⓝ',
                        '2025-03-05': 'Ⓓ',
                        '2025-03-06': '/',
                        '2025-03-07': 'q',
                        '2025-03-08': 'Q',
                        '2025-03-09': 'Ⓝ',
                    },
                },
            ],
            quality_report: {warnings: [warning]},
            warnings: [warning],
        });
        await renderScheduleReviewStep();
        await user.click(screen.getByRole('button', {name: '다시 불러오기'}));
        fireEvent.change(screen.getByTestId('schedule-entry-upload-input'), {target: {files: [file]}});

        await screen.findByText('2025년 3월');
        expect(screen.queryByText(warning)).not.toBeInTheDocument();

        const colors = ['O', 'N', 'D', 'Ⓝ', 'Ⓓ', '/', 'q', 'Q', 'Ⓝ'].map((label, index) => {
            const cell = screen.getByLabelText(`1행 ${index + 1}일 근무`) as HTMLInputElement;

            expect(cell).toHaveValue(label);

            return cell.style.backgroundColor;
        });

        expect(new Set(colors.slice(0, 8)).size).toBe(8);
        expect(colors[8]).toBe(colors[3]);
    });

    it('separates recognized photo colors on replacement, reload and entry to shift types', async () => {
        const user = userEvent.setup();

        mockParseOnboardingWardExcel
            .mockResolvedValueOnce({
                shiftTypes: [{shortName: 'N', color: '#3580FF'}],
                nurses: [{name: '근무자', assignments: {'2025-03-01': 'N'}}],
            })
            .mockResolvedValueOnce({
                shiftTypes: [
                    {shortName: 'E', color: '#3580FF'},
                    {shortName: 'N', color: '#3580FF'},
                ],
                nurses: [{name: '근무자', assignments: {'2025-03-01': 'E', '2025-03-02': 'N', '2025-03-03': 'E'}}],
            });

        const view = await renderScheduleReviewStep();
        const uploadPhoto = async (name: string) => {
            await user.click(screen.getByRole('button', {name: '다시 불러오기'}));
            fireEvent.change(screen.getByTestId('schedule-entry-upload-input'), {
                target: {files: [new File(['image'], name, {type: 'image/jpeg'})]},
            });
        };

        await uploadPhoto('first.jpg');
        await waitFor(() => expect(screen.getByLabelText('1행 1일 근무')).toHaveValue('N'));
        await uploadPhoto('replacement.jpg');
        await waitFor(() => expect(screen.getByLabelText('1행 1일 근무')).toHaveValue('E'));

        const getCellColor = (day: number) => (screen.getByLabelText(`1행 ${day}일 근무`) as HTMLInputElement).style.backgroundColor;

        expect(getCellColor(1)).toBe('rgb(255, 139, 165)');
        expect(getCellColor(2)).toBe('rgb(53, 128, 255)');
        expect(getCellColor(3)).toBe(getCellColor(1));

        await waitFor(() =>
            expect((latestSavedDraftPayload as {draft?: {uploadedFileName?: string}})?.draft?.uploadedFileName).toBe('replacement.jpg'),
        );
        view.unmount();

        // Restore a source catalog saved before duplicate-color repair was added.
        const saved = latestSavedDraftPayload as {draft: ReturnType<typeof createInitialDraft>};

        latestSavedDraftPayload = {
            ...saved,
            draft: {
                ...saved.draft,
                scheduleInputState: {
                    ...saved.draft.scheduleInputState!,
                    shiftTypes: saved.draft.scheduleInputState!.shiftTypes.map((type) =>
                        type.shortName === 'E' ? {...type, color: '#3580FF'} : type,
                    ),
                },
            },
        };
        render(<OnboardingWardCreatePage />);
        await screen.findByLabelText('1행 1일 근무');
        expect(getCellColor(1)).toBe('rgb(255, 139, 165)');
        expect(getCellColor(2)).toBe('rgb(53, 128, 255)');
        await user.click(screen.getByRole('button', {name: '다음'}));
        await screen.findAllByRole('textbox', {name: '약자'});

        const getSwatchColor = (code: string) => {
            const input = screen.getAllByRole('textbox', {name: '약자'}).find((element) => (element as HTMLInputElement).value === code)!;

            return input.closest('[data-rfd-draggable-id]')?.querySelector('button span[style]')?.getAttribute('style');
        };

        expect(getSwatchColor('E')).toContain('rgb(255, 139, 165)');
        expect(getSwatchColor('N')).toContain('rgb(53, 128, 255)');
        await user.click(screen.getByRole('button', {name: '이전'}));
        expect(getCellColor(1)).toBe('rgb(255, 139, 165)');
        expect(getCellColor(2)).toBe('rgb(53, 128, 255)');
    });

    it('keeps imported labels and colors independent from shift type edits across back, reload and reentry', async () => {
        const user = userEvent.setup();
        const original = '야간교육지원근무';
        const file = new File(['photo'], 'ward.jpeg', {type: 'image/jpeg'});

        mockParseOnboardingWardExcel.mockResolvedValueOnce({
            nurses: [
                {
                    name: '근무자',
                    assignments: {'2026-12-02': 'O', '2026-12-06': 'N'},
                    unmapped_assignments: {'2026-12-01': original, '2026-12-03': '/', '2026-12-04': original},
                },
            ],
        });

        const view = await renderScheduleReviewStep();

        await user.click(screen.getByRole('button', {name: '다시 불러오기'}));
        fireEvent.change(screen.getByTestId('schedule-entry-upload-input'), {target: {files: [file]}});

        const first = await screen.findByLabelText('1행 1일 근무');

        expect(first).toHaveValue(original);

        const sourceColor = (first as HTMLInputElement).style.backgroundColor;

        await user.click(first);
        await user.tab();
        fireEvent.change(screen.getByLabelText('1행 5일 근무'), {target: {value: 'D'}});
        expect(first).toHaveValue(original);
        expect(screen.getByLabelText('1행 3일 근무')).toHaveValue('/');
        await user.click(screen.getByRole('button', {name: '다음'}));
        await screen.findAllByRole('textbox', {name: '약자'});
        view.unmount();

        const restoredView = render(<OnboardingWardCreatePage />);

        await screen.findAllByRole('textbox', {name: '약자'});

        const abbreviation = screen.getAllByRole('textbox', {name: '약자'}).find((input) => (input as HTMLInputElement).value === original);

        expect(abbreviation).toBeDefined();
        fireEvent.change(abbreviation!, {target: {value: 'Q2'}});
        await user.click(screen.getByRole('button', {name: `${original} 색상 선택`}));

        const palette = screen.getByRole('group', {name: '색상'});
        const differentColor = within(palette)
            .getAllByRole('button')
            .find((button) => button.style.backgroundColor !== sourceColor)!;
        const configuredColor = differentColor.style.backgroundColor;

        await user.click(differentColor);
        await user.click(screen.getByRole('button', {name: '근무 유형 추가하기'}));

        const configuredRowCount = screen.getAllByRole('textbox', {name: '약자'}).length;

        await user.click(screen.getByRole('button', {name: '이전'}));
        await waitFor(() => expect(screen.getByLabelText('1행 1일 근무')).toHaveValue(original));
        expect((screen.getByLabelText('1행 1일 근무') as HTMLInputElement).style.backgroundColor).toBe(sourceColor);
        expect(screen.getByLabelText('1행 2일 근무')).toHaveValue('O');
        expect(screen.getByLabelText('1행 3일 근무')).toHaveValue('/');
        expect(screen.getByLabelText('1행 4일 근무')).toHaveValue(original);
        expect(screen.getByLabelText('1행 5일 근무')).toHaveValue('D');

        await waitFor(() => expect((latestSavedDraftPayload as {draft?: {currentStep?: number}})?.draft?.currentStep).toBe(3));
        restoredView.unmount();
        render(<OnboardingWardCreatePage />);
        await screen.findByLabelText('1행 1일 근무');
        expect(screen.getByLabelText('1행 1일 근무')).toHaveValue(original);
        expect((screen.getByLabelText('1행 1일 근무') as HTMLInputElement).style.backgroundColor).toBe(sourceColor);
        await user.click(screen.getByRole('button', {name: '다음'}));
        expect(await screen.findByDisplayValue('Q2')).toBeInTheDocument();
        expect(screen.getAllByRole('textbox', {name: '약자'})).toHaveLength(configuredRowCount);
        expect(screen.getByRole('button', {name: `${original} 색상 선택`}).querySelector('span')?.style.backgroundColor).toBe(
            configuredColor,
        );
    });

    it('preserves the edited review when a replacement contains no roster rows and clears the error on the next attempt', async () => {
        const user = userEvent.setup();
        const reviewMonth = getRelativeScheduleMonth(0);
        const emptyRoster = new File(['empty roster'], 'empty.xls', {type: 'application/vnd.ms-excel'});

        mockParseOnboardingWardExcel.mockResolvedValueOnce({nurse_candidates: [], constraint_candidates: []});

        await renderScheduleReviewStep();
        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {clipboardData: {getData: () => '기존 근무자\tN'}});
        await user.click(screen.getByRole('button', {name: '다시 불러오기'}));
        await choosePreviousScheduleMonth(user);
        fireEvent.change(screen.getByTestId('schedule-entry-upload-input'), {target: {files: [emptyRoster]}});
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(mockParseOnboardingWardExcel).toHaveBeenCalledWith(emptyRoster, expect.any(Object));

        await user.click(screen.getByRole('button', {name: '이전'}));
        expect(screen.getByRole('heading', {name: '불러온 근무표를 확인해 주세요'})).toBeInTheDocument();
        expect(screen.getByText(`${reviewMonth.year}년 ${reviewMonth.month}월`)).toBeInTheDocument();
        expect(screen.getByLabelText('1행 간호사 이름')).toHaveValue('기존 근무자');
        expect(screen.getByLabelText('1행 1일 근무')).toHaveValue('N');
        await user.click(screen.getByRole('button', {name: '다시 불러오기'}));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: /근무표 기준 월/})).toHaveTextContent(`${reviewMonth.year}년 ${reviewMonth.month}월`);
    });

    it('limits pasted nurse names to fifty characters and shift cells to five characters', async () => {
        await renderScheduleReviewStep();

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => `${'A'.repeat(51)}\tABCDEFG`,
            },
        });

        expect(screen.getByLabelText('1행 간호사 이름')).toHaveValue('A'.repeat(50));
        expect(screen.getByLabelText('1행 간호사 이름')).toHaveAttribute('maxlength', '50');
        expect(screen.getByDisplayValue('ABCDE')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('ABCDEFG')).not.toBeInTheDocument();
    });

    it('does not split a supplementary kanji at the pasted name length limit', async () => {
        await renderScheduleReviewStep();

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {getData: () => `${'A'.repeat(49)}𠮷\tD`},
        });

        expect(screen.getByLabelText('1행 간호사 이름')).toHaveValue('A'.repeat(49));
        expect(screen.getByDisplayValue('D')).toBeInTheDocument();
    });

    it('preserves full English names when typing, filling down, and undoing', async () => {
        const user = userEvent.setup();

        await renderScheduleReviewStep();

        const firstName = screen.getByLabelText('1행 간호사 이름');
        const secondName = screen.getByLabelText('2행 간호사 이름');

        await user.type(firstName, 'emily sheparded');
        expect(firstName).toHaveValue('emily sheparded');

        const fillHandle = firstName.closest('[data-schedule-cell]')?.querySelector('[data-fill-handle]');

        expect(fillHandle).toBeTruthy();
        fireEvent.mouseDown(fillHandle!, {button: 0});
        fireEvent.mouseEnter(secondName.closest('[data-schedule-cell]')!);
        fireEvent.mouseUp(document);

        expect(firstName).toHaveValue('emily sheparded');
        expect(secondName).toHaveValue('emily sheparded');

        fireEvent.keyDown(firstName, {key: 'z', ctrlKey: true});

        expect(firstName).toHaveValue('emily sheparded');
        expect(secondName).toHaveValue('');
    });

    it('clears the dragged schedule cell range with Backspace', async () => {
        await renderScheduleReviewStep();

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => '김하늘\tD\tE\n박연우\tN\tOFF',
            },
        });

        const firstShiftCell = screen.getByLabelText('1행 1일 근무');

        fireEvent.mouseDown(firstShiftCell, {button: 0});
        fireEvent.mouseEnter(screen.getByLabelText('2행 2일 근무'));
        fireEvent.keyDown(firstShiftCell, {key: 'Backspace'});

        expect(screen.getByDisplayValue('김하늘')).toBeInTheDocument();
        expect(screen.getByDisplayValue('박연우')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('D')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('E')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('N')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('OFF')).not.toBeInTheDocument();
    });

    it('undoes schedule input with Ctrl+Z and Meta+Z', async () => {
        await renderScheduleReviewStep();

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => '김하늘\tD',
            },
        });

        expect(screen.getByDisplayValue('김하늘')).toBeInTheDocument();
        expect(screen.getByDisplayValue('D')).toBeInTheDocument();

        fireEvent.keyDown(screen.getByLabelText('1행 1일 근무'), {key: 'z', ctrlKey: true});

        expect(screen.queryByDisplayValue('김하늘')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('D')).not.toBeInTheDocument();

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => '박연우\tE',
            },
        });

        expect(screen.getByDisplayValue('박연우')).toBeInTheDocument();
        expect(screen.getByDisplayValue('E')).toBeInTheDocument();

        fireEvent.keyDown(screen.getByLabelText('1행 1일 근무'), {key: 'z', metaKey: true});

        expect(screen.queryByDisplayValue('박연우')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('E')).not.toBeInTheDocument();
    });

    it('uses fixed D/E/N/O colors, stable custom pastel colors, and fixed dark gray for slash', async () => {
        await renderScheduleReviewStep();

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => '김하늘\tD\tE\t/\t교육\n박연우\tN\tO\t/\t교육\n최서아\tOFF\t휴무',
            },
        });

        const dayShift = screen.getByLabelText('1행 1일 근무') as HTMLInputElement;
        const eveningShift = screen.getByLabelText('1행 2일 근무') as HTMLInputElement;
        const nightShift = screen.getByLabelText('2행 1일 근무') as HTMLInputElement;
        const offShift = screen.getByLabelText('2행 2일 근무') as HTMLInputElement;
        const offAliasShift = screen.getByLabelText('3행 1일 근무') as HTMLInputElement;
        const koreanOffAliasShift = screen.getByLabelText('3행 2일 근무') as HTMLInputElement;
        const firstSlashDay = screen.getByLabelText('1행 3일 근무') as HTMLInputElement;
        const secondSlashDay = screen.getByLabelText('2행 3일 근무') as HTMLInputElement;
        const customTerm = screen.getByLabelText('1행 4일 근무') as HTMLInputElement;
        const sameCustomTerm = screen.getByLabelText('2행 4일 근무') as HTMLInputElement;

        expect(dayShift.style.backgroundColor).toBe('rgb(77, 194, 173)');
        expect(eveningShift.style.backgroundColor).toBe('rgb(255, 139, 165)');
        expect(nightShift.style.backgroundColor).toBe('rgb(53, 128, 255)');
        expect(offShift.style.backgroundColor).toBe('rgb(85, 90, 100)');
        expect(offAliasShift.style.backgroundColor).toBe('rgb(85, 90, 100)');
        expect(koreanOffAliasShift.style.backgroundColor).toBe('rgb(85, 90, 100)');
        expect(firstSlashDay.style.backgroundColor).toBe('rgb(85, 90, 100)');
        expect(secondSlashDay.style.backgroundColor).toBe('rgb(85, 90, 100)');
        expect(customTerm.style.backgroundColor).toBe(sameCustomTerm.style.backgroundColor);
        expect(customTerm.style.backgroundColor).not.toBe(dayShift.style.backgroundColor);
    });

    it('keeps custom schedule cell colors aligned with the shift type step', async () => {
        const user = userEvent.setup();

        await renderScheduleReviewStep();

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => '김하늘\tCCC\tAAA',
            },
        });

        const firstCustomTerm = screen.getByLabelText('1행 1일 근무') as HTMLInputElement;
        const secondCustomTerm = screen.getByLabelText('1행 2일 근무') as HTMLInputElement;
        const scheduleColorByShortName = new Map([
            ['CCC', firstCustomTerm.style.backgroundColor],
            ['AAA', secondCustomTerm.style.backgroundColor],
        ]);
        const getShiftTypeSwatchColor = (shortName: string) => {
            const shiftTypeInput = screen.getAllByDisplayValue(shortName)[0];
            const row = shiftTypeInput?.closest('[data-rfd-draggable-id]');
            const swatch = row?.querySelector('button span[style]') as HTMLElement | null;

            return swatch?.style.backgroundColor;
        };

        await user.click(screen.getByRole('button', {name: '다음'}));

        await waitFor(() => {
            expect(getShiftTypeSwatchColor('CCC')).toBe(scheduleColorByShortName.get('CCC'));
            expect(getShiftTypeSwatchColor('AAA')).toBe(scheduleColorByShortName.get('AAA'));
        });
    });

    it('keeps existing custom shift colors when a new custom term is added', async () => {
        await renderScheduleReviewStep();

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => '김하늘\tCCC\tAAA',
            },
        });

        const firstCustomTerm = screen.getByLabelText('1행 1일 근무') as HTMLInputElement;
        const secondCustomTerm = screen.getByLabelText('1행 2일 근무') as HTMLInputElement;
        const firstColorBefore = firstCustomTerm.style.backgroundColor;
        const secondColorBefore = secondCustomTerm.style.backgroundColor;

        expect(firstColorBefore).not.toBe('rgb(148, 163, 184)');
        expect(secondColorBefore).not.toBe('rgb(148, 163, 184)');
        expect(firstColorBefore).not.toBe(secondColorBefore);

        fireEvent.change(screen.getByLabelText('1행 3일 근무'), {target: {value: 'BBB'}});

        await waitFor(() => {
            expect((screen.getByLabelText('1행 1일 근무') as HTMLInputElement).style.backgroundColor).toBe(firstColorBefore);
            expect((screen.getByLabelText('1행 2일 근무') as HTMLInputElement).style.backgroundColor).toBe(secondColorBefore);
        });
        expect((screen.getByLabelText('1행 3일 근무') as HTMLInputElement).style.backgroundColor).not.toBe(firstColorBefore);
        expect((screen.getByLabelText('1행 3일 근무') as HTMLInputElement).style.backgroundColor).not.toBe(secondColorBefore);
    });

    it('deletes the selected schedule row with the row delete button', async () => {
        const user = userEvent.setup();

        await renderScheduleReviewStep();

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => '김하늘\tD\n박연우\tN',
            },
        });

        await user.click(screen.getByRole('button', {name: '김하늘 삭제'}));

        expect(screen.queryByDisplayValue('김하늘')).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('박연우')).toBeInTheDocument();
    });

    it('blocks next in step 1 when identity name is empty and shows toast on click', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        const nextButton = screen.getByRole('button', {name: '다음'});

        expect(nextButton).toHaveAttribute('aria-disabled', 'true');

        await user.click(nextButton);

        expect(toastError).toHaveBeenCalledWith('병원명을 입력해 주세요.');
    });

    it('disables next in step 3 when a shift type is invalid', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await moveToShiftTypeStep(user);
        await user.click(screen.getByRole('button', {name: '근무 유형 추가하기'}));

        expect(screen.getByRole('button', {name: '다음'})).toHaveAttribute('aria-disabled', 'true');
    });

    it('새 근무 유형은 운영 방식에 허용된 전체 근무 의미를 선택할 수 있다', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await moveToShiftTypeStep(user);
        await user.click(screen.getByRole('button', {name: '근무 유형 추가하기'}));

        await user.click(screen.getByRole('combobox', {name: '근무 근무 의미 선택'}));

        expect(screen.getAllByRole('option')).toHaveLength(7);
        expect(screen.getByRole('option', {name: '기타 근무'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '연차 (유급휴가)'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '기타 휴무'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '주간 근무 (Day)'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '저녁 근무 (Evening)'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '야간 근무 (Night)'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '휴무 (Off)'})).toBeInTheDocument();
    });

    it('3교대만 운영하는 병동은 근무유형의 교대제 칼럼을 숨긴다', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await moveToShiftTypeStep(user);

        expect(screen.queryByText('교대제')).not.toBeInTheDocument();
        expect(screen.queryByRole('combobox', {name: /교대제 선택/})).not.toBeInTheDocument();
    });

    it('2교대만 운영하는 병동은 근무유형의 교대제 칼럼을 숨긴다', async () => {
        const user = userEvent.setup();

        await renderShiftTypeStepFromRestoredDraft('TWO', {twoShiftNightRecoveryDisplay: 'OFF'});

        expect(screen.queryByText('교대제')).not.toBeInTheDocument();
        expect(screen.queryByRole('combobox', {name: /교대제 선택/})).not.toBeInTheDocument();

        expect(screen.getByDisplayValue('데이')).toBeInTheDocument();
        expect(screen.getByDisplayValue('나이트')).toBeInTheDocument();
        expect(screen.getByDisplayValue('D')).toBeInTheDocument();
        expect(screen.getByDisplayValue('N')).toBeInTheDocument();
        expect(screen.getByDisplayValue('오프')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('이브닝')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('2교대 주간')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('2교대 야간')).not.toBeInTheDocument();

        await user.click(screen.getByRole('combobox', {name: '데이 근무 의미 선택'}));

        expect(screen.queryByRole('option', {name: '퇴근일 근무'})).not.toBeInTheDocument();

        const requirements = screen.getByRole('region', {name: '2교대 필수 근무유형'});

        expect(requirements).toHaveClass('mb-7');
        expect(within(requirements).getByRole('status')).toHaveClass('sr-only');
        expect(within(requirements).queryByText('모두 준비됐어요')).not.toBeInTheDocument();
        expect(within(requirements).getByText('주간 근무 (Day)')).toBeInTheDocument();
        expect(within(requirements).getByText('야간 근무 (Night)')).toBeInTheDocument();
        expect(within(requirements).getByText('휴무 (Off)')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /필수 근무유형/})).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog', {name: '2교대 필수 근무유형'})).not.toBeInTheDocument();
    });

    it('별도 근무유형을 선택하면 퇴근일 근무를 2교대 필수 근무유형으로 유지한다', async () => {
        const user = userEvent.setup();

        await renderShiftTypeStepFromRestoredDraft('TWO', {twoShiftNightRecoveryDisplay: 'NIGHT_CONTINUATION'});

        expect(screen.getByDisplayValue('퇴근일 근무')).toBeInTheDocument();

        const requirements = screen.getByRole('region', {name: '2교대 필수 근무유형'});

        expect(within(requirements).getByText('퇴근일 근무')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '퇴근일 근무 삭제'}));

        expect(screen.queryByDisplayValue('퇴근일 근무')).not.toBeInTheDocument();
        expect(within(requirements).getByText('퇴근일 근무')).toBeInTheDocument();

        const nextButton = screen.getByRole('button', {name: '다음'});

        expect(nextButton).toHaveAttribute('aria-disabled', 'true');

        await user.click(nextButton);

        expect(toastError).toHaveBeenCalledWith(expect.stringContaining('퇴근일 근무'));
    });

    it('3교대와 2교대를 함께 운영하는 병동은 근무유형의 교대제 칼럼을 표시한다', async () => {
        await renderShiftTypeStepFromRestoredDraft('MIXED');

        expect(screen.getByText('교대제', {selector: 'span:not([aria-hidden])'})).toBeInTheDocument();
        expect(screen.getByRole('combobox', {name: '데이 교대제 선택'})).toBeInTheDocument();
        expect(screen.getByRole('combobox', {name: '2교대 주간 교대제 선택'})).toBeInTheDocument();
        expect(screen.getByDisplayValue('1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('2')).toBeInTheDocument();

        const requirements = screen.getByRole('region', {name: '2·3교대 필수 근무유형'});

        expect(within(requirements).getByRole('heading', {name: '3교대'})).toBeInTheDocument();
        expect(within(requirements).getByRole('heading', {name: '2교대'})).toBeInTheDocument();
        expect(within(requirements).getByRole('heading', {name: '공통'})).toBeInTheDocument();
        expect(within(requirements).getAllByText('주간 근무 (Day)')).toHaveLength(2);
        expect(within(requirements).getByText('휴무 (Off)')).toBeInTheDocument();
    });

    it('필수 근무유형 안내에서 누락과 중복을 실시간으로 구분한다', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);
        await moveToShiftTypeStep(user);

        const requirements = screen.getByRole('region', {name: '3교대 필수 근무유형'});

        expect(within(requirements).getByRole('status')).toHaveClass('sr-only');

        await user.click(screen.getByRole('combobox', {name: '이브닝 근무 의미 선택'}));
        await user.click(screen.getByRole('option', {name: '주간 근무 (Day)'}));

        expect(within(requirements).getByRole('status')).toHaveClass('sr-only');
        expect(within(requirements).queryByText('2개 확인 필요')).not.toBeInTheDocument();
        expect(within(requirements).getByText('2개 설정됨 · 하나만 남겨 주세요')).toBeInTheDocument();
        expect(within(requirements).getByText('추가가 필요해요')).toBeInTheDocument();

        const nextButton = screen.getByRole('button', {name: '다음'});

        expect(nextButton).toHaveAttribute('aria-disabled', 'true');
        await user.click(nextButton);

        expect(toastError).toHaveBeenCalledWith('주간 근무 (Day) 유형이 중복돼요. D · E 중 하나만 이 유형으로 남겨 주세요.');
        expect(screen.getByRole('region', {name: '3교대 필수 근무유형'})).toBeInTheDocument();
    });

    it('이미 사용 중인 근무 의미도 드롭다운에서 숨기지 않는다', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await moveToShiftTypeStep(user);

        const classificationSelects = screen.getAllByRole('combobox', {name: /근무 의미 선택/});

        await user.click(classificationSelects[1]!);

        expect(screen.getByRole('option', {name: '주간 근무 (Day)'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '저녁 근무 (Evening)'})).toBeInTheDocument();
    });

    it('allows editing but blocks deleting a previous-schedule shift type', async () => {
        const user = userEvent.setup();

        await renderScheduleReviewStep();

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => '김하늘\tD\tE\tN\tO',
            },
        });
        await user.click(screen.getByRole('button', {name: '다음'}));

        await waitFor(() => {
            expect(screen.getByDisplayValue('D')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: '데이 삭제'})).toHaveAttribute('aria-disabled', 'true');
        });

        toastError.mockReset();

        const dayShortNameInput = screen.getByDisplayValue('D') as HTMLInputElement;

        expect(dayShortNameInput).not.toHaveAttribute('readonly');

        await user.clear(dayShortNameInput);
        await user.type(dayShortNameInput, 'F');

        expect(screen.getByDisplayValue('F')).toBeInTheDocument();
        expect(toastError).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', {name: '데이 삭제'}));
        expect(toastError).toHaveBeenCalledWith('이전 근무표에서 사용한 근무 유형은 삭제할 수 없어요.');
    });

    it('shows an unresolved type as a selection without an initial error message', async () => {
        const user = userEvent.setup();

        await renderScheduleReviewStep();

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => '김하늘\tX',
            },
        });
        await user.click(screen.getByRole('button', {name: '다음'}));

        const mappingRequired = await screen.findByRole('combobox', {name: 'X 근무 의미 선택'});

        expect(mappingRequired).toHaveTextContent('유형 선택');
        expect(screen.queryByText('근무 유형을 선택해 주세요.')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '다음'})).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not auto-add missing required shift types when next is clicked', async () => {
        const user = userEvent.setup();

        await renderShiftTypeStepFromRestoredDraft('MIXED');

        await user.click(screen.getByRole('combobox', {name: '2교대 주간 근무 의미 선택'}));
        await user.click(screen.getByRole('option', {name: '기타 근무'}));

        expect(screen.getAllByPlaceholderText('-')).toHaveLength(7);

        const nextButton = screen.getByRole('button', {name: '다음'});

        expect(nextButton).toHaveAttribute('aria-disabled', 'true');

        await user.click(nextButton);

        expect(screen.getAllByPlaceholderText('-')).toHaveLength(7);
        expect(toastSuccess).not.toHaveBeenCalled();
        expect(toastError).toHaveBeenCalledWith(expect.stringContaining('다음 유형을 추가해 주세요'));
    });

    it('disables next in step 3 when shift abbreviations are duplicated', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await moveToShiftTypeStep(user);

        const shiftShortNameInputs = screen.getAllByPlaceholderText('-');

        await user.clear(shiftShortNameInputs[1] as HTMLInputElement);
        await user.type(shiftShortNameInputs[1] as HTMLInputElement, 'D');

        expect(screen.getAllByText('약자 첫 글자가 겹쳐요. 첫 글자를 바꿔 주세요.')).toHaveLength(2);
        expect(screen.getByRole('button', {name: '다음'})).toHaveAttribute('aria-disabled', 'true');
    });

    it('shows compact duplicate indicators for circled shifts, with details on hover or click', async () => {
        const user = userEvent.setup();
        const draft = createInitialDraft();
        const day = draft.shiftTypes.find((shift) => shift.classification === 'DAY')!;
        const night = draft.shiftTypes.find((shift) => shift.classification === 'NIGHT')!;

        latestSavedDraftPayload = {
            flowVersion: 2,
            draft: {
                ...goToStep(draft, 4),
                hospitalName: TEST_HOSPITAL_NAME,
                shiftTypes: [
                    ...draft.shiftTypes,
                    {...night, id: 'circled-night', name: 'ⓝ', shortName: 'ⓝ', rotationSystem: 'TWO', startTime: '19:00'},
                    {...day, id: 'circled-day', name: 'ⓓ', shortName: 'ⓓ', rotationSystem: 'TWO', endTime: '19:00'},
                ],
            },
            draftWardId: 10,
            selectedTeamId: draft.teams[0]?.id ?? '',
            sortMode: 'manual',
        };

        render(<OnboardingWardCreatePage />);

        const nightType = await screen.findByRole('combobox', {name: 'ⓝ 근무 의미 선택'});
        const dayType = screen.getByRole('combobox', {name: 'ⓓ 근무 의미 선택'});
        const next = screen.getByRole('button', {name: '다음'});

        expect(nightType).toHaveAttribute('aria-invalid', 'true');
        expect(nightType).toHaveAccessibleDescription(/야간 근무 \(Night\) 유형이 중복돼요\. N · ⓝ/);
        expect(dayType).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getAllByText('2개 설정됨 · 하나만 남겨 주세요')).toHaveLength(2);
        expect(screen.queryByText(/3교대 병동에서 이 2교대 근무/)).not.toBeInTheDocument();
        expect(screen.getByRole('combobox', {name: '데이 근무 의미 선택'})).toHaveAttribute('aria-invalid', 'true');
        expect(next).toHaveAttribute('aria-disabled', 'true');
        await user.click(next);

        expect(toastError).toHaveBeenLastCalledWith('주간 근무 (Day) 유형이 중복돼요. D · ⓓ 중 하나만 이 유형으로 남겨 주세요.');
        expect(screen.getByRole('combobox', {name: '데이 근무 의미 선택'})).toHaveFocus();

        const details = screen.getByRole('button', {name: 'ⓝ 오류 안내'});

        await user.hover(details);
        expect(await screen.findByRole('tooltip')).toHaveTextContent('N · ⓝ 중 하나만 이 유형으로 남겨 주세요.');
        await user.unhover(details);
        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
        await user.click(details);
        expect(await screen.findByRole('tooltip')).toHaveTextContent('N · ⓝ');
        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());

        const touchDown = () => fireEvent(details, Object.assign(new Event('pointerdown', {bubbles: true}), {pointerType: 'touch'}));

        touchDown();
        fireEvent.pointerUp(details, {pointerType: 'touch'});
        fireEvent.focus(details);
        fireEvent.click(details);
        expect(await screen.findByRole('tooltip')).toHaveTextContent('N · ⓝ');
        touchDown();
        fireEvent.pointerUp(details, {pointerType: 'touch'});
        fireEvent.click(details);
        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());

        for (const type of [nightType, dayType]) {
            await user.click(type);
            await user.click(screen.getByRole('option', {name: '기타 근무'}));
        }

        expect(nightType).toHaveAttribute('aria-invalid', 'false');
        expect(nightType).not.toHaveAccessibleDescription();
        expect(screen.queryByRole('button', {name: 'ⓝ 오류 안내'})).not.toBeInTheDocument();
        expect(screen.queryByText('2개 설정됨 · 하나만 남겨 주세요')).not.toBeInTheDocument();
        expect(next).toHaveAttribute('aria-disabled', 'false');
        await user.click(next);
        await screen.findByRole('button', {name: '완료'});
    });

    it.each([
        {field: 'code', value: '한', expected: '‘데이 (한)’: 약자는 영문·숫자·일본어·기호로 시작해 주세요.'},
        {field: 'name', value: '', expected: '‘D’: 근무명을 입력해 주세요.'},
        {field: 'time', value: '', expected: '‘데이 (D)’: 시간을 입력해 주세요.'},
    ])('names the affected shift and focuses its invalid $field', async ({field, value, expected}) => {
        const user = userEvent.setup();

        await renderShiftTypeStepFromRestoredDraft('THREE');

        const input = screen.getAllByDisplayValue(field === 'code' ? 'D' : field === 'name' ? '데이' : '15:00')[0]!;

        fireEvent.change(input, {target: {value}});
        await user.click(screen.getByRole('button', {name: '다음'}));

        expect(toastError).toHaveBeenLastCalledWith(expected);
        // Time validation applies to the pair and focuses its start input.
        expect(field === 'time' ? screen.getAllByDisplayValue('07:00')[0] : input).toHaveFocus();
    });

    it('auto formats numeric shift time input to HH:mm', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await moveToShiftTypeStep(user);

        const dayStartTimeInput = screen.getAllByDisplayValue('07:00')[0] as HTMLInputElement;

        await user.clear(dayStartTimeInput);
        await user.type(dayStartTimeInput, '1200');

        expect(dayStartTimeInput).toHaveValue('12:00');
    });

    it('keeps next enabled in step 3 when shift time crosses midnight', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await moveToShiftTypeStep(user);

        const dayStartTimeInput = screen.getAllByDisplayValue('07:00')[0] as HTMLInputElement;
        const dayEndTimeInput = screen.getAllByDisplayValue('15:00')[0] as HTMLInputElement;

        await user.clear(dayStartTimeInput);
        await user.type(dayStartTimeInput, '1630');
        await user.clear(dayEndTimeInput);
        await user.type(dayEndTimeInput, '0030');

        expect(screen.getByRole('button', {name: '다음'})).toHaveAttribute('aria-disabled', 'false');
    });

    it('disables next in step 3 when shift start and end times are the same', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await moveToShiftTypeStep(user);

        const dayStartTimeInput = screen.getAllByDisplayValue('07:00')[0] as HTMLInputElement;
        const dayEndTimeInput = screen.getAllByDisplayValue('15:00')[0] as HTMLInputElement;

        await user.clear(dayStartTimeInput);
        await user.type(dayStartTimeInput, '1200');
        await user.clear(dayEndTimeInput);
        await user.type(dayEndTimeInput, '1200');

        expect(screen.getByRole('button', {name: '다음'})).toHaveAttribute('aria-disabled', 'true');
    });

    it('prevents adding more than 10 shift types', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await moveToShiftTypeStep(user);

        const addShiftButton = screen.getByRole('button', {name: '근무 유형 추가하기'});

        for (let index = 0; index < 6; index += 1) {
            await user.click(addShiftButton);
        }

        expect(screen.getAllByPlaceholderText('-')).toHaveLength(10);

        await user.click(addShiftButton);

        expect(screen.getAllByPlaceholderText('-')).toHaveLength(10);
    });

    it('removes empty teams before completion instead of blocking submit', async () => {
        const user = userEvent.setup();

        mockCompleteOnboardingWardDraft.mockResolvedValue(undefined);

        render(<OnboardingWardCreatePage />);

        await moveToNurseStep(user);
        await user.click(screen.getAllByRole('button', {name: '간호사 추가하기'})[0]);
        await user.click(screen.getByRole('button', {name: /팀 추가하기/}));

        expect(screen.getByRole('button', {name: '완료'})).toHaveAttribute('aria-disabled', 'false');

        await user.click(screen.getByRole('button', {name: '완료'}));

        await waitFor(() => {
            expect(mockCompleteOnboardingWardDraft).toHaveBeenCalledTimes(1);
        });

        const [, submittedPayload] = mockCompleteOnboardingWardDraft.mock.calls[0] as [number, Record<string, unknown>, unknown?];
        const submittedShiftTeams = submittedPayload.shiftTeams as {nurseNames: string[]}[];

        expect(submittedShiftTeams).toHaveLength(1);
        expect(submittedShiftTeams[0]).toEqual(expect.objectContaining({nurseNames: ['신규 간호사 1']}));
    });

    it('shows team delete confirm modal and deletes team with nurses', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await moveToNurseStep(user);
        await user.click(screen.getAllByRole('button', {name: '간호사 추가하기'})[0]);

        await user.click(screen.getByRole('button', {name: '팀 삭제하기'}));

        const confirmDialog = screen.getByRole('dialog');

        expect(within(confirmDialog).getByText('팀을 삭제할까요?')).toBeInTheDocument();
        expect(within(confirmDialog).getByText(/등록된 간호사 1명이 함께 삭제돼요/)).toBeInTheDocument();

        await user.click(within(confirmDialog).getByRole('button', {name: '삭제하기'}));

        await waitFor(() => {
            expect(toastSuccess).toHaveBeenCalledWith('팀을 삭제했어요. 팀에 속한 간호사도 함께 삭제했어요.');
        });
        expect(screen.queryByRole('button', {name: /간호사 1팀/})).not.toBeInTheDocument();
    });

    it('shows a team-first prompt on the nurse step after deleting every team', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await moveToNurseStep(user);

        for (let index = 0; index < 3; index += 1) {
            await user.click(screen.getByRole('button', {name: '팀 삭제하기'}));
        }

        expect(screen.getByText('먼저 팀을 추가해 주세요.')).toBeInTheDocument();
        expect(screen.getByText('팀을 만든 뒤 간호사를 등록할 수 있어요.')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '간호사 추가하기'})).not.toBeInTheDocument();

        const teamAddButtons = screen.getAllByRole('button', {name: /팀 추가하기/});

        await user.click(teamAddButtons[teamAddButtons.length - 1]!);

        expect(screen.getByRole('button', {name: /간호사 1팀/})).toBeInTheDocument();
    });

    it('disables next in step 4 when a nurse name is empty', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await moveToNurseStep(user);
        await user.click(screen.getAllByRole('button', {name: '간호사 추가하기'})[0]);

        const nurseInputs = screen.getAllByDisplayValue(/신규 간호사 1/);

        await user.clear(nurseInputs[0] as HTMLInputElement);

        expect(screen.getByRole('button', {name: '완료'})).toHaveAttribute('aria-disabled', 'true');
    });

    it('shows preceptee column with help and toggles the preceptee checkbox', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await moveToNurseStep(user);
        await user.click(screen.getAllByRole('button', {name: '간호사 추가하기'})[0]);

        const precepteeHelpButton = screen.getByRole('button', {name: '프리셉티 설명'});

        expect(precepteeHelpButton).toHaveAttribute('aria-expanded', 'false');

        await user.click(precepteeHelpButton);

        expect(precepteeHelpButton).toHaveAttribute('aria-expanded', 'true');
        expect(await screen.findByRole('tooltip')).toHaveTextContent('프리셉터에게 교육과 적응 지원을 받는 신규 또는 저연차 간호사예요.');

        const preceptorCheckbox = screen.getByRole('checkbox', {name: '신규 간호사 1 프리셉터'});
        const precepteeCheckbox = screen.getByRole('checkbox', {name: '신규 간호사 1 프리셉티'});

        expect(preceptorCheckbox).toHaveAttribute('aria-checked', 'false');
        expect(precepteeCheckbox).toHaveAttribute('aria-checked', 'false');

        await user.click(precepteeCheckbox);

        expect(preceptorCheckbox).toHaveAttribute('aria-checked', 'false');
        expect(precepteeCheckbox).toHaveAttribute('aria-checked', 'true');
    });

    it('starts with an upload action and skip option while keeping the empty grid, next and video hidden', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);
        await prepareScheduleUploadStep(user);

        expect(screen.getByRole('heading', {name: '최근 근무표를 올려 주세요'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '사진·엑셀 올리기'})).toBeEnabled();
        expect(screen.getByTestId('schedule-entry-upload-input').getAttribute('accept')?.split(',')).toEqual(
            expect.arrayContaining(['.xlsx', '.xls', '.jpg', '.jpeg', '.png']),
        );
        expect(screen.getByRole('button', {name: '직접 작성하기'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '이전'})).toBeEnabled();
        expect(screen.getByRole('button', {name: '건너뛰기'})).toBeEnabled();
        expect(screen.queryByLabelText('1행 간호사 이름')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '다음'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /설명 영상/})).not.toBeInTheDocument();
    });

    it('lets the user dismiss the skip prompt or choose a file without advancing', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);
        await prepareScheduleUploadStep(user);

        const skip = screen.getByRole('button', {name: '건너뛰기'});
        const selectFile = vi.fn();

        screen.getByTestId('schedule-entry-upload-input').addEventListener('click', selectFile);
        await user.click(skip);

        const dialog = screen.getByRole('dialog', {name: '이전 근무표를 되도록 불러와 주세요'});

        expect(dialog).toHaveAccessibleDescription(/최근 확정된 한 달치 근무표.*엑셀.*선명한 사진/);
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(skip).toHaveFocus());
        expect(selectFile).not.toHaveBeenCalled();

        await user.click(skip);
        await user.click(within(screen.getByRole('dialog')).getByRole('button', {name: '근무표 올리기'}));

        expect(selectFile).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', {name: '최근 근무표를 올려 주세요'})).toBeInTheDocument();
    });

    it('advances to manual setup without a roster only after skipping is confirmed', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);
        await prepareScheduleUploadStep(user);
        await user.click(screen.getByRole('button', {name: '건너뛰기'}));

        expect(screen.queryByText('약자')).not.toBeInTheDocument();
        await user.click(within(screen.getByRole('dialog')).getByRole('button', {name: '그래도 건너뛰기'}));

        expect(await screen.findByText('약자', {selector: '#onboarding-shift-short-name-label'})).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(mockPreviewOnboardingScheduleInput).not.toHaveBeenCalled();
        expect(mockParseOnboardingWardExcel).not.toHaveBeenCalled();
    });

    it('lets a ward with no schedule continue from the empty manual grid to empty manual setup', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);
        await prepareScheduleUploadStep(user);
        await user.click(screen.getByRole('button', {name: '직접 작성하기'}));

        expect(screen.getByLabelText('1행 간호사 이름')).toHaveValue('');
        await user.click(screen.getByRole('button', {name: '다음'}));

        expect(screen.getByText('약자', {selector: '#onboarding-shift-short-name-label'})).toBeInTheDocument();
        expect(screen.queryByTestId('schedule-entry-upload-input')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '건너뛰기'})).not.toBeInTheDocument();
        expect(toastError).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', {name: '다음'}));

        expect(screen.queryByDisplayValue('홍길동')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '완료'})).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getAllByRole('button', {name: '간호사 추가하기'})).toHaveLength(1);
    });

    it('uploads directly from the entry screen and opens the populated review for the chosen month', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);
        await prepareScheduleUploadStep(user);

        const previousMonth = await choosePreviousScheduleMonth(user);

        fireEvent.change(screen.getByTestId('schedule-entry-upload-input'), {
            target: {files: [await createScheduleTemplateFile()]},
        });

        await screen.findByRole('heading', {name: '불러온 근무표를 확인해 주세요'});
        expect(screen.queryByTestId('schedule-entry-upload-input')).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByText(`${previousMonth.year}년 ${previousMonth.month}월`)).toBeInTheDocument();
        expect(screen.getByDisplayValue('홍길동')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /A팀/})).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', {name: /B팀/})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '다음'})).toBeEnabled();
        expect(mockParseOnboardingWardExcel).not.toHaveBeenCalled();
    });

    it('keeps the upload entry available after an unsupported file and allows a successful retry', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);
        await prepareScheduleUploadStep(user);
        fireEvent.change(screen.getByTestId('schedule-entry-upload-input'), {
            target: {files: [new File(['unsupported'], 'schedule.txt', {type: 'text/plain'})]},
        });

        expect(await screen.findByRole('alert')).toHaveTextContent('엑셀(.xlsx, .xls)이나 JPG, PNG 이미지를 올려 주세요.');
        expect(screen.getByRole('button', {name: '사진·엑셀 올리기'})).toBeEnabled();
        expect(screen.queryByLabelText('1행 간호사 이름')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '다음'})).not.toBeInTheDocument();

        fireEvent.change(screen.getByTestId('schedule-entry-upload-input'), {
            target: {files: [await createScheduleTemplateFile()]},
        });

        await screen.findByRole('heading', {name: '불러온 근무표를 확인해 주세요'});
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('홍길동')).toBeInTheDocument();
    });

    it('shows ward creation progress while submission is pending', async () => {
        const user = userEvent.setup();

        let resolveCreateWard!: () => void;

        mockCompleteOnboardingWardDraft.mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    resolveCreateWard = resolve;
                }),
        );

        render(<OnboardingWardCreatePage />);

        await prepareValidCreationState(user);
        await user.click(screen.getByRole('button', {name: '완료'}));

        expect(screen.getByRole('dialog', {name: '병동을 세팅하고 있어요'})).toBeInTheDocument();
        expect(screen.getByText('입력한 병동 정보를 정리하고 있어요.')).toBeInTheDocument();

        const progressValue = Number(screen.getByRole('progressbar', {name: '병동 생성 진행률'}).getAttribute('aria-valuenow'));

        expect(progressValue).toBeGreaterThanOrEqual(12);
        expect(progressValue).toBeLessThanOrEqual(96);

        resolveCreateWard();

        await waitFor(() => {
            expect(screen.getByText('병동 생성이 완료됐어요')).toBeInTheDocument();
        });
    });

    it('shows toast and auto navigates to home after ward creation succeeds', async () => {
        const user = userEvent.setup();

        let resolveCreateWard!: () => void;

        mockCompleteOnboardingWardDraft.mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    resolveCreateWard = resolve;
                }),
        );

        render(<OnboardingWardCreatePage />);

        await prepareValidCreationState(user);

        await user.click(screen.getByRole('button', {name: '완료'}));

        expect(mockCompleteOnboardingWardDraft).toHaveBeenCalledWith(
            10,
            expect.objectContaining({
                name: TEST_WARD_NAME,
                hospitalName: TEST_HOSPITAL_NAME,
                shiftTeams: expect.any(Array),
                wardShiftTypes: expect.any(Array),
            }),
            {navigateOnLinked: false},
        );

        resolveCreateWard();

        await waitFor(() => {
            expect(toastSuccess).toHaveBeenCalledWith('병동 생성을 완료했어요.');
        });

        expect(screen.queryByTestId('ward-create-success')).not.toBeInTheDocument();
        await waitFor(
            () => {
                expect(mockNavigate).toHaveBeenCalledWith('/home', {
                    replace: true,
                    state: {onboardingWardCreated: true, onboardingInitialSchedule: null},
                });
            },
            {timeout: 2_000},
        );
    }, 10_000);

    const internationalNameInputs = [
        '木ノ内',
        'サハコタ',
        '野崎',
        '関根昌代',
        '佐藤蘭',
        '増田',
        'たなか',
        'ヤマダ',
        '　ＡＢ　１２　',
        'ﾔﾏﾀﾞ･ﾀﾛｳ',
        '髙﨑',
        '𠮷田',
        '山田\u{E0100}',
        'カ\u3099ナ',
        'セ\u309a',
        '山田゛',
        'ㇷ\u309a',
        "Jean-Luc O'Neill",
        'D’Arcy',
        'OʼConnor',
        'J. Smith',
        'Jean‑Luc',
        'Ａｎｎｅ－Ｍａｒｉｅ',
        '阿依古丽·买买提',
        'Nguyễn Thị Hương',
        'José García',
        'สมหญิง ใจดี',
        'محمد أحمد',
        'علی‌رضا',
        'श्री‍राम',
        'דָּוִד לוי',
        'Αλέξανδρος',
        'Мария Иванова',
        'ნინო',
        'ሐና',
        'অনুষ্কা',
        'அனுஷ்கா',
        'Անի',
        'សុភា',
        'အောင်',
        'अनुष्का शर्मा',
    ];
    const internationalNameExpectations = [
        '木ノ内',
        'サハコタ',
        '野崎',
        '関根昌代',
        '佐藤蘭',
        '増田',
        'たなか',
        'ヤマダ',
        'ＡＢ １２',
        'ﾔﾏﾀﾞ・ﾀﾛｳ',
        '髙﨑',
        '𠮷田',
        '山田\u{E0100}',
        'ガナ',
        'セ\u309a',
        '山田゛',
        'ㇷ\u309a',
        "Jean-Luc O'Neill",
        'D’Arcy',
        'OʼConnor',
        'J. Smith',
        'Jean‑Luc',
        'Ａｎｎｅ－Ｍａｒｉｅ',
        '阿依古丽·买买提',
        'Nguyễn Thị Hương',
        'José García',
        'สมหญิง ใจดี',
        'محمد أحمد',
        'علی‌رضا',
        'श्री‍राम',
        'דָּוִד לוי',
        'Αλέξανδρος',
        'Мария Иванова',
        'ნინო',
        'ሐና',
        'অনুষ্কা',
        'அனுஷ்கா',
        'Անի',
        'សុភា',
        'အောင်',
        'अनुष्का शर्मा',
    ];
    // Each edit rerenders the roster. Keep all approved names while bounding one
    // integration case so a slower CI worker does not perform 40x40 row renders.
    const internationalNameBatches = Array.from({length: Math.ceil(internationalNameInputs.length / 8)}, (_, index) => ({
        start: index * 8,
        names: internationalNameInputs.slice(index * 8, index * 8 + 8),
        expected: internationalNameExpectations.slice(index * 8, index * 8 + 8),
    }));

    it.each(internationalNameBatches)(
        'edits international name batch $start and submits both name lists from the final step',
        async ({names, expected}) => {
            const user = userEvent.setup();
            const initialDraft = createInitialDraft();
            const team = initialDraft.teams[0]!;

            latestSavedDraftPayload = {
                flowVersion: 2,
                draftWardId: 10,
                selectedTeamId: team.id,
                sortMode: 'manual',
                draft: {
                    ...goToStep(initialDraft, 5),
                    hospitalName: TEST_HOSPITAL_NAME,
                    wardName: TEST_WARD_NAME,
                    teams: [team],
                    nurses: names.map((_, index) => ({...initialDraft.nurses[0]!, id: `unicode-${index}`, teamId: team.id})),
                },
            };

            render(<OnboardingWardCreatePage />);

            const inputs = await screen.findAllByPlaceholderText('이름');

            expect(inputs).toHaveLength(names.length);
            inputs.forEach((input, index) => {
                fireEvent.change(input, {target: {value: names[index]}});
                expect(input).toHaveValue(names[index]);
            });
            expect(screen.getByRole('button', {name: '완료'})).toBeEnabled();
            await user.click(screen.getByRole('button', {name: '완료'}));

            await waitFor(() => expect(mockCompleteOnboardingWardDraft).toHaveBeenCalledTimes(1));

            const payload = mockCompleteOnboardingWardDraft.mock.calls[0]![1];

            expect(payload.shiftTeams[0].nurseNames).toEqual(expected);
            expect(payload.shiftTeams[0].nurses.map((nurse: {name: string}) => nurse.name)).toEqual(expected);
            await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('병동 생성을 완료했어요.'));
            expect(toastError).not.toHaveBeenCalled();
        },
        10_000,
    );

    it('shows toast only and allows retry when ward creation fails', async () => {
        const user = userEvent.setup();

        mockCompleteOnboardingWardDraft.mockRejectedValueOnce(new Error('서버 오류입니다.'));
        mockCompleteOnboardingWardDraft.mockResolvedValueOnce(undefined);

        render(<OnboardingWardCreatePage />);

        await prepareValidCreationState(user);
        await user.click(screen.getByRole('button', {name: '완료'}));

        await waitFor(() => {
            expect(toastError).toHaveBeenCalledWith('병동을 만들지 못했어요. 다시 시도해 주세요.');
        });

        expect(screen.queryByTestId('ward-create-error')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '완료'}));

        await waitFor(
            () => {
                expect(mockNavigate).toHaveBeenCalledWith('/home', {
                    replace: true,
                    state: {onboardingWardCreated: true, onboardingInitialSchedule: null},
                });
            },
            {timeout: 2_000},
        );

        expect(mockCompleteOnboardingWardDraft).toHaveBeenCalledTimes(2);
    });
});
