import {useEffect} from 'react';
import {createPortal} from 'react-dom';
import useTutorialUseCase from '@/features/ui/useTutorial';
import {useTutorialStore} from '@/features/ui/useTutorial/store';
import {type IStepConfig, type IStepsConfig, TutorialOverlay} from './TutorialOverlay';

const MakeTutorial = () => {
    const showMakeTutorial = useTutorialStore((state) => state.showMakeTutorial);
    const {setMakeTutorial} = useTutorialUseCase();
    const config: IStepsConfig = {
        steps: new Map<number, IStepConfig>(),
        infoBoxHeight: 150,
        infoBoxMargin: 20,
        scrollLock: true,
    };

    config.steps.set(1, {
        highlightIds: ['toolbar'],
        title: '근무표 만들기',
        info: '이곳은 툴바입니다. 근무표 작성에 도움이 되는 여러 설정을 변경할 수 있어요',
        infoBoxAlignment: 'left',
    });

    config.steps.set(2, {
        highlightIds: ['calendar'],
        title: '근무표 만들기',
        info: '이곳은 근무표입니다. 툴바의 "수정하기" 버튼을 누른 후 셀을 클릭하여 근무를 작성할 수 있어요',
        infoBoxAlignment: 'left',
    });

    config.steps.set(3, {
        highlightIds: ['count_by_day'],
        title: '근무표 만들기',
        info: '이곳은 날짜별 근무 수입니다. 날짜별로 각 근무가 얼마나 채워져있는지 볼 수 있어요',
        infoBoxAlignment: 'left',
    });

    config.steps.set(4, {
        highlightIds: ['count_by_nurse'],
        title: '근무표 만들기',
        info: '이곳은 간호사별 근무 수입니다. 간호사별로 근무가 얼마나 채워져있는지 볼 수 있어요. WO는 주말 OFF를 의미합니다.',
        infoBoxAlignment: 'right',
    });

    config.steps.set(5, {
        highlightIds: ['editButton'],
        title: '근무표 만들기',
        info: '수정하기 버튼을 눌러서 근무표를 만들 수 있어요',
        infoBoxAlignment: 'center',
        // 편집 모드 전환은 페이지(store) 책임. 튜토리얼은 DI 밖에서도 렌더될 수 있어 직접 접근하지 않는다.
    });

    config.steps.set(6, {
        highlightIds: ['cell_sample'],
        title: '근무표 만들기',
        info: '셀을 클릭하시고 D E N O를 입력하시면 근무를 작성하실 수 있어요! \n더 자세한 가이드는 메뉴얼 문서를 참고해주세요!',
        infoBoxAlignment: 'center',
        ctaText: '메뉴얼 보러가기',
        ctaUrl: 'https://gom3.notion.site/68d3ad01e68d4d6a8b4cb8c2409353a3?pvs=4',
    });

    useEffect(() => {
        // no-op
    }, [showMakeTutorial]);

    return (
        showMakeTutorial &&
        createPortal(<TutorialOverlay config={config} closeCallback={() => setMakeTutorial(false)} />, document.getElementById('tutorial')!)
    );
};

export default MakeTutorial;
