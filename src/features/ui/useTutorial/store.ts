import {createStore} from '@/shared/util/create-store';

const initialState = {
    showMakeTutorial: true,
    showRequestTutorial: true,
    showMemberTutorial: true,
};

export const useTutorialStore = createStore(initialState, {
    name: 'useTutorialStore',
});
