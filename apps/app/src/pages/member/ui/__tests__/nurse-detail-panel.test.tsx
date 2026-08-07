import {beforeEach, describe, expect, it, vi} from 'vitest';
import {type TNurse} from '@/entities';
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

const renderPanel = (selectedNurse: TNurse) => {
    const updateNurse = vi.fn().mockResolvedValue(true);

    mockUseEditShiftTeam.mockReturnValue({
        state: {
            selectedNurse,
            selectedNurseDrawerMode: 'edit',
            nurseSaveStatus: 'idle',
            isDeletingNurse: false,
        },
        actions: {
            updateNurse,
            updateNurseShift: vi.fn(),
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
            wardShiftTypes={[]}
        />,
    );

    return {...utils, updateNurse};
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
        expect(saveButton).toBeDisabled();

        fireEvent.change(birthDateInput, {target: {value: '1996-03-14'}});

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

    it('shows a clear empty state when birthDate is missing', () => {
        renderPanel(createNurse({accountId: null, isConnected: false, birthDate: null}));

        expect(screen.getByText('생년월일')).toBeInTheDocument();
        expect(screen.getByText('미입력')).toBeInTheDocument();
        expect(screen.getByLabelText('생년월일')).toHaveValue('');
        expect(screen.getByLabelText('생년월일')).toBeDisabled();
    });
});
