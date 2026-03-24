import {useMemo} from 'react';
import useTutorialUseCase from '@/features/ui/useTutorial';
import {useTutorialStore} from '@/features/ui/useTutorial/store';
import {RUNTIME_CONFIG} from '@/shared/config/runtime';
import {type ITutorialConfig} from '@/widgets/tutorial/tutorial.types';
import {TutorialPortal} from '@/widgets/tutorial/TutorialPortal';
import {useMakeShiftStore} from '../model/make-shift-store';
import {useMakeShiftUseCase} from '../model/make-shift-use-case';

const MakeTutorial = () => {
    const showMakeTutorial = useTutorialStore((state) => state.showMakeTutorial);
    const phase = useMakeShiftStore((state) => state.phase);
    const currentStep = useMakeShiftStore((state) => state.currentStep);
    const useCase = useMakeShiftUseCase();
    const {setMakeTutorial} = useTutorialUseCase();
    const initialStepIndex = currentStep === 1 ? 0 : currentStep;
    const config = useMemo<ITutorialConfig>(
        () => ({
            steps: [
                {
                    highlightIds: ['make_stepper'],
                    title: '근무표 만들기',
                    info: '근무표 작성은 5단계로 나뉘어 진행됩니다. 현재 위치를 보면서 이전 단계로 돌아가 수정할 수 있어요.',
                    infoBoxAlignment: 'center',
                },
                {
                    highlightIds: ['make_workers_step'],
                    title: '근무표 만들기',
                    info: '먼저 실제 근무에 투입할 간호사 순서를 확인해 주세요. 드래그로 순서를 정리하고 레벨 순 정렬도 할 수 있어요.',
                    infoBoxAlignment: 'right',
                    onNextStep: useCase.next,
                },
                {
                    highlightIds: ['make_constraints_step'],
                    title: '근무표 만들기',
                    info: '다음은 제약 조건을 점검하는 단계입니다. 중요한 규칙 순서를 조정하고 필요한 값도 함께 바꿀 수 있어요.',
                    infoBoxAlignment: 'right',
                    onPrevStep: useCase.prev,
                    onNextStep: useCase.next,
                },
                {
                    highlightIds: ['make_requests_step', 'make_requests_decision_panel'],
                    title: '근무표 만들기',
                    info: '신청 근무를 보면서 수락, 보류, 거절을 정리해 주세요. 오른쪽 패널에서 빠르게 상태를 바꿀 수 있어요.',
                    infoBoxAlignment: 'right',
                    onPrevStep: useCase.prev,
                    onNextStep: useCase.next,
                },
                {
                    highlightIds: ['make_fixed_shifts_step', 'count_by_day'],
                    title: '근무표 만들기',
                    info: '고정 근무를 직접 배치하는 단계입니다. 달력에서 셀을 선택해 근무를 입력하고 하단 집계로 채움 상태를 확인할 수 있어요.',
                    infoBoxAlignment: 'right',
                    onPrevStep: useCase.prev,
                    onNextStep: useCase.next,
                },
                {
                    highlightIds: ['make_ai_autofill_actions', 'make_ai_autofill_status'],
                    title: '근무표 만들기',
                    info: '마지막으로 AI 자동 채우기 결과를 검토하고 저장합니다. 저장 전 상태 카드에서 수정 여부와 오류를 다시 확인해 주세요.',
                    infoBoxAlignment: 'right',
                    onPrevStep: useCase.prev,
                    ctaText: '메뉴얼 보러가기',
                    ctaUrl: RUNTIME_CONFIG.docs.makeTutorial,
                },
            ],
            infoBoxHeight: 160,
            infoBoxMargin: 24,
            scrollLock: true,
        }),
        [useCase.next, useCase.prev],
    );

    return (
        <TutorialPortal
            open={showMakeTutorial && phase === 'stepping'}
            config={config}
            closeCallback={() => setMakeTutorial(false)}
            initialStepIndex={initialStepIndex}
        />
    );
};

export default MakeTutorial;
