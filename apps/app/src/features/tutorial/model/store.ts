import {createStore} from '@/shared/util/create-store';

const initialState = {
    showMakeTutorial: true,
    showRequestTutorial: true,
    showMemberTutorial: true,
    showBoardTutorial: true,
    showBoardListTutorial: true,
    showBoardComposerTutorial: true,
    showBoardDetailTutorial: true,
};

export const useTutorialStore = createStore(initialState, {
    name: 'useTutorialStore',
    actions: ({set, reset}) => ({
        resetTutorial: reset,
        setMakeTutorial: (showMakeTutorial: boolean) => set('showMakeTutorial', showMakeTutorial),
        setRequestTutorial: (showRequestTutorial: boolean) => set('showRequestTutorial', showRequestTutorial),
        setMemberTutorial: (showMemberTutorial: boolean) => set('showMemberTutorial', showMemberTutorial),
        setBoardTutorial: (showBoardTutorial: boolean) => set('showBoardTutorial', showBoardTutorial),
        setBoardListTutorial: (showBoardListTutorial: boolean) => set('showBoardListTutorial', showBoardListTutorial),
        setBoardComposerTutorial: (showBoardComposerTutorial: boolean) => set('showBoardComposerTutorial', showBoardComposerTutorial),
        setBoardDetailTutorial: (showBoardDetailTutorial: boolean) => set('showBoardDetailTutorial', showBoardDetailTutorial),
    }),
});
