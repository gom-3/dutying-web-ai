import {beforeEach, describe, expect, it, vi} from 'vitest';
import {type TNurse, type TWardShiftType} from '@/entities';
import {fireEvent, render, screen, waitFor} from '@/shared/util/test-utils';
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
const renderPanel = (selectedNurse: TNurse, wardShiftTypes: TWardShiftType[] = []) => {
    const updateNurse = vi.fn().mockResolvedValue(true);
    const updateNurseShift = vi.fn().mockResolvedValue(true);

    mockUseEditShiftTeam.mockReturnValue({
        state: {
            selectedNurse,
            selectedNurseDrawerMode: 'edit',
            nurseSaveStatus: 'idle',
            isDeletingNurse: false,
        },
        actions: {
            updateNurse,
            updateNurseShift,
            deleteNurse: vi.fn(),
            setNurseDraftDirty: vi.fn(),
            disconnectNurse: vi.fn(),
        },
    });

    const utils = render(
        <NurseDetailPanel
            onClose={vi.fn()}
            onOpenWardCodeGuide={vi.fn()}
            shiftTeams={[{shiftTeamId: 10, name: 'A팀', nurseCnt: 1, nurses: [selectedNurse]}]}
            onMoveShiftTeam={vi.fn()}
            wardShiftTypes={wardShiftTypes}
        />,
    );

    return {...utils, updateNurse, updateNurseShift};
};

describe('NurseDetailPanel', () => {
    beforeEach(() => {
        mockUseEditShiftTeam.mockReset();
    });

    it('lets a connected nurse birthDate be edited and sends it in the nurse patch payload', async () => {
        const {updateNurse} = renderPanel(createNurse({birthDate: null}));
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
            expect(updateNurse).toHaveBeenCalledWith(
                101,
                expect.objectContaining({
                    birthDate: '1996-03-14',
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
        const {updateNurse} = renderPanel(createNurse({accountId: null, isConnected: false, birthDate: null}));
        const birthDateInput = screen.getByLabelText('생년월일');

        expect(screen.getByText('생년월일')).toBeInTheDocument();
        expect(screen.getByText('미입력')).toBeInTheDocument();
        expect(birthDateInput).toHaveValue('');
        expect(birthDateInput).toBeEnabled();

        fireEvent.change(birthDateInput, {target: {value: '19960314'}});
        fireEvent.click(screen.getByRole('button', {name: '저장하기'}));

        await waitFor(() => expect(updateNurse).toHaveBeenCalledWith(101, expect.objectContaining({birthDate: '1996-03-14'})));
    });

    it('omits birthDate from the nurse patch payload when it was not edited', async () => {
        const {updateNurse} = renderPanel(createNurse({birthDate: '1996-03-14'}));

        fireEvent.change(screen.getByDisplayValue('김듀티'), {target: {value: '김수정'}});
        fireEvent.click(screen.getByRole('button', {name: '저장하기'}));

        await waitFor(() => expect(updateNurse).toHaveBeenCalled());
        expect(updateNurse.mock.calls[0]?.[1]).not.toHaveProperty('birthDate');
    });

    it('allows the monthly shift ratio value to be cleared and replaced directly', async () => {
        const nurse = createNurseWithMonthlyShiftRatio();
        const {updateNurseShift} = renderPanel(nurse, [createWardShiftType()]);

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
            expect(updateNurseShift).toHaveBeenCalledWith(
                101,
                101,
                {isPossible: true, targetRatioWeight: 12},
                expect.objectContaining({wardShiftTypeId: 1, targetRatioWeight: 12}),
            ),
        );
    });

    it('restores the saved monthly shift ratio when the field is left empty', () => {
        const nurse = createNurseWithMonthlyShiftRatio();

        renderPanel(nurse, [createWardShiftType()]);

        fireEvent.click(screen.getByRole('button', {name: '월간 근무 비율'}));

        const ratioInput = screen.getByLabelText('Day 월간 근무 일수');

        fireEvent.change(ratioInput, {target: {value: ''}});
        fireEvent.blur(ratioInput);

        expect(ratioInput).toHaveValue(21);
        expect(screen.getByRole('button', {name: '저장하기'})).toBeDisabled();
    });

    it('clamps an out-of-range monthly shift ratio when editing is finished', () => {
        const nurse = createNurseWithMonthlyShiftRatio();

        renderPanel(nurse, [createWardShiftType()]);

        fireEvent.click(screen.getByRole('button', {name: '월간 근무 비율'}));

        const ratioInput = screen.getByLabelText('Day 월간 근무 일수');

        fireEvent.change(ratioInput, {target: {value: '100'}});
        expect(ratioInput).toHaveValue(100);

        fireEvent.blur(ratioInput);

        expect(ratioInput).toHaveValue(99);
    });
});
