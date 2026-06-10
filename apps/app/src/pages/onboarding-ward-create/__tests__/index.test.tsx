import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type * as SharedApiModule from '@/shared/api';
import {render, userEvent} from '@/shared/util/test-utils';
import OnboardingWardCreatePage from '../index';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const mockCreateWard = vi.fn();
const mockCreateOnboardingWardDraft = vi.fn();
const mockGetOnboardingWardDraft = vi.fn();
const mockSaveOnboardingWardDraft = vi.fn();
const mockPreviewOnboardingScheduleInput = vi.fn();
const mockCompleteOnboardingWardDraft = vi.fn();
const mockNavigate = vi.fn();
const mockParseOnboardingWardExcel = vi.fn();

let latestSavedDraftPayload: unknown = null;

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
const createScheduleTemplateFile = async () => {
    const Excel = await import('exceljs');
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('schedule');

    worksheet.addRow(['간호사', '팀명', '1', '2', '3']);
    worksheet.addRow(['홍길동', 'A팀', 'D', 'E', 'N']);
    worksheet.addRow(['김철수', 'B팀', 'O', 'D', 'E']);

    const buffer = await workbook.xlsx.writeBuffer();

    return new File([buffer as BlobPart], 'schedule-template.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
};
const typedTranslations = {
    'page.onboardingWardCreate.skillLevelModal.title': '숙련도 단계 설정',
    'page.onboardingWardCreate.skillLevelModal.description': '숙련도 기준, 단계, 용어, 색상은 자유롭게 맞춤 설정할 수 있어요',
    'page.onboardingWardCreate.skillLevelModal.colorLabel': '색상',
    'page.onboardingWardCreate.skillLevelModal.high': '높음',
    'page.onboardingWardCreate.skillLevelModal.low': '낮음',
    'page.onboardingWardCreate.skillLevelModal.levelLabel': '숙련도',
    'page.onboardingWardCreate.skillLevelModal.categoryLabel': '구분',
    'page.onboardingWardCreate.skillLevelModal.autoAssign': '자동 배정',
    'page.onboardingWardCreate.skillLevelModal.autoAssignTooltip': '등록된 간호사 목록을 단계별로 분배해서 자동으로 1차 배정해요.',
    'page.onboardingWardCreate.skillLevelModal.cancel': '닫기',
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
        state: {
            accountMe: {
                status: 'WARD_SELECT_PENDING',
            },
        },
    }),
}));

vi.mock('@/shared/hook/use-typed-translation', async () => {
    const {ko} = await vi.importActual<typeof import('@/shared/i18n/resources.generated')>('@/shared/i18n/resources.generated');
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
        },
    };
});

const prepareValidFinalStep = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.clear(screen.getByLabelText('병원명'));
    await user.type(screen.getByLabelText('병원명'), TEST_HOSPITAL_NAME);
    await user.clear(screen.getByLabelText('병동명'));
    await user.type(screen.getByLabelText('병동명'), TEST_WARD_NAME);
    await user.click(screen.getByRole('button', {name: '다음'}));
};
const moveToShiftTypeStep = async (user: ReturnType<typeof userEvent.setup>) => {
    await prepareValidFinalStep(user);
    await user.click(screen.getByRole('button', {name: '건너뛰기'}));
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
        latestSavedDraftPayload = null;
        window.localStorage.clear();
        window.sessionStorage.clear();
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

    it('returns to ward selection from the first step', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await user.click(screen.getByRole('button', {name: '병동 선택으로'}));

        expect(mockNavigate).toHaveBeenCalledWith('/register');
    });

    it('pastes schedule data, syncs nurse names, and moves through onboarding steps', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);
        await prepareValidFinalStep(user);

        expect(
            screen.getByRole('heading', {name: /병동과 근무표 설정을 위해\s+가장 최근에 사용한 근무표를 입력해 주세요/}),
        ).toBeInTheDocument();

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => '신규1\tD\tE\n두번째\tN\tOFF',
            },
        });

        expect(screen.getByDisplayValue('신규1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('D')).toBeInTheDocument();
        expect(screen.getByDisplayValue('두번째')).toBeInTheDocument();
        expect(screen.getByDisplayValue('OFF')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '다음'}));

        expect(screen.getByText('근무명')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '다음'}));

        expect(screen.getAllByText('간호사 추가하기')[0]).toBeInTheDocument();
        expect(screen.getByDisplayValue('신규1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('두번째')).toBeInTheDocument();
    });

    it('keeps schedule data separated by team and saves named rows in the completion payload', async () => {
        const user = userEvent.setup();

        mockCompleteOnboardingWardDraft.mockResolvedValue(undefined);
        render(<OnboardingWardCreatePage />);
        await prepareValidFinalStep(user);

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => '김하늘\tD',
            },
        });
        await user.click(screen.getByRole('button', {name: /간호사 2팀/}));
        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => '박연우\tN',
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
                possibleShiftShortNames: expect.arrayContaining(['D', 'E', 'N', 'O']),
                initialShifts: [
                    {
                        date: `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-01`,
                        shiftShortName: 'D',
                    },
                ],
            }),
        );
    });

    it('keeps row count fixed after direct input and adds rows from the bottom button', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);
        await prepareValidFinalStep(user);

        expect(screen.getByLabelText('10행 간호사 이름')).toBeInTheDocument();
        expect(screen.queryByLabelText('11행 간호사 이름')).not.toBeInTheDocument();

        await user.type(screen.getByLabelText('9행 간호사 이름'), '김하늘');

        expect(screen.queryByLabelText('11행 간호사 이름')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '행 추가'}));

        expect(screen.getByLabelText('11행 간호사 이름')).toBeInTheDocument();
    });

    it('shows delete controls for default empty rows and removes the selected row', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);
        await prepareValidFinalStep(user);

        expect(screen.getByLabelText('10행 간호사 이름')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '10행 삭제'}));

        expect(screen.queryByLabelText('10행 간호사 이름')).not.toBeInTheDocument();
    });

    it('renders the current month schedule with month controls', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);
        await prepareValidFinalStep(user);

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

    it('shows team delete action on the schedule input step and deletes the selected team', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);
        await prepareValidFinalStep(user);

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

        render(<OnboardingWardCreatePage />);
        await prepareValidFinalStep(user);

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
    });

    it('opens the schedule file upload modal and uploads a file for the visible month', async () => {
        const user = userEvent.setup();

        mockParseOnboardingWardExcel.mockResolvedValue({
            nurse_candidates: [],
            constraint_candidates: [],
        });

        render(<OnboardingWardCreatePage />);
        await prepareValidFinalStep(user);

        const currentMonth = getRelativeScheduleMonth(0);

        await user.click(screen.getByRole('button', {name: '근무표 파일 업로드'}));

        const dialog = screen.getByRole('dialog');

        expect(within(dialog).getByText('근무표 파일 업로드')).toBeInTheDocument();
        expect(within(dialog).getByText('엑셀 파일의 이름, 팀, 날짜별 근무를 읽어 초기 병동 설정에 반영해요.')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', {name: /양식 다운로드/})).toBeInTheDocument();

        const file = await createScheduleTemplateFile();

        fireEvent.change(within(dialog).getByTestId('schedule-file-upload-input'), {
            target: {files: [file]},
        });
        await user.click(within(dialog).getByRole('button', {name: '파일 적용'}));

        await waitFor(() => {
            expect(mockParseOnboardingWardExcel).toHaveBeenCalledWith(file, {
                targetYear: currentMonth.year,
                targetMonth: currentMonth.month,
            });
        });
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /A팀/})).toHaveAttribute('aria-pressed', 'true');
        });

        expect(screen.getByRole('button', {name: /B팀/})).toBeInTheDocument();
        expect(screen.getByDisplayValue('홍길동')).toBeInTheDocument();
        expect(screen.getByDisplayValue('D')).toBeInTheDocument();
        expect(screen.getByDisplayValue('E')).toBeInTheDocument();
        expect(screen.getByDisplayValue('N')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: /B팀/}));

        expect(screen.getByDisplayValue('김철수')).toBeInTheDocument();
        expect(screen.getByDisplayValue('O')).toBeInTheDocument();
    });

    it('limits schedule names and shift cells to five characters', async () => {
        render(<OnboardingWardCreatePage />);
        await prepareValidFinalStep(userEvent.setup());

        fireEvent.paste(screen.getByLabelText('1행 간호사 이름'), {
            clipboardData: {
                getData: () => '가나다라마바\tABCDEFG',
            },
        });

        expect(screen.getByDisplayValue('가나다라마')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('가나다라마바')).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('ABCDE')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('ABCDEFG')).not.toBeInTheDocument();
    });

    it('clears the dragged schedule cell range with Backspace', async () => {
        render(<OnboardingWardCreatePage />);
        await prepareValidFinalStep(userEvent.setup());

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
        render(<OnboardingWardCreatePage />);
        await prepareValidFinalStep(userEvent.setup());

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
        render(<OnboardingWardCreatePage />);
        await prepareValidFinalStep(userEvent.setup());

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
        expect(offShift.style.backgroundColor).toBe('rgb(70, 91, 122)');
        expect(offAliasShift.style.backgroundColor).toBe('rgb(70, 91, 122)');
        expect(koreanOffAliasShift.style.backgroundColor).toBe('rgb(70, 91, 122)');
        expect(firstSlashDay.style.backgroundColor).toBe('rgb(85, 90, 100)');
        expect(secondSlashDay.style.backgroundColor).toBe('rgb(85, 90, 100)');
        expect(customTerm.style.backgroundColor).toBe(sameCustomTerm.style.backgroundColor);
        expect(customTerm.style.backgroundColor).not.toBe(dayShift.style.backgroundColor);
    });

    it('keeps existing custom shift colors when a new custom term is added', async () => {
        render(<OnboardingWardCreatePage />);
        await prepareValidFinalStep(userEvent.setup());

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

        render(<OnboardingWardCreatePage />);
        await prepareValidFinalStep(user);

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

    it('disables next in step 3 when shift names are duplicated', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await moveToShiftTypeStep(user);

        const shiftNameInputs = screen.getAllByPlaceholderText('근무명');

        await user.clear(shiftNameInputs[1] as HTMLInputElement);
        await user.type(shiftNameInputs[1] as HTMLInputElement, '데이');

        expect(screen.getAllByText('중복된 근무명은 사용할 수 없어요.')).toHaveLength(2);
        expect(screen.getByRole('button', {name: '다음'})).toHaveAttribute('aria-disabled', 'true');
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

    it('disables next in step 3 when shift time order is invalid', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await moveToShiftTypeStep(user);

        const dayStartTimeInput = screen.getAllByDisplayValue('07:00')[0] as HTMLInputElement;
        const dayEndTimeInput = screen.getAllByDisplayValue('15:00')[0] as HTMLInputElement;

        await user.clear(dayStartTimeInput);
        await user.type(dayStartTimeInput, '1200');
        await user.clear(dayEndTimeInput);
        await user.type(dayEndTimeInput, '1100');

        expect(screen.getByText('퇴근 시간은 출근 시간보다 늦어야 해요.')).toBeInTheDocument();
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

        expect(screen.getAllByPlaceholderText('근무명')).toHaveLength(10);

        await user.click(addShiftButton);

        expect(screen.getAllByPlaceholderText('근무명')).toHaveLength(10);
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
        expect(screen.getByText('프리셉터에게 교육과 적응 지원을 받는 신규 또는 저연차 간호사예요.')).toBeInTheDocument();

        const preceptorCheckbox = screen.getByRole('checkbox', {name: '신규 간호사 1 프리셉터'});
        const precepteeCheckbox = screen.getByRole('checkbox', {name: '신규 간호사 1 프리셉티'});

        expect(preceptorCheckbox).toHaveAttribute('aria-checked', 'false');
        expect(precepteeCheckbox).toHaveAttribute('aria-checked', 'false');

        await user.click(precepteeCheckbox);

        expect(preceptorCheckbox).toHaveAttribute('aria-checked', 'false');
        expect(precepteeCheckbox).toHaveAttribute('aria-checked', 'true');
    });

    it('lets next skip the upload step when no file is uploaded', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await prepareValidFinalStep(user);

        const nextButton = screen.getByRole('button', {name: '다음'});

        expect(nextButton).toHaveAttribute('aria-disabled', 'false');

        await user.click(nextButton);

        expect(screen.getByText('근무명')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '건너뛰기'})).not.toBeInTheDocument();
        expect(toastError).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', {name: '다음'}));

        expect(screen.queryByDisplayValue('홍길동')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '완료'})).toHaveAttribute('aria-disabled', 'true');
    });

    it('shows skip only on upload step and moves to the next step when clicked', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await prepareValidFinalStep(user);

        expect(screen.getByRole('button', {name: '건너뛰기'})).toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '건너뛰기'}));

        expect(screen.getByText('근무명')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '건너뛰기'})).not.toBeInTheDocument();
    });

    it('shows toast and auto navigates to make after ward creation succeeds', async () => {
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
        await user.click(screen.getByRole('button', {name: '숙련도 설정'}));

        const skillLevelDialog = screen.getByRole('dialog');

        await user.click(within(skillLevelDialog).getByRole('button', {name: '숙련도 단계'}));
        await user.click(within(skillLevelDialog).getByRole('option', {name: '3단계'}));
        await user.click(within(screen.getByRole('dialog')).getByRole('button', {name: '완료'}));

        expect(screen.getAllByText((content) => content.trim() === '-').length).toBeGreaterThan(0);

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
                expect(mockNavigate).toHaveBeenCalledWith('/make', {
                    replace: true,
                    state: {onboardingWardCreated: true, onboardingInitialSchedule: null},
                });
            },
            {timeout: 2_000},
        );
    }, 10_000);

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
                expect(mockNavigate).toHaveBeenCalledWith('/make', {
                    replace: true,
                    state: {onboardingWardCreated: true, onboardingInitialSchedule: null},
                });
            },
            {timeout: 2_000},
        );

        expect(mockCompleteOnboardingWardDraft).toHaveBeenCalledTimes(2);
    });
});
