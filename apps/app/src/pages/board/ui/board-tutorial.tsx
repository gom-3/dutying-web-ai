import {useMemo} from 'react';
import useTutorialUseCase from '@/features/tutorial';
import {useTutorialStore} from '@/features/tutorial/model/store';
import {useTutorialDismissPersistence} from '@/features/tutorial/model/use-tutorial-dismiss-persistence';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {type ITutorialConfig} from '@/widgets/tutorial/tutorial.types';
import {TutorialPortal} from '@/widgets/tutorial/TutorialPortal';

export type TBoardTutorialMode = 'list' | 'composer' | 'detail';

type TBoardTutorialProps = {
    accountId: number | null;
    canStart: boolean;
    mode: TBoardTutorialMode;
};

export function BoardTutorial({accountId, canStart, mode}: TBoardTutorialProps) {
    const {t} = useTypedTranslation();
    const showBoardListTutorial = useTutorialStore((state) => state.showBoardListTutorial);
    const showBoardComposerTutorial = useTutorialStore((state) => state.showBoardComposerTutorial);
    const showBoardDetailTutorial = useTutorialStore((state) => state.showBoardDetailTutorial);
    const {setBoardListTutorial, setBoardComposerTutorial, setBoardDetailTutorial} = useTutorialUseCase();
    const onBoardListTutorialClose = useTutorialDismissPersistence('board-list', accountId, setBoardListTutorial);
    const onBoardComposerTutorialClose = useTutorialDismissPersistence('board-composer', accountId, setBoardComposerTutorial);
    const onBoardDetailTutorialClose = useTutorialDismissPersistence('board-detail', accountId, setBoardDetailTutorial);
    const tutorialByMode = useMemo<Record<TBoardTutorialMode, {config: ITutorialConfig; closeCallback: () => void; open: boolean}>>(
        () => ({
            list: {
                open: showBoardListTutorial,
                closeCallback: onBoardListTutorialClose,
                config: {
                    steps: [
                        {
                            highlightIds: ['board_post_list'],
                            title: t('page.board.tutorial.list.postsTitle'),
                            info: t('page.board.tutorial.list.postsInfo'),
                            infoBoxAlignment: 'right',
                        },
                        {
                            highlightIds: ['board_create_button'],
                            title: t('page.board.tutorial.list.createTitle'),
                            info: t('page.board.tutorial.list.createInfo'),
                            infoBoxAlignment: 'right',
                        },
                    ],
                    infoBoxHeight: 156,
                    infoBoxMargin: 24,
                    scrollLock: true,
                },
            },
            composer: {
                open: showBoardComposerTutorial,
                closeCallback: onBoardComposerTutorialClose,
                config: {
                    steps: [
                        {
                            highlightIds: ['board_composer_deadline_picker'],
                            title: t('page.board.tutorial.composer.deadlineTitle'),
                            info: t('page.board.tutorial.composer.deadlineInfo'),
                            infoBoxAlignment: 'left',
                        },
                    ],
                    infoBoxHeight: 156,
                    infoBoxMargin: 24,
                    scrollLock: true,
                },
            },
            detail: {
                open: showBoardDetailTutorial,
                closeCallback: onBoardDetailTutorialClose,
                config: {
                    steps: [
                        {
                            highlightIds: ['board_detail_panel'],
                            title: t('page.board.tutorial.detail.checkTitle'),
                            info: t('page.board.tutorial.detail.checkInfo'),
                            infoBoxAlignment: 'left',
                        },
                    ],
                    infoBoxHeight: 156,
                    infoBoxMargin: 24,
                    scrollLock: true,
                },
            },
        }),
        [
            onBoardComposerTutorialClose,
            onBoardDetailTutorialClose,
            onBoardListTutorialClose,
            showBoardComposerTutorial,
            showBoardDetailTutorial,
            showBoardListTutorial,
            t,
        ],
    );
    const currentTutorial = tutorialByMode[mode];

    return (
        <TutorialPortal
            open={currentTutorial.open && canStart}
            config={currentTutorial.config}
            closeCallback={currentTutorial.closeCallback}
        />
    );
}
