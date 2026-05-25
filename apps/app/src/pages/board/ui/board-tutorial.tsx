import {useMemo} from 'react';
import useTutorialUseCase from '@/features/tutorial';
import {useTutorialStore} from '@/features/tutorial/model/store';
import {useTutorialDismissPersistence} from '@/features/tutorial/model/use-tutorial-dismiss-persistence';
import {type ITutorialConfig} from '@/widgets/tutorial/tutorial.types';
import {TutorialPortal} from '@/widgets/tutorial/TutorialPortal';

export type TBoardTutorialMode = 'list' | 'composer' | 'detail';

type TBoardTutorialProps = {
    accountId: number | null;
    canStart: boolean;
    mode: TBoardTutorialMode;
};

export function BoardTutorial({accountId, canStart, mode}: TBoardTutorialProps) {
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
                            title: '게시글 목록을 볼 수 있어요',
                            info: '글을 누르면 자세한 내용을 볼 수 있어요.',
                            infoBoxAlignment: 'right',
                        },
                        {
                            highlightIds: ['board_create_button'],
                            title: '새 글은 여기서 작성해요',
                            info: '작성한 글은 병동 구성원 모두가 볼 수 있어요.\n병동 인원과 공유할 내용을 적어 보세요.',
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
                            title: '마감일을 지정할 수 있어요',
                            info: '마감일을 정하면 듀팅 앱과 병동 캘린더에 표시돼요.\n병동 인원과 공유할 일정에 사용해 보세요.',
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
                            title: '체크와 댓글로 확인을 관리해요',
                            info: '간호사들이 확인하면 체크로 바로 남아요.\n요청이나 변경 내용은 댓글로 받으면 돼요.',
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
