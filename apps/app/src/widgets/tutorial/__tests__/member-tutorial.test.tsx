import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import MemberTutorial from '../MemberTutorial';
import {type ITutorialConfig} from '../tutorial.types';

const setMemberTutorialMock = vi.fn();
const selectNurseMock = vi.fn();
const tutorialPortalMock = vi.fn();

type TMockEditShiftTeamState = {
    shiftTeams?: Array<{
        shiftTeamId: number;
        name: string;
        nurseCnt: number;
        nurses: Array<{
            nurseId: number;
            name: string;
        }>;
    }>;
};

let tutorialStoreState = {
    showMemberTutorial: true,
};
let editShiftTeamState: TMockEditShiftTeamState = createEditShiftTeamState();

vi.mock('@/features/tutorial/model/store', () => ({
    useTutorialStore: (selector: (state: typeof tutorialStoreState) => unknown) => selector(tutorialStoreState),
}));

vi.mock('@/features/tutorial', () => ({
    default: () => ({
        setMemberTutorial: setMemberTutorialMock,
    }),
}));

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {accountId: 1},
        actions: {},
    }),
}));

vi.mock('@/features/edit-shift-team', () => ({
    default: () => ({
        state: editShiftTeamState,
        actions: {
            selectNurse: selectNurseMock,
        },
    }),
}));

vi.mock('../TutorialPortal', () => ({
    TutorialPortal: ({open, config, closeCallback}: {closeCallback: () => void; config: ITutorialConfig; open: boolean}) => {
        tutorialPortalMock({open, config, closeCallback});

        return <div data-testid="tutorial-portal" data-open={String(open)} data-step-count={String(config.steps.length)} />;
    },
}));

function createEditShiftTeamState(overrides: Partial<TMockEditShiftTeamState> = {}): TMockEditShiftTeamState {
    return {
        shiftTeams: [
            {
                shiftTeamId: 1,
                name: 'A팀',
                nurseCnt: 1,
                nurses: [
                    {
                        nurseId: 101,
                        name: '김민지',
                    },
                ],
            },
        ],
        ...overrides,
    };
}

function getLastTutorialConfig() {
    return (tutorialPortalMock.mock.lastCall?.[0] as {config: ITutorialConfig}).config;
}

describe('MemberTutorial', () => {
    beforeEach(() => {
        tutorialStoreState = {showMemberTutorial: true};
        editShiftTeamState = createEditShiftTeamState();
        setMemberTutorialMock.mockReset();
        selectNurseMock.mockReset();
        tutorialPortalMock.mockReset();
        localStorage.clear();
    });

    it('builds the member management tutorial flow', () => {
        render(<MemberTutorial />);

        const config = getLastTutorialConfig();

        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'true');
        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-step-count', '3');
        expect(config.steps.map((step) => step.highlightIds)).toEqual([
            ['shift_team_list'],
            ['member_add_nurse_button'],
            ['nurse_sample', 'nurse_edit_drawer'],
        ]);
        expect(config.steps.map((step) => step.title)).toEqual([
            '팀별 간호사 보기',
            '간호사 추가하기',
            '간호사 정보 수정하기',
        ]);
        expect(config.steps[0]?.info).toContain('팀명을 두 번 클릭');
        expect(config.steps[2]?.info).toContain('역할·권한');
    });

    it('opens the first nurse only when entering detail guidance and closes it when leaving the step', () => {
        render(<MemberTutorial />);

        const config = getLastTutorialConfig();

        selectNurseMock.mockClear();
        config.steps[0]?.onNextStep?.();

        expect(selectNurseMock).not.toHaveBeenCalled();

        config.steps[1]?.onNextStep?.();

        expect(selectNurseMock).toHaveBeenCalledWith(101);

        config.steps[2]?.onPrevStep?.();

        expect(selectNurseMock).toHaveBeenLastCalledWith(null);

        selectNurseMock.mockClear();
        config.steps[2]?.onNextStep?.();

        expect(selectNurseMock).toHaveBeenCalledWith(null);
    });

    it('skips detail-panel guidance when there is no nurse to select', () => {
        editShiftTeamState = createEditShiftTeamState({
            shiftTeams: [{shiftTeamId: 1, name: 'A팀', nurseCnt: 0, nurses: []}],
        });

        render(<MemberTutorial />);

        const config = getLastTutorialConfig();

        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-step-count', '2');
        expect(config.steps.map((step) => step.highlightIds)).toEqual([
            ['shift_team_list'],
            ['member_add_nurse_button'],
        ]);
    });

    it('waits until shift teams are loaded before opening', () => {
        editShiftTeamState = createEditShiftTeamState({shiftTeams: undefined});

        render(<MemberTutorial />);

        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'false');
    });
});
