import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import RequestTutorial from '../RequestTutorial';
import {type ITutorialConfig} from '../tutorial.types';

const setRequestTutorialMock = vi.fn();
const tutorialPortalMock = vi.fn();

type TMockRequestShiftState = {
    bootstrapStatus: 'pending' | 'error' | 'success';
    dutyRequestList: Array<{wardReqShiftId: number}>;
    dutyRequestStatus: 'pending' | 'error' | 'success';
    editAvailability: {
        canEdit: boolean;
        status: 'editable' | 'lockedPast' | 'lockedFuture';
        validationMessage: null | string;
        badgeLabel: string;
        periodLabel: string;
        description: string;
    };
    requestShift: null | {shiftId: number};
    shiftStatus: 'pending' | 'error' | 'success';
    shiftTeamsStatus: 'pending' | 'error' | 'success';
    shiftTeams: Array<{name: string; shiftTeamId: number}>;
};

let tutorialStoreState = {
    showRequestTutorial: true,
};
let requestShiftState: TMockRequestShiftState = createRequestShiftState();

vi.mock('@/features/tutorial/model/store', () => ({
    useTutorialStore: (selector: (state: typeof tutorialStoreState) => unknown) => selector(tutorialStoreState),
}));

vi.mock('@/features/tutorial', () => ({
    default: () => ({
        setRequestTutorial: setRequestTutorialMock,
    }),
}));

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {accountId: 1},
        actions: {},
    }),
}));

vi.mock('@/features/request-shift', () => ({
    default: () => ({
        state: requestShiftState,
        actions: {},
    }),
}));

vi.mock('../TutorialPortal', () => ({
    TutorialPortal: ({open, config, closeCallback}: {closeCallback: () => void; config: ITutorialConfig; open: boolean}) => {
        tutorialPortalMock({open, config, closeCallback});

        return <div data-testid="tutorial-portal" data-open={String(open)} data-step-count={String(config.steps.length)} />;
    },
}));

function createRequestShiftState(overrides: Partial<TMockRequestShiftState> = {}): TMockRequestShiftState {
    return {
        bootstrapStatus: 'success',
        dutyRequestList: [{wardReqShiftId: 1}],
        dutyRequestStatus: 'success',
        editAvailability: {
            canEdit: true,
            status: 'editable',
            validationMessage: null,
            badgeLabel: '수정 가능',
            periodLabel: '수정 가능 범위',
            description: '현재 달력 범위에서 신청 근무를 수정할 수 있어요.',
        },
        requestShift: {shiftId: 1},
        shiftStatus: 'success',
        shiftTeamsStatus: 'success',
        shiftTeams: [{shiftTeamId: 1, name: 'A팀'}],
        ...overrides,
    };
}

describe('RequestTutorial', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('ko');
        tutorialStoreState = {showRequestTutorial: true};
        requestShiftState = createRequestShiftState();
        setRequestTutorialMock.mockReset();
        tutorialPortalMock.mockReset();
        localStorage.clear();
    });

    it('starts only after the editable request shift screen is ready', () => {
        render(<RequestTutorial />);

        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'true');
        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-step-count', '2');
    });

    it('does not start on readonly or not-yet-loaded request states', () => {
        requestShiftState = createRequestShiftState({
            editAvailability: {
                ...createRequestShiftState().editAvailability,
                canEdit: false,
                status: 'lockedPast',
            },
        });

        const {rerender} = render(<RequestTutorial />);

        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'false');

        requestShiftState = createRequestShiftState({
            requestShift: null,
            shiftStatus: 'pending',
        });

        rerender(<RequestTutorial />);

        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-open', 'false');
    });

    it('shows right-side nurse request list guidance first, then pending-only guidance', () => {
        render(<RequestTutorial />);

        const lastCall = tutorialPortalMock.mock.lastCall?.[0] as {config: ITutorialConfig};
        const highlightIds = lastCall.config.steps.flatMap((step) => step.highlightIds);

        expect(lastCall.config.steps.map((step) => step.highlightIds)).toEqual([['nurse_request_list'], ['nurse_request_pending_toggle']]);
        expect(highlightIds).toEqual(['nurse_request_list', 'nurse_request_pending_toggle']);
        expect(lastCall.config.steps[0]?.ctaText).toBeUndefined();
    });

    it('skips the pending-toggle step when there is no request item', () => {
        requestShiftState = createRequestShiftState({
            dutyRequestList: [],
        });

        render(<RequestTutorial />);

        const lastCall = tutorialPortalMock.mock.lastCall?.[0] as {config: ITutorialConfig};
        const highlightIds = lastCall.config.steps.flatMap((step) => step.highlightIds);

        expect(screen.getByTestId('tutorial-portal')).toHaveAttribute('data-step-count', '1');
        expect(lastCall.config.steps.map((step) => step.highlightIds)).toEqual([['nurse_request_list']]);
        expect(highlightIds).toEqual(['nurse_request_list']);
    });
});
