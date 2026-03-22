import {useEffect} from 'react';
import {createPortal} from 'react-dom';
import useRequestShift from '@/features/shift/useRequestShift';
import {useRequestShiftStore} from '@/features/shift/useRequestShift/store';
import useTutorialUseCase from '@/features/ui/useTutorial';
import {useTutorialStore} from '@/features/ui/useTutorial/store';
import {RUNTIME_CONFIG} from '@/shared/config/runtime';
import {type IStepConfig, type IStepsConfig, TutorialOverlay} from './TutorialOverlay';

const RequestTutorial = () => {
    const showRequestTutorial = useTutorialStore((state) => state.showRequestTutorial);
    const {setRequestTutorial} = useTutorialUseCase();
    const {
        actions: {toggleEditMode},
    } = useRequestShift();
    const {setState} = useRequestShiftStore();
    const config: IStepsConfig = {
        steps: new Map<number, IStepConfig>(),
        infoBoxHeight: 150,
        infoBoxMargin: 20,
        scrollLock: true,
    };

    config.steps.set(1, {
        highlightIds: ['toolbar'],
        title: '신청근무 작성하기',
        info: '이곳은 툴바입니다. 신청근무 작성에 도움이 되는 여러 설정을 변경할 수 있어요',
        infoBoxAlignment: 'left',
    });

    config.steps.set(2, {
        highlightIds: ['calendar'],
        title: '신청근무 작성하기',
        info: '이곳은 신청 근무표입니다. 툴바의 "수정하기" 버튼을 누른 후 셀을 클릭하여 신청 근무를 작성할 수 있어요',
        infoBoxAlignment: 'left',
    });

    config.steps.set(3, {
        highlightIds: ['nurse_request_list'],
        title: '신청근무 작성하기',
        info: '이곳에서는 연동된 간호사의 신청 근무를 볼 수 있어요',
        infoBoxAlignment: 'right',
    });

    config.steps.set(4, {
        highlightIds: ['editButton'],
        title: '신청근무 작성하기',
        info: '수정하기 버튼을 눌러서 신청 근무표를 만들 수 있어요',
        infoBoxAlignment: 'right',
        onNextStep: toggleEditMode,
    });

    config.steps.set(5, {
        highlightIds: ['cell_sample'],
        title: '신청근무 작성하기',
        info: '셀을 클릭하시고 D E N O를 입력하시면 신청근무를 작성하실 수 있어요! \n더 자세한 가이드는 메뉴얼 문서를 참고해주세요!',
        infoBoxAlignment: 'center',
        onPrevStep: toggleEditMode,
        ctaText: '메뉴얼 보러가기',
        ctaUrl: RUNTIME_CONFIG.docs.requestTutorial,
    });

    useEffect(() => {
        if (showRequestTutorial) {
            setState('readonly', true);
        }
    }, [showRequestTutorial]);

    return (
        showRequestTutorial &&
        createPortal(
            <TutorialOverlay config={config} closeCallback={() => setRequestTutorial(false)} />,
            document.getElementById('tutorial')!,
        )
    );
};

export default RequestTutorial;
