import {useCallback} from 'react';
import {useTutorialStore} from './model/store';

const useTutorialUseCase = () => {
    const initTutorial = useTutorialStore((state) => state.resetTutorial);
    const setMakeTutorial = useTutorialStore((state) => state.setMakeTutorial);
    const setMemberTutorial = useTutorialStore((state) => state.setMemberTutorial);
    const setRequestTutorial = useTutorialStore((state) => state.setRequestTutorial);

    return {
        initTutorial: useCallback(() => initTutorial(), [initTutorial]),
        setMakeTutorial: useCallback((showMakeTutorial: boolean) => setMakeTutorial(showMakeTutorial), [setMakeTutorial]),
        setMemberTutorial: useCallback((showMemberTutorial: boolean) => setMemberTutorial(showMemberTutorial), [setMemberTutorial]),
        setRequestTutorial: useCallback((showRequestTutorial: boolean) => setRequestTutorial(showRequestTutorial), [setRequestTutorial]),
    };
};

export default useTutorialUseCase;
