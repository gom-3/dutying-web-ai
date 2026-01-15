import {useCallback} from 'react';
import {useTutorialStore} from './store';

const useTutorialUseCase = () => {
    const setState = useTutorialStore((state) => state.setState);
    const initState = useTutorialStore((state) => state.initState);

    const setMakeTutorial = useCallback(
        (showMakeTutorial: boolean) => setState('showMakeTutorial', showMakeTutorial),
        [setState],
    );
    const setMemberTutorial = useCallback(
        (showMemberTutorial: boolean) => setState('showMemberTutorial', showMemberTutorial),
        [setState],
    );
    const setRequestTutorial = useCallback(
        (showRequestTutorial: boolean) => setState('showRequestTutorial', showRequestTutorial),
        [setState],
    );

    return {
        initTutorial: initState,
        setMakeTutorial,
        setMemberTutorial,
        setRequestTutorial,
    };
};

export default useTutorialUseCase;
