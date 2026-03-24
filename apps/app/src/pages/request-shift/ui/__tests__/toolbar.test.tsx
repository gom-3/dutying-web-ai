import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import Toolbar from '../toolbar';

const mockUseRequestShift = vi.fn();
const mockSendEvent = vi.fn();
const translations: Record<string, string> = {
    'page.duty.prevMonth': '이전 달',
    'page.duty.nextMonth': '다음 달',
    'page.duty.monthHeader': '{{year}}년 {{month}}월',
    'page.request.toolbar.readonlyTitle': '{{month}}월 신청 근무 확정본',
    'page.request.toolbar.editTitle': '신청 근무를 확정해 주세요',
    'page.request.toolbar.editAction': '수정하기',
    'page.request.toolbar.saveAction': '저장하기',
    'page.request.toolbar.savingAction': '저장 중...',
    'page.request.toolbar.readonlyDescription': '수정하기를 누르면 신청 근무를 바로 조정할 수 있어요.',
    'page.request.toolbar.editingDescription': '변경 사항은 자동으로 저장돼요. 저장이 끝나면 저장하기로 마무리할 수 있어요.',
    'page.request.toolbar.savingDescription': '최근 변경 사항을 저장하고 있어요.',
    'page.request.toolbar.savedDescription': '최근 변경 사항이 저장되었어요.',
    'page.request.toolbar.noTeamsLabel': '등록된 팀이 없어요',
    'page.request.toolbar.saveError': '최근 변경 저장에 실패했어요. 다시 저장해 주세요.',
};

vi.mock('@/features/request-shift', () => ({
    default: () => mockUseRequestShift(),
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string, params?: Record<string, string | number>) => {
            const template = translations[key] ?? key;

            return template.replace(/\{\{(\w+)\}\}/g, (_, token) => String(params?.[token] ?? ''));
        },
    }),
}));

vi.mock('@/analytics', () => ({
    events: {
        requestPage: {
            toolbar: {
                changeMonth: 'changeMonth',
                changeShiftTeam: 'changeShiftTeam',
                changeEditMode: 'changeEditMode',
            },
        },
    },
    sendEvent: (...args: unknown[]) => mockSendEvent(...args),
}));

vi.mock('@/widgets/duty-management/ui', () => ({
    DutyManagementMonthTeamHeader: ({
        onPrevMonth,
        onNextMonth,
        onSelectShiftTeam,
        disabled,
    }: {
        onPrevMonth: () => void;
        onNextMonth: () => void;
        onSelectShiftTeam: (shiftTeamId: number) => void;
        disabled: boolean;
    }) => (
        <div>
            <button type="button" onClick={onPrevMonth} disabled={disabled}>
                이전
            </button>
            <button type="button" onClick={onNextMonth} disabled={disabled}>
                다음
            </button>
            <button type="button" onClick={() => onSelectShiftTeam(2)} disabled={disabled}>
                팀 변경
            </button>
        </div>
    ),
}));

type TMockState = {
    year: number;
    month: number;
    changeStatus: 'idle' | 'loading' | 'success' | 'error';
    currentShiftTeam: {shiftTeamId: number; name: string} | null;
    shiftTeams: Array<{shiftTeamId: number; name: string}>;
    readonly: boolean;
    editAvailability: {
        canEdit: boolean;
        status: 'editable' | 'lockedPast' | 'lockedFuture';
        validationMessage: string | null;
        badgeLabel: string;
        periodLabel: string;
        description: string;
    };
};
type TMockActions = {
    changeMonth: ReturnType<typeof vi.fn>;
    changeShiftTeam: ReturnType<typeof vi.fn>;
    toggleEditMode: ReturnType<typeof vi.fn>;
};
type TMockValue = {
    state: TMockState;
    actions: TMockActions;
};

function createUseRequestShiftValue(overrides?: {state?: Partial<TMockState>; actions?: Partial<TMockActions>}): TMockValue {
    const baseState: TMockState = {
        year: 2026,
        month: 4,
        changeStatus: 'idle',
        currentShiftTeam: {shiftTeamId: 1, name: 'A팀'},
        shiftTeams: [
            {shiftTeamId: 1, name: 'A팀'},
            {shiftTeamId: 2, name: 'B팀'},
        ],
        readonly: true,
        editAvailability: {
            canEdit: true,
            status: 'editable',
            validationMessage: null,
            badgeLabel: '수정 가능',
            periodLabel: '수정 가능 범위: 지난달부터 다음 달까지',
            description: '현재 달력 범위에서는 신청 근무를 수정할 수 있어요.',
        },
    };
    const baseActions: TMockActions = {
        changeMonth: vi.fn(() => true),
        changeShiftTeam: vi.fn(() => true),
        toggleEditMode: vi.fn(() => true),
    };

    return {
        state: {
            ...baseState,
            ...overrides?.state,
        },
        actions: {
            ...baseActions,
            ...overrides?.actions,
        },
    };
}

describe('RequestShiftPage Toolbar', () => {
    beforeEach(() => {
        mockUseRequestShift.mockReset();
        mockSendEvent.mockReset();
    });

    it('읽기 전용 상태에서 수정 가능 안내를 보여준다', () => {
        mockUseRequestShift.mockReturnValue(createUseRequestShiftValue());

        render(<Toolbar />);

        expect(screen.getByText('4월 신청 근무 확정본')).toBeInTheDocument();
        expect(screen.getByText('수정하기를 누르면 신청 근무를 바로 조정할 수 있어요.')).toBeInTheDocument();
    });

    it('편집 중에는 자동 저장 안내를 보여준다', () => {
        mockUseRequestShift.mockReturnValue(
            createUseRequestShiftValue({
                state: {
                    readonly: false,
                },
            }),
        );

        render(<Toolbar />);

        expect(screen.getByText('변경 사항은 자동으로 저장돼요. 저장이 끝나면 저장하기로 마무리할 수 있어요.')).toBeInTheDocument();
    });

    it('저장 성공과 실패 피드백을 상태에 따라 보여준다', () => {
        mockUseRequestShift.mockReturnValue(
            createUseRequestShiftValue({
                state: {
                    changeStatus: 'success',
                },
            }),
        );

        const {rerender} = render(<Toolbar />);

        rerender(<Toolbar />);
        expect(screen.getByText('최근 변경 사항이 저장되었어요.')).toBeInTheDocument();

        mockUseRequestShift.mockReturnValue(
            createUseRequestShiftValue({
                state: {
                    changeStatus: 'error',
                },
            }),
        );

        rerender(<Toolbar />);
        expect(screen.getByText('최근 변경 저장에 실패했어요. 다시 저장해 주세요.')).toBeInTheDocument();
    });

    it('액션이 실제로 수행된 경우에만 툴바 이벤트를 전송한다', async () => {
        const user = userEvent.setup();
        const changeMonth = vi.fn(() => false);
        const toggleEditMode = vi.fn(() => false);
        const changeShiftTeam = vi.fn(() => false);

        mockUseRequestShift.mockReturnValue(
            createUseRequestShiftValue({
                actions: {
                    changeMonth,
                    toggleEditMode,
                    changeShiftTeam,
                },
            }),
        );

        render(<Toolbar />);

        await user.click(screen.getByRole('button', {name: '이전'}));
        await user.click(screen.getByRole('button', {name: '팀 변경'}));
        await user.click(screen.getByRole('button', {name: '수정하기'}));

        expect(changeMonth).toHaveBeenCalledWith('prev');
        expect(changeShiftTeam).toHaveBeenCalledWith({shiftTeamId: 2, name: 'B팀'});
        expect(toggleEditMode).toHaveBeenCalledTimes(1);
        expect(mockSendEvent).not.toHaveBeenCalled();
    });
});
