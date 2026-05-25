import {useTutorialStore} from './model/store';

const useTutorialUseCase = () => {
    const initTutorial = useTutorialStore((state) => state.resetTutorial);
    const setMakeTutorial = useTutorialStore((state) => state.setMakeTutorial);
    const setMemberTutorial = useTutorialStore((state) => state.setMemberTutorial);
    const setRequestTutorial = useTutorialStore((state) => state.setRequestTutorial);
    const setBoardTutorial = useTutorialStore((state) => state.setBoardTutorial);
    const setBoardListTutorial = useTutorialStore((state) => state.setBoardListTutorial);
    const setBoardComposerTutorial = useTutorialStore((state) => state.setBoardComposerTutorial);
    const setBoardDetailTutorial = useTutorialStore((state) => state.setBoardDetailTutorial);

    return {
        initTutorial,
        setMakeTutorial,
        setMemberTutorial,
        setRequestTutorial,
        setBoardTutorial,
        setBoardListTutorial,
        setBoardComposerTutorial,
        setBoardDetailTutorial,
    };
};

export default useTutorialUseCase;
