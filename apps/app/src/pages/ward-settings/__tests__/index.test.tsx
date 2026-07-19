import {waitFor} from '@testing-library/react';
import toast from 'react-hot-toast';
import type * as ReactRouterModule from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type * as I18nModule from '@/i18n';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import WardSettingsPage from '../index';

const mockUseWardSettings = vi.fn();
const mockNavigate = vi.hoisted(() => vi.fn());
const mockAuthState = vi.hoisted(() => ({
    accessToken: null as string | null,
}));

vi.mock('../model/ward-settings-hook', () => ({
    useWardSettings: (...args: unknown[]) => mockUseWardSettings(...args),
}));

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {
            accessToken: mockAuthState.accessToken,
        },
    }),
}));

vi.mock('@/features/auth/model/admin-token', () => ({
    isWardAdminAccessToken: (accessToken?: string | null) => accessToken === 'ward-admin-token',
}));

vi.mock('@/widgets/notifications/notification-bell', () => ({
    NotificationBell: () => (
        <button type="button" aria-label="notification bell">
            bell
        </button>
    ),
}));

vi.mock('react-router', async () => {
    const actual = await vi.importActual<typeof ReactRouterModule>('react-router');

    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('@/shared/hook/use-typed-translation', async () => {
    const {default: i18n} = await vi.importActual<typeof I18nModule>('@/i18n');

    return {
        useTypedTranslation: () => ({
            t: (key: string, values?: Record<string, string | number>) => i18n.t(key, values),
        }),
    };
});

vi.mock('@/features/create-shift-modal', () => ({
    default: ({open, shiftType}: {open: boolean; shiftType: {name: string} | null}) =>
        open ? <div>{shiftType ? `edit-modal:${shiftType.name}` : 'create-modal'}</div> : null,
}));

vi.mock('@/pages/make-shift/ui/steps/constraints', () => ({
    Constraints: ({wardId, shiftTeamId, variant}: {wardId?: number | null; shiftTeamId?: number | null; variant?: string}) => (
        <div data-testid="shift-constraint-rules">{`rules:${wardId ?? 'none'}:${shiftTeamId ?? 'none'}:${variant ?? 'flow'}`}</div>
    ),
}));

type TMockValue = {
    state: {
        wardId: number | null;
        currentTab: 'shiftTypes' | 'restLeavePolicy' | 'requestReception' | 'constraints';
        shiftTypes: Array<{
            wardShiftTypeId: number;
            name: string;
            shortName: string;
            startTime: string | null;
            endTime: string | null;
            color: string;
            isDefault: boolean;
            isOff: boolean;
            isCounted: boolean;
            classification: 'DAY' | 'EVENING' | 'NIGHT' | 'OTHER_WORK' | 'OFF' | 'OTHER_LEAVE';
            isUsed?: boolean;
        }>;
        shiftTypesStatus: 'success' | 'pending' | 'error';
        shiftTeams: Array<{shiftTeamId: number; name: string; nurseCnt: number; nurses: []}>;
        shiftTeamsStatus: 'success' | 'pending' | 'error';
        currentShiftTeamId: number | null;
        requestReceptionSettings: {
            enabled: boolean;
            startDay: number;
            startTime: string;
            endDay: number;
            endTime: string;
            notifyOnOpen: boolean;
            notifyBeforeDeadline: boolean;
            notifyBeforeDeadlineHours: number;
        };
        requestReceptionStatus: 'success' | 'pending' | 'error';
    };
    actions: {
        selectTab: ReturnType<typeof vi.fn>;
        selectShiftTeam: ReturnType<typeof vi.fn>;
        addShiftType: ReturnType<typeof vi.fn>;
        updateShiftType: ReturnType<typeof vi.fn>;
        deleteShiftType: ReturnType<typeof vi.fn>;
        retryShiftTypes: ReturnType<typeof vi.fn>;
        retryShiftTeams: ReturnType<typeof vi.fn>;
        retryRequestReceptionSettings: ReturnType<typeof vi.fn>;
        updateRequestReceptionSettings: ReturnType<typeof vi.fn>;
    };
};

function baseValue() {
    return {
        state: {
            wardId: 1,
            currentTab: 'shiftTypes' as const,
            shiftTypes: [
                {
                    wardShiftTypeId: 1,
                    name: '데이',
                    shortName: 'D',
                    startTime: '07:00',
                    endTime: '15:00',
                    color: '#4dc2ad',
                    isDefault: true,
                    isOff: false,
                    isCounted: true,
                    classification: 'DAY' as const,
                },
            ],
            shiftTypesStatus: 'success' as const,
            shiftTeams: [{shiftTeamId: 1, name: '중환자실 A팀', nurseCnt: 0, nurses: []}],
            shiftTeamsStatus: 'success' as const,
            currentShiftTeamId: 1,
            requestReceptionSettings: {
                enabled: true,
                startDay: 1,
                startTime: '00:00',
                endDay: 15,
                endTime: '23:59',
                notifyOnOpen: true,
                notifyBeforeDeadline: true,
                notifyBeforeDeadlineHours: 24,
            },
            requestReceptionStatus: 'success' as const,
        },
        actions: {
            selectTab: vi.fn(),
            selectShiftTeam: vi.fn(),
            addShiftType: vi.fn(),
            updateShiftType: vi.fn(),
            deleteShiftType: vi.fn(),
            retryShiftTypes: vi.fn(),
            retryShiftTeams: vi.fn(),
            retryRequestReceptionSettings: vi.fn(),
            updateRequestReceptionSettings: vi.fn(),
        },
    };
}

function createValue(overrides?: {state?: Partial<TMockValue['state']>; actions?: Partial<TMockValue['actions']>}) {
    const value = baseValue();

    return {
        state: {
            ...value.state,
            ...overrides?.state,
        },
        actions: {
            ...value.actions,
            ...overrides?.actions,
        },
    };
}

function requiredShiftTypes() {
    const dayShiftType = baseValue().state.shiftTypes[0]!;

    return [
        dayShiftType,
        {
            ...dayShiftType,
            wardShiftTypeId: 2,
            name: '이브닝',
            shortName: 'E',
            startTime: '15:00',
            endTime: '23:00',
            classification: 'EVENING' as const,
        },
        {
            ...dayShiftType,
            wardShiftTypeId: 3,
            name: '나이트',
            shortName: 'N',
            startTime: '23:00',
            endTime: '07:00',
            classification: 'NIGHT' as const,
        },
        {
            ...dayShiftType,
            wardShiftTypeId: 4,
            name: '오프',
            shortName: 'O',
            startTime: null,
            endTime: null,
            isOff: true,
            isCounted: false,
            classification: 'OFF' as const,
        },
    ];
}

describe('WardSettingsPage', () => {
    beforeEach(() => {
        mockUseWardSettings.mockReset();
        mockNavigate.mockClear();
        mockAuthState.accessToken = null;
        vi.mocked(toast.success).mockClear();
        vi.mocked(toast.error).mockClear();
        window.localStorage.removeItem('dutying:ward:1:rest-leave-policy');
    });

    it('anchors the notification bell to the same content frame as the ward settings header', () => {
        mockAuthState.accessToken = 'ward-admin-token';
        mockUseWardSettings.mockReturnValue(createValue());

        render(<WardSettingsPage />);

        const notificationBell = screen.getByRole('button', {name: 'notification bell'});
        const notificationWrapper = notificationBell.parentElement;
        const settingsHeaderFrame = notificationWrapper?.parentElement;

        expect(notificationWrapper).toHaveClass('pointer-events-none', 'absolute', 'top-0', 'right-0', 'z-[1002]');
        expect(settingsHeaderFrame).toHaveClass('relative', 'max-w-[960px]');
    });

    it('근무 유형 탭에서 피그마 컬럼과 행을 보여준다', () => {
        mockUseWardSettings.mockReturnValue(createValue());

        render(<WardSettingsPage />);

        expect(screen.getByText('근무 설정')).toBeInTheDocument();
        expect(screen.getByText('약자')).toBeInTheDocument();
        expect(screen.getByText('근무 시간')).toBeInTheDocument();
        expect(screen.getByDisplayValue('D')).toBeInTheDocument();
        expect(screen.getByText('8h')).toBeInTheDocument();
    });

    it('renders shift types with null times from the API without crashing', () => {
        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    shiftTypes: [
                        {
                            ...baseValue().state.shiftTypes[0],
                            wardShiftTypeId: 2,
                            name: 'Archived',
                            shortName: 'A',
                            startTime: null,
                            endTime: null,
                            isDefault: false,
                            isOff: false,
                            classification: 'OTHER_WORK',
                        },
                    ],
                },
            }),
        );

        render(<WardSettingsPage />);

        expect(screen.getByDisplayValue('A')).toBeInTheDocument();
        expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('renders work shift types before off shift types even when the API returns off first', () => {
        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    shiftTypes: [
                        {
                            ...baseValue().state.shiftTypes[0],
                            wardShiftTypeId: 1,
                            name: 'Off',
                            shortName: 'O',
                            startTime: null,
                            endTime: null,
                            isOff: true,
                            isCounted: false,
                            classification: 'OFF',
                        },
                        {
                            ...baseValue().state.shiftTypes[0],
                            wardShiftTypeId: 2,
                            name: 'Night',
                            shortName: 'N',
                            startTime: '23:00',
                            endTime: '07:00',
                            classification: 'NIGHT',
                        },
                        {
                            ...baseValue().state.shiftTypes[0],
                            wardShiftTypeId: 3,
                            name: 'Day',
                            shortName: 'D',
                            startTime: '07:00',
                            endTime: '15:00',
                            classification: 'DAY',
                        },
                    ],
                },
            }),
        );

        render(<WardSettingsPage />);

        const names = Array.from(document.querySelectorAll<HTMLInputElement>('[data-shift-name-input]')).map((input) => input.value);

        expect(names).toEqual(['Day', 'Night', 'Off']);
    });

    it('allows overnight shift times and preserves payload classifications on save', async () => {
        const user = userEvent.setup();
        const updateShiftType = vi.fn();

        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    shiftTypes: [
                        {
                            ...baseValue().state.shiftTypes[0],
                            wardShiftTypeId: 1,
                            name: 'Day',
                            shortName: 'D',
                            startTime: '07:00',
                            endTime: '15:00',
                            classification: 'DAY',
                        },
                        {
                            ...baseValue().state.shiftTypes[0],
                            wardShiftTypeId: 2,
                            name: 'Late',
                            shortName: 'L',
                            startTime: '16:30',
                            endTime: '00:30',
                            isDefault: false,
                            classification: 'OTHER_WORK',
                        },
                        ...requiredShiftTypes()
                            .slice(1)
                            .map((shiftType, index) => ({...shiftType, wardShiftTypeId: index + 3})),
                    ],
                },
                actions: {
                    updateShiftType,
                },
            }),
        );

        render(<WardSettingsPage />);

        expect(screen.getAllByText('8h')).toHaveLength(4);

        const buttons = screen.getAllByRole('button');

        await user.click(buttons[buttons.length - 1]!);

        await waitFor(() => {
            expect(updateShiftType).toHaveBeenCalledWith(1, expect.objectContaining({classification: 'DAY'}));
            expect(updateShiftType).toHaveBeenCalledWith(
                2,
                expect.objectContaining({
                    startTime: '16:30',
                    endTime: '00:30',
                    classification: 'OTHER_WORK',
                }),
            );
        });
    });

    it('shows a success toast after shift settings are saved', async () => {
        const user = userEvent.setup();
        const updateShiftType = vi.fn().mockResolvedValue(true);

        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    shiftTypes: requiredShiftTypes(),
                },
                actions: {
                    updateShiftType,
                },
            }),
        );

        render(<WardSettingsPage />);

        await user.click(screen.getByRole('button', {name: '저장하기'}));

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith('근무 설정을 저장했어요.');
        });
    });

    it('does not show the success toast when saving a shift setting fails', async () => {
        const user = userEvent.setup();
        const updateShiftType = vi.fn().mockResolvedValue(false);

        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    shiftTypes: requiredShiftTypes(),
                },
                actions: {
                    updateShiftType,
                },
            }),
        );

        render(<WardSettingsPage />);

        await user.click(screen.getByRole('button', {name: '저장하기'}));

        await waitFor(() => {
            expect(updateShiftType).toHaveBeenCalled();
        });
        expect(toast.success).not.toHaveBeenCalled();
    });

    it('제약 조건 탭 버튼 클릭 시 탭 전환 액션을 호출한다', async () => {
        const user = userEvent.setup();
        const selectTab = vi.fn();

        mockUseWardSettings.mockReturnValue(
            createValue({
                actions: {
                    selectTab,
                },
            }),
        );

        render(<WardSettingsPage />);

        await user.click(screen.getByRole('button', {name: '제약 조건'}));

        expect(selectTab).toHaveBeenCalledWith('constraints');
    });

    it('신청근무 접수 탭 버튼 클릭 시 탭 전환 액션을 호출한다', async () => {
        const user = userEvent.setup();
        const selectTab = vi.fn();

        mockUseWardSettings.mockReturnValue(
            createValue({
                actions: {
                    selectTab,
                },
            }),
        );

        render(<WardSettingsPage />);

        await user.click(screen.getByRole('button', {name: /신청근무 접수|근무 신청/}));

        expect(selectTab).toHaveBeenCalledWith('requestReception');
    });

    it('신청근무 접수 설정을 저장한다', async () => {
        const user = userEvent.setup();
        const updateRequestReceptionSettings = vi.fn().mockResolvedValue(true);

        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    currentTab: 'requestReception',
                },
                actions: {
                    updateRequestReceptionSettings,
                },
            }),
        );

        render(<WardSettingsPage />);

        expect(screen.getByText('다음 달 신청근무 접수 기간')).toBeInTheDocument();
        expect(screen.queryByText('시작 시간')).not.toBeInTheDocument();
        expect(screen.queryByText('마감 시간')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '3일'}));
        await user.click(screen.getByRole('button', {name: '10일'}));

        await user.click(screen.getByRole('button', {name: '저장하기'}));

        await waitFor(() => {
            expect(updateRequestReceptionSettings).toHaveBeenCalledWith({
                enabled: true,
                startDay: 3,
                startTime: '00:00',
                endDay: 10,
                endTime: '23:59',
                notifyOnOpen: true,
                notifyBeforeDeadline: true,
                notifyBeforeDeadlineHours: 24,
            });
        });
        expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/신청.*설정을 저장했어요/));
    });

    it('휴무일 계산 탭에서 실제 휴무일로 계산할 근무 유형을 고른다', async () => {
        const user = userEvent.setup();

        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    currentTab: 'restLeavePolicy',
                    shiftTypes: [
                        baseValue().state.shiftTypes[0],
                        {
                            ...baseValue().state.shiftTypes[0],
                            wardShiftTypeId: 2,
                            name: '오프',
                            shortName: 'O',
                            color: '#465B7A',
                            isOff: true,
                            isCounted: false,
                            classification: 'OFF',
                        },
                        {
                            ...baseValue().state.shiftTypes[0],
                            wardShiftTypeId: 3,
                            name: '휴가',
                            shortName: 'A',
                            color: '#7C8AF2',
                            isDefault: false,
                            isOff: true,
                            isCounted: false,
                            classification: 'OTHER_LEAVE',
                        },
                    ],
                },
            }),
        );

        render(<WardSettingsPage />);

        expect(screen.getByText('휴무일로 계산할 근무 유형')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /오프.*휴무일 계산/})).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: /휴가.*휴무일 계산/}));
        await user.click(screen.getByRole('button', {name: '저장하기'}));

        await waitFor(() => {
            expect(JSON.parse(window.localStorage.getItem('dutying:ward:1:rest-leave-policy') ?? '{}')).toMatchObject({
                countedRestShiftTypeIds: [2],
            });
        });
    });

    it('휴무일 계산 탭에서 기본 휴무만 있어도 포함 항목에 표시한다', () => {
        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    currentTab: 'restLeavePolicy',
                    shiftTypes: [
                        baseValue().state.shiftTypes[0],
                        {
                            ...baseValue().state.shiftTypes[0],
                            wardShiftTypeId: 2,
                            name: '휴무',
                            shortName: 'O',
                            color: '#465B7A',
                            isOff: true,
                            isCounted: false,
                            classification: 'OFF',
                        },
                    ],
                },
            }),
        );

        render(<WardSettingsPage />);

        expect(screen.getByText('휴무일로 계산할 근무 유형')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /휴무.*휴무일 계산/})).toBeInTheDocument();
        expect(screen.queryByText('아직 휴무 유형이 없어요.')).not.toBeInTheDocument();
    });

    it('휴무일 계산 탭에서 기능을 끄면 세부 설정을 접고 저장한다', async () => {
        const user = userEvent.setup();

        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    currentTab: 'restLeavePolicy',
                    shiftTypes: [
                        baseValue().state.shiftTypes[0],
                        {
                            ...baseValue().state.shiftTypes[0],
                            wardShiftTypeId: 2,
                            name: '휴가',
                            shortName: 'A',
                            color: '#7C8AF2',
                            isDefault: false,
                            isOff: true,
                            isCounted: false,
                            classification: 'OTHER_LEAVE',
                        },
                    ],
                },
            }),
        );

        render(<WardSettingsPage />);

        expect(screen.getByText('휴무일로 계산할 근무 유형')).toBeInTheDocument();

        const restPolicySwitch = screen.getByRole('switch', {name: '휴무일 계산 사용'});

        expect(restPolicySwitch).toHaveAttribute('aria-checked', 'true');

        await user.click(restPolicySwitch);

        expect(restPolicySwitch).toHaveAttribute('aria-checked', 'false');
        expect(screen.queryByText('휴무일로 계산할 근무 유형')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '저장하기'}));

        await waitFor(() => {
            expect(JSON.parse(window.localStorage.getItem('dutying:ward:1:rest-leave-policy') ?? '{}')).toMatchObject({
                enabled: false,
            });
        });
    });

    it('휴무일 계산 탭에서 변경 후 다른 탭으로 나가려 하면 확인 모달을 띄운다', async () => {
        const user = userEvent.setup();
        const selectTab = vi.fn();

        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    currentTab: 'restLeavePolicy',
                    shiftTypes: [
                        baseValue().state.shiftTypes[0],
                        {
                            ...baseValue().state.shiftTypes[0],
                            wardShiftTypeId: 2,
                            name: '휴가',
                            shortName: 'A',
                            color: '#7C8AF2',
                            isDefault: false,
                            isOff: true,
                            isCounted: false,
                            classification: 'OTHER_LEAVE',
                        },
                    ],
                },
                actions: {
                    selectTab,
                },
            }),
        );

        render(<WardSettingsPage />);

        await user.click(screen.getByRole('switch', {name: '휴무일 계산 사용'}));
        await waitFor(() => {
            expect(screen.getByRole('button', {name: '저장하기'})).toBeEnabled();
        });

        await user.click(screen.getByRole('button', {name: /신청근무 접수|근무 신청/}));

        expect(selectTab).not.toHaveBeenCalled();
        expect(screen.getByText('저장하지 않고 나갈까요?')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '저장 안 함'}));

        expect(selectTab).toHaveBeenCalledWith('requestReception');
    });

    it('근무 유형 추가하기를 누르면 새 근무 유형 행을 추가한다', async () => {
        const user = userEvent.setup();

        mockUseWardSettings.mockReturnValue(createValue());

        render(<WardSettingsPage />);

        await user.click(screen.getByRole('button', {name: '근무 유형 추가하기'}));

        expect(screen.getByDisplayValue('W')).toBeInTheDocument();
    });

    it('기본 근무 유형도 삭제할 수 있다', async () => {
        const user = userEvent.setup();

        mockUseWardSettings.mockReturnValue(createValue());

        render(<WardSettingsPage />);

        await user.click(screen.getByRole('button', {name: '데이 삭제'}));

        expect(screen.queryByDisplayValue('데이')).not.toBeInTheDocument();
    });

    it('사용된 근무 유형은 약자·분류·색상 변경과 삭제를 막고 토스트로 안내한다', async () => {
        const user = userEvent.setup();
        const deleteShiftType = vi.fn();

        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    shiftTypes: [{...baseValue().state.shiftTypes[0], isUsed: true}],
                },
                actions: {
                    deleteShiftType,
                },
            }),
        );

        render(<WardSettingsPage />);

        const shortNameInput = screen.getByDisplayValue('D');

        expect(shortNameInput).toHaveAttribute('readonly');

        await user.click(shortNameInput);
        await user.keyboard('X');
        await user.click(screen.getByRole('combobox', {name: '데이 근무 의미 선택'}));
        await user.click(screen.getByRole('button', {name: '데이 색상 선택'}));
        await user.click(screen.getByRole('button', {name: '데이 삭제'}));

        expect(shortNameInput).toHaveValue('D');
        expect(deleteShiftType).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith('근무표에 사용된 근무유형은 삭제하거나 비활성화할 수 없어요.');
        expect(toast.error).toHaveBeenCalledWith(
            '근무표에 사용된 근무유형은 약자·유형·색상을 변경할 수 없어요. 이름과 시간만 변경할 수 있어요.',
        );
    });

    it('기본 근무를 삭제하고 같은 의미의 근무를 추가하면 기존 근무를 수정한다', async () => {
        const user = userEvent.setup();
        const deleteShiftType = vi.fn().mockResolvedValue(true);
        const updateShiftType = vi.fn().mockResolvedValue(true);

        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    shiftTypes: requiredShiftTypes(),
                },
                actions: {
                    deleteShiftType,
                    updateShiftType,
                },
            }),
        );

        render(<WardSettingsPage />);

        await user.click(screen.getByRole('button', {name: '데이 삭제'}));
        await user.click(screen.getByRole('button', {name: '근무 유형 추가하기'}));
        await user.click(screen.getByRole('combobox', {name: '새 근무 근무 의미 선택'}));
        await user.click(screen.getByRole('option', {name: '주간 근무 (Day)'}));
        await user.click(screen.getByRole('button', {name: '저장하기'}));

        await waitFor(() => {
            expect(deleteShiftType).not.toHaveBeenCalled();
            expect(updateShiftType).toHaveBeenCalledWith(1, expect.objectContaining({classification: 'DAY', isDefault: true}));
        });
    });

    it('이미 사용 중인 D/E/N/O 근무 의미는 다른 행의 옵션에서 숨긴다', async () => {
        const user = userEvent.setup();

        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    shiftTypes: requiredShiftTypes(),
                },
            }),
        );

        render(<WardSettingsPage />);

        await user.click(screen.getByRole('combobox', {name: '데이 근무 의미 선택'}));

        expect(screen.getByRole('option', {name: '주간 근무 (Day)'})).toBeInTheDocument();
        expect(screen.queryByRole('option', {name: '저녁 근무 (Evening)'})).not.toBeInTheDocument();
        expect(screen.queryByRole('option', {name: '야간 근무 (Night)'})).not.toBeInTheDocument();
        expect(screen.queryByRole('option', {name: '휴무 (Off)'})).not.toBeInTheDocument();
        expect(screen.getByRole('option', {name: '기타 근무'})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: '기타 휴무'})).toBeInTheDocument();
    });

    it('색상 버튼을 누르면 색상 팔레트를 연다', async () => {
        const user = userEvent.setup();

        mockUseWardSettings.mockReturnValue(createValue());

        render(<WardSettingsPage />);

        await user.click(screen.getByRole('button', {name: '데이 색상 선택'}));

        expect(screen.getByRole('button', {name: '#63C8B8 선택'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: '#5B6470 선택'})).toBeInTheDocument();
        expect(screen.getAllByRole('button', {name: /#[0-9A-F]{6} 선택/})).toHaveLength(15);
    });

    it('근무 의미에서 휴무를 선택하면 draft만 휴무 상태로 바꾼다', async () => {
        const user = userEvent.setup();
        const updateShiftType = vi.fn();

        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    shiftTypes: [
                        {
                            ...baseValue().state.shiftTypes[0],
                            isDefault: false,
                        },
                    ],
                },
                actions: {
                    updateShiftType,
                },
            }),
        );

        render(<WardSettingsPage />);

        const classificationSelect = screen.getByRole('combobox', {name: '데이 근무 의미 선택'});

        await user.click(classificationSelect);
        await user.click(screen.getByRole('option', {name: '휴무 (Off)'}));

        expect(updateShiftType).not.toHaveBeenCalled();
        expect(screen.getAllByDisplayValue('-')).toHaveLength(2);
        expect(screen.queryByText('edit-modal:데이')).not.toBeInTheDocument();
    });

    it('제약 조건 탭에서 팀이 없으면 안내 상태를 보여준다', () => {
        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    currentTab: 'constraints',
                    shiftTeams: [],
                    currentShiftTeamId: null,
                },
            }),
        );

        render(<WardSettingsPage />);

        expect(screen.getByText('등록된 근무팀이 없어요')).toBeInTheDocument();
        expect(screen.getByText('제약 조건을 관리하려면 먼저 근무팀을 만들어 주세요.')).toBeInTheDocument();
    });

    it('제약 조건 탭에서 팀이 하나이면 팀 탭 없이 제약조건 UI를 보여준다', () => {
        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    currentTab: 'constraints',
                },
            }),
        );

        render(<WardSettingsPage />);

        expect(screen.queryByText('대상 팀')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '중환자실 A팀'})).not.toBeInTheDocument();
        expect(screen.getByTestId('shift-constraint-rules')).toHaveTextContent('rules:1:1:settings');
    });

    it('제약 조건 탭에서 다른 팀으로 전환할 수 있다', async () => {
        const user = userEvent.setup();
        const selectShiftTeam = vi.fn();

        mockUseWardSettings.mockReturnValue(
            createValue({
                state: {
                    currentTab: 'constraints',
                    shiftTeams: [
                        {shiftTeamId: 1, name: '중환자실 A팀', nurseCnt: 0, nurses: []},
                        {shiftTeamId: 2, name: '중환자실 B팀', nurseCnt: 0, nurses: []},
                    ],
                    currentShiftTeamId: 1,
                },
                actions: {
                    selectShiftTeam,
                },
            }),
        );

        render(<WardSettingsPage />);

        expect(screen.getByText('대상 팀')).toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: '중환자실 B팀'}));

        expect(selectShiftTeam).toHaveBeenCalledWith(2);
    });
});
