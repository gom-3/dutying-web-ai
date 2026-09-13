import {beforeEach, describe, expect, it, vi} from 'vitest';
import {type TNurse, type TWardShiftType} from '@/entities';
import {fireEvent, render, screen, waitFor, within} from '@/shared/util/test-utils';
import NurseDetailPanel from '../nurse-detail-panel';

const mockUseEditShiftTeam = vi.fn();

vi.mock('@/analytics', () => ({
    events: {
        memberPage: {
            editNurseDrawer: {
                changeNurseName: 'changeNurseName',
                changeNurseShiftTypes: 'changeNurseShiftTypes',
            },
        },
    },
    sendEvent: vi.fn(),
}));

vi.mock('@/features/edit-shift-team', () => ({
    default: () => mockUseEditShiftTeam(),
}));

const createNurse = (overrides: Partial<TNurse> = {}): TNurse => ({
    nurseId: 101,
    accountId: 42,
    shiftTeamId: 10,
    wardId: 1,
    name: '김듀티',
    phoneNum: null,
    birthDate: null,
    isConnected: true,
    nurseShiftTypes: [],
    isWorker: true,
    isDutyManager: false,
    isWardManager: false,
    gender: '',
    employmentDate: '',
    memo: '',
    isDeleted: false,
    divisionNum: 1,
    priority: 100,
    ...overrides,
});
const createWardShiftType = (overrides: Partial<TWardShiftType> = {}): TWardShiftType => ({
    wardShiftTypeId: 1,
    name: 'Day',
    shortName: 'D',
    startTime: '07:00',
    endTime: '15:00',
    color: '#7C3AED',
    isDefault: true,
    isOff: false,
    isCounted: true,
    classification: 'DAY',
    ...overrides,
});
const createNurseWithMonthlyShiftRatio = () =>
    createNurse({
        nurseShiftTypes: [
            {
                nurseShiftTypeId: 101,
                wardShiftTypeId: 1,
                name: 'Day',
                shortName: 'D',
                isPossible: true,
                isPreferred: false,
                targetRatioWeight: 21,
            },
        ],
    });
const renderPanel = (
    selectedNurse: TNurse,
    wardShiftTypes: TWardShiftType[] = [],
    onSaveSuccess?: () => void,
    variant: 'panel' | 'modal' = 'panel',
) => {
    const saveNurseDetails = vi.fn().mockResolvedValue(true);
    const deleteNurse = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    mockUseEditShiftTeam.mockReturnValue({
        state: {
            selectedNurse,
            selectedNurseDrawerMode: 'edit',
            nurseSaveStatus: 'idle',
            isDeletingNurse: false,
        },
        actions: {
            saveNurseDetails,
            deleteNurse,
            setNurseDraftDirty: vi.fn(),
            disconnectNurse: vi.fn(),
        },
    });

    const utils = render(
        <NurseDetailPanel
            onClose={onClose}
            onSaveSuccess={onSaveSuccess}
            onOpenWardCodeGuide={vi.fn()}
            shiftTeams={[{shiftTeamId: 10, name: 'A팀', nurseCnt: 1, nurses: [selectedNurse]}]}
            onMoveShiftTeam={vi.fn()}
            wardShiftTypes={wardShiftTypes}
            variant={variant}
        />,
    );

    return {...utils, deleteNurse, onClose, saveNurseDetails};
};

describe('NurseDetailPanel', () => {
    beforeEach(() => {
        mockUseEditShiftTeam.mockReset();
    });

    it('lets a connected nurse birthDate be edited and sends it in the nurse patch payload', async () => {
        const {saveNurseDetails} = renderPanel(createNurse({birthDate: null}));
        const birthDateInput = screen.getByLabelText('생년월일');
        const saveButton = screen.getByRole('button', {name: '저장하기'});

        expect(birthDateInput).toHaveValue('');
        expect(birthDateInput).not.toBeDisabled();
        expect(birthDateInput).toHaveAttribute('type', 'text');
        expect(birthDateInput).toHaveAttribute('inputmode', 'numeric');
        expect(saveButton).toBeDisabled();

        fireEvent.change(birthDateInput, {target: {value: '19960314'}});

        expect(birthDateInput).toHaveValue('1996-03-14');

        await waitFor(() => expect(saveButton).toBeEnabled());

        fireEvent.click(saveButton);

        await waitFor(() =>
            expect(saveNurseDetails).toHaveBeenCalledWith(
                101,
                expect.objectContaining({
                    nurse: expect.objectContaining({birthDate: '1996-03-14'}),
                }),
            ),
        );
    });

    it('does not show a calendar picker for birthDate', () => {
        renderPanel(createNurse({birthDate: '1996-03-14'}));

        expect(screen.queryByRole('button', {name: '생년월일 달력 열기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog', {name: '생년월일 날짜 선택'})).not.toBeInTheDocument();
    });

    it('shows birthDate in the date field', () => {
        renderPanel(createNurse({birthDate: '1996-03-14'}));

        expect(screen.getByLabelText('생년월일')).toHaveValue('1996-03-14');
    });

    it('lets an unconnected nurse birthDate be entered directly', async () => {
        const {saveNurseDetails} = renderPanel(createNurse({accountId: null, isConnected: false, birthDate: null}));
        const birthDateInput = screen.getByLabelText('생년월일');

        expect(screen.getByText('생년월일')).toBeInTheDocument();
        expect(screen.getByText('미입력')).toBeInTheDocument();
        expect(birthDateInput).toHaveValue('');
        expect(birthDateInput).toBeEnabled();

        fireEvent.change(birthDateInput, {target: {value: '19960314'}});
        fireEvent.click(screen.getByRole('button', {name: '저장하기'}));

        await waitFor(() =>
            expect(saveNurseDetails).toHaveBeenCalledWith(
                101,
                expect.objectContaining({nurse: expect.objectContaining({birthDate: '1996-03-14'})}),
            ),
        );
    });

    it('omits birthDate from the nurse patch payload when it was not edited', async () => {
        const {saveNurseDetails} = renderPanel(createNurse({birthDate: '1996-03-14'}));

        fireEvent.change(screen.getByDisplayValue('김듀티'), {target: {value: '김수정'}});
        fireEvent.click(screen.getByRole('button', {name: '저장하기'}));

        await waitFor(() => expect(saveNurseDetails).toHaveBeenCalled());
        expect(saveNurseDetails.mock.calls[0]?.[1]?.nurse).not.toHaveProperty('birthDate');
    });

    it('does not replace an in-progress draft when the selected nurse cache refreshes', () => {
        let selectedNurse = createNurse();

        const saveNurseDetails = vi.fn().mockResolvedValue(true);
        const getEditShiftTeamState = () => ({
            state: {
                selectedNurse,
                selectedNurseDrawerMode: 'edit',
                nurseSaveStatus: 'idle',
                isDeletingNurse: false,
            },
            actions: {
                saveNurseDetails,
                deleteNurse: vi.fn(),
                setNurseDraftDirty: vi.fn(),
                disconnectNurse: vi.fn(),
            },
        });

        mockUseEditShiftTeam.mockImplementation(getEditShiftTeamState);

        const createPanel = () => (
            <NurseDetailPanel
                onClose={vi.fn()}
                onOpenWardCodeGuide={vi.fn()}
                shiftTeams={[{shiftTeamId: 10, name: 'A팀', nurseCnt: 1, nurses: [selectedNurse]}]}
                onMoveShiftTeam={vi.fn()}
                wardShiftTypes={[]}
            />
        );
        const {rerender} = render(createPanel());

        fireEvent.change(screen.getByDisplayValue('김듀티'), {target: {value: '작성 중인 이름'}});

        selectedNurse = {...selectedNurse, phoneNum: '01012345678'};
        rerender(createPanel());

        expect(screen.getByDisplayValue('작성 중인 이름')).toBeInTheDocument();
    });

    it('deduplicates repeated save clicks while the same save is in progress', async () => {
        let resolveSave: ((saved: boolean) => void) | undefined;

        const {saveNurseDetails} = renderPanel(createNurse());

        saveNurseDetails.mockReturnValue(
            new Promise<boolean>((resolve) => {
                resolveSave = resolve;
            }),
        );
        fireEvent.change(screen.getByDisplayValue('김듀티'), {target: {value: '김수정'}});

        const saveButton = screen.getByRole('button', {name: '저장하기'});

        fireEvent.click(saveButton);
        fireEvent.click(saveButton);

        expect(saveNurseDetails).toHaveBeenCalledTimes(1);

        resolveSave?.(true);

        await waitFor(() => expect(screen.getByText('저장하기')).toBeInTheDocument());
    });

    it('treats a successful save as the new baseline before the query cache refreshes', async () => {
        const {onClose, saveNurseDetails} = renderPanel(createNurse());

        fireEvent.change(screen.getByDisplayValue('김듀티'), {target: {value: '김수정'}});
        fireEvent.click(screen.getByRole('button', {name: '저장하기'}));

        await waitFor(() => expect(saveNurseDetails).toHaveBeenCalledOnce());
        await waitFor(() => expect(screen.getByRole('button', {name: '저장하기'})).toBeDisabled());

        fireEvent.click(screen.getByRole('button', {name: '근무자 패널 닫기'}));

        expect(screen.queryByRole('dialog', {name: '저장하지 않고 나갈까요?'})).not.toBeInTheDocument();
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('notifies the modal to close only after saving succeeds', async () => {
        const onSaveSuccess = vi.fn();
        const {saveNurseDetails} = renderPanel(createNurse(), [], onSaveSuccess);

        fireEvent.change(screen.getByDisplayValue('김듀티'), {target: {value: '김수정'}});
        fireEvent.click(screen.getByRole('button', {name: '저장하기'}));

        await waitFor(() => expect(saveNurseDetails).toHaveBeenCalledOnce());
        await waitFor(() => expect(onSaveSuccess).toHaveBeenCalledOnce());
    });

    it('keeps the modal open when saving fails', async () => {
        const onSaveSuccess = vi.fn();
        const {saveNurseDetails} = renderPanel(createNurse(), [], onSaveSuccess);

        saveNurseDetails.mockResolvedValue(false);
        fireEvent.change(screen.getByDisplayValue('김듀티'), {target: {value: '김수정'}});
        fireEvent.click(screen.getByRole('button', {name: '저장하기'}));

        await waitFor(() => expect(saveNurseDetails).toHaveBeenCalledOnce());
        expect(onSaveSuccess).not.toHaveBeenCalled();
    });

    it('closes the worker editor only after nurse deletion succeeds', async () => {
        const {deleteNurse, onClose} = renderPanel(createNurse(), [], undefined, 'modal');

        fireEvent.click(screen.getByRole('button', {name: '삭제하기'}));

        const dialog = screen.getByRole('dialog', {name: '간호사를 삭제할까요?'});

        expect(dialog.closest('aside')).not.toBeNull();

        fireEvent.click(within(dialog).getByRole('button', {name: '삭제하기'}));

        await waitFor(() => expect(deleteNurse).toHaveBeenCalledWith(10, 101));
        await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
        expect(screen.queryByRole('dialog', {name: '간호사를 삭제할까요?'})).not.toBeInTheDocument();
    });

    it('keeps the delete confirmation available for retry when deletion fails', async () => {
        const {deleteNurse, onClose} = renderPanel(createNurse(), [], undefined, 'modal');

        deleteNurse.mockResolvedValue(false);
        fireEvent.click(screen.getByRole('button', {name: '삭제하기'}));

        const dialog = screen.getByRole('dialog', {name: '간호사를 삭제할까요?'});

        fireEvent.click(within(dialog).getByRole('button', {name: '삭제하기'}));

        await waitFor(() => expect(deleteNurse).toHaveBeenCalledWith(10, 101));
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog', {name: '간호사를 삭제할까요?'})).toBeInTheDocument();
    });

    it('offers only cancel or leave without saving when closing a dirty detail panel', () => {
        const {onClose} = renderPanel(createNurse());

        fireEvent.change(screen.getByDisplayValue('김듀티'), {target: {value: '김수정'}});
        fireEvent.click(screen.getByRole('button', {name: '근무자 패널 닫기'}));

        const dialog = screen.getByRole('dialog', {name: '저장하지 않고 나갈까요?'});

        expect(within(dialog).getAllByRole('button')).toHaveLength(2);
        expect(within(dialog).getByRole('button', {name: '취소'})).toBeInTheDocument();
        expect(within(dialog).getByRole('button', {name: '저장 안 함'})).toBeInTheDocument();
        expect(within(dialog).queryByRole('button', {name: '저장 후 나가기'})).not.toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole('button', {name: '저장 안 함'}));

        expect(onClose).toHaveBeenCalledOnce();
    });

    // nurse-detail-panel.tsx 의 ENABLE_MONTHLY_SHIFT_RATIO 가 false 라 월간 근무 비율 UI 자체가
    // 렌더되지 않는다. 기능을 다시 켜면 그대로 되살릴 수 있도록 지우지 않고 skip 한다.
    it.skip('allows the monthly shift ratio value to be cleared and replaced directly', async () => {
        const nurse = createNurseWithMonthlyShiftRatio();
        const {saveNurseDetails} = renderPanel(nurse, [createWardShiftType()]);

        fireEvent.click(screen.getByRole('button', {name: '월간 근무 비율'}));

        const ratioInput = screen.getByLabelText('Day 월간 근무 일수') as HTMLInputElement;
        const selectSpy = vi.spyOn(ratioInput, 'select');

        expect(ratioInput).toHaveValue(21);

        fireEvent.focus(ratioInput);
        expect(selectSpy).toHaveBeenCalledOnce();

        fireEvent.change(ratioInput, {target: {value: ''}});
        expect(ratioInput).toHaveValue(null);

        fireEvent.change(ratioInput, {target: {value: '12'}});
        expect(ratioInput).toHaveValue(12);

        fireEvent.click(screen.getByRole('button', {name: '저장하기'}));

        await waitFor(() =>
            expect(saveNurseDetails).toHaveBeenCalledWith(
                101,
                expect.objectContaining({
                    shiftTypes: [
                        expect.objectContaining({
                            nurseShiftTypeId: 101,
                            change: {isPossible: true, targetRatioWeight: 12},
                            shiftTypeMeta: expect.objectContaining({wardShiftTypeId: 1, targetRatioWeight: 12}),
                        }),
                    ],
                }),
            ),
        );
    });

    it.skip('restores the saved monthly shift ratio when the field is left empty', () => {
        const nurse = createNurseWithMonthlyShiftRatio();

        renderPanel(nurse, [createWardShiftType()]);

        fireEvent.click(screen.getByRole('button', {name: '월간 근무 비율'}));

        const ratioInput = screen.getByLabelText('Day 월간 근무 일수');

        fireEvent.change(ratioInput, {target: {value: ''}});
        fireEvent.blur(ratioInput);

        expect(ratioInput).toHaveValue(21);
        expect(screen.getByRole('button', {name: '저장하기'})).toBeDisabled();
    });

    it.skip('clamps an out-of-range monthly shift ratio when editing is finished', () => {
        const nurse = createNurseWithMonthlyShiftRatio();

        renderPanel(nurse, [createWardShiftType()]);

        fireEvent.click(screen.getByRole('button', {name: '월간 근무 비율'}));

        const ratioInput = screen.getByLabelText('Day 월간 근무 일수');

        fireEvent.change(ratioInput, {target: {value: '100'}});
        expect(ratioInput).toHaveValue(100);

        fireEvent.blur(ratioInput);

        expect(ratioInput).toHaveValue(99);
    });

    it('hides monthly shift ratio controls while the feature is disabled', () => {
        const nurse = createNurseWithMonthlyShiftRatio();

        renderPanel(nurse, [createWardShiftType()]);

        expect(screen.queryByRole('button', {name: '월간 근무 비율'})).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Day 월간 근무 일수')).not.toBeInTheDocument();
    });

    it('aligns the modal fields in one scroll region and keeps long memos usable', () => {
        renderPanel(createNurse(), [], undefined, 'modal');

        const nameInput = screen.getByDisplayValue('김듀티');
        const nameRow = nameInput.closest('.grid');
        const scrollRegion = nameInput.closest('[data-worker-edit-scroll-region]');
        const memo = screen.getByLabelText('비고');
        const modalSections = Array.from(scrollRegion?.children ?? []);

        expect(scrollRegion).toContainElement(memo);
        expect(modalSections).toHaveLength(4);
        modalSections.forEach((section) => {
            expect(section).toHaveClass('px-7');
            expect(section).not.toHaveClass('min-[1600px]:px-4');
        });
        expect(nameRow).toHaveClass('grid-cols-1');
        expect(nameInput).toHaveClass('rounded-[12px]');
        expect(nameInput).toHaveClass('focus:!bg-[#E5E8ED]', 'focus:!text-[#191F28]');
        expect(memo).toHaveClass('min-h-20', 'max-h-36', 'overflow-y-auto', '[field-sizing:content]', '[overflow-wrap:anywhere]');
        expect(screen.queryByText('기본 정보')).not.toBeInTheDocument();
        expect(screen.queryByText('미입력')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '김듀티 연동 상태'})).not.toBeInTheDocument();
    });

    it('renders the available-shifts tooltip above the worker edit modal', async () => {
        renderPanel(createNurse(), [], undefined, 'modal');

        fireEvent.focus(screen.getByRole('button', {name: '가능 근무 안내'}));

        await waitFor(() =>
            expect(screen.getAllByText('가능한 근무를 모두 선택해 주세요').some((element) => element.classList.contains('z-[1100]'))).toBe(
                true,
            ),
        );
    });
});
