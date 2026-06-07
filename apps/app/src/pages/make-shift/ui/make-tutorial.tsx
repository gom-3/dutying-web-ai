import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {type TTutorialKey} from '@dutying/api/account';
import useAuth from '@/features/auth';
import {isTutorialDismissedForAccount, setTutorialDismissedForAccount} from '@/features/tutorial/model/tutorial-dismiss-storage';
import {useTutorialStore} from '@/features/tutorial/model/store';
import {AccountAPI} from '@/shared/api';
import {type ITutorialConfig} from '@/widgets/tutorial/tutorial.types';
import {TutorialPortal} from '@/widgets/tutorial/TutorialPortal';
import {type TMakeShiftStep, useMakeShiftStore} from '../model/make-shift-store';

const EMPTY_TUTORIAL_CONFIG: ITutorialConfig = {
    steps: [],
};

const makeTutorialConfigByStep: Partial<Record<TMakeShiftStep, ITutorialConfig>> = {
    1: {
        steps: [
            {
                highlightIds: ['make_stepper'],
                title: '근무표 만들기',
                info: '진행선을 보면서 5단계를 차례대로 진행해요.',
                infoBoxAlignment: 'center',
            },
        ],
        infoBoxHeight: 150,
        infoBoxMargin: 24,
        scrollLock: true,
    },
    2: {
        steps: [
            {
                highlightIds: ['make_constraint_add_button'],
                title: '제약조건 추가하기',
                info: '권장 제약조건 7개 외에도 필요한 조건을 추가할 수 있어요.\n조건이 많을수록 배정이 어려워질 수 있어요.',
                infoBoxAlignment: 'right',
            },
        ],
        infoBoxHeight: 150,
        infoBoxMargin: 24,
        scrollLock: true,
    },
    3: {
        steps: [
            {
                highlightIds: ['nurse_request_pending_toggle'],
                title: '신청 근무 확정하기',
                info: '남아 있는 신청근무 요청을 확인해요.\n대기만 보기를 켜면 아직 처리하지 않은 요청만 볼 수 있어요.',
                infoBoxAlignment: 'right',
            },
        ],
        infoBoxHeight: 150,
        infoBoxMargin: 24,
        scrollLock: true,
    },
    4: {
        steps: [
            {
                highlightIds: ['make_fixed_shift_sample_cell'],
                title: '고정 근무 입력하기',
                info: '셀을 선택하고 키보드로 근무 약자를 입력해요.\nD, E, N, O처럼 병동에서 쓰는 약자를 누르면 바로 반영돼요.',
                infoBoxAlignment: 'right',
            },
        ],
        infoBoxHeight: 150,
        infoBoxMargin: 24,
        scrollLock: true,
    },
    5: {
        steps: [
            {
                highlightIds: ['make_ai_fill_button'],
                title: 'AI 자동 채우기',
                info: 'AI 자동 채우기를 여러 번 실행해 원하는 근무표에 빠르게 가까워질 수 있어요.\n결과는 관리자가 한 번 더 확인하고 수정해 주세요.',
                infoBoxAlignment: 'right',
            },
            {
                highlightIds: ['make_ai_view_tools', 'make_ai_history_undo_redo_tools', 'make_ai_history_snapshot_tools'],
                title: '보조 도구 활용하기',
                info: '보기 옵션과 되돌리기·다시 실행을 활용해 근무표를 더 쉽게 다듬어 보세요.',
                infoBoxAlignment: 'right',
            },
        ],
        infoBoxHeight: 150,
        infoBoxMargin: 24,
        scrollLock: true,
    },
};

function getHighlightIds(config: ITutorialConfig | undefined) {
    return [...new Set(config?.steps.flatMap((step) => step.highlightIds) ?? [])];
}

function getMakeStepTutorialKey(step: TMakeShiftStep): TTutorialKey | null {
    if (step < 1 || step > 5) return null;

    return `make-step-${step}` as TTutorialKey;
}

const MakeTutorial = () => {
    const showMakeTutorial = useTutorialStore((state) => state.showMakeTutorial);
    const phase = useMakeShiftStore((state) => state.phase);
    const currentStep = useMakeShiftStore((state) => state.currentStep);
    const markedSeenKeysRef = useRef<Set<TTutorialKey>>(new Set());
    const [completedSteps, setCompletedSteps] = useState<Set<TMakeShiftStep>>(() => new Set());
    const [targetsReady, setTargetsReady] = useState(false);
    const {
        state: {accountId, accountMe},
    } = useAuth();
    const config = useMemo(() => makeTutorialConfigByStep[currentStep], [currentStep]);
    const currentTutorialKey = getMakeStepTutorialKey(currentStep);
    const backendCurrentStepSeen = currentTutorialKey != null && (accountMe?.tutorials?.seen?.includes(currentTutorialKey) ?? false);
    const localCurrentStepSeen = accountId != null && currentTutorialKey != null && isTutorialDismissedForAccount(currentTutorialKey, accountId);
    const currentStepSeen = backendCurrentStepSeen || localCurrentStepSeen;
    const openCandidate =
        showMakeTutorial &&
        phase === 'stepping' &&
        config !== undefined &&
        currentTutorialKey !== null &&
        !completedSteps.has(currentStep) &&
        !currentStepSeen;
    const open = openCandidate && targetsReady;
    const closeCurrentTutorial = useCallback(() => {
        setCompletedSteps((prev) => new Set(prev).add(currentStep));

        if (accountId != null && currentTutorialKey != null) {
            setTutorialDismissedForAccount(currentTutorialKey, accountId);
        }
    }, [accountId, currentStep, currentTutorialKey]);

    useEffect(() => {
        if (!open) return;

        if (accountId == null || currentTutorialKey == null) return;

        setTutorialDismissedForAccount(currentTutorialKey, accountId);

        if (markedSeenKeysRef.current.has(currentTutorialKey)) return;

        markedSeenKeysRef.current.add(currentTutorialKey);
        void AccountAPI.markTutorialSeen(currentTutorialKey).catch(() => undefined);
    }, [accountId, currentTutorialKey, open]);

    useEffect(() => {
        setTargetsReady(false);

        if (!openCandidate) return;

        const highlightIds = getHighlightIds(config);
        const isReady = () => highlightIds.length > 0 && highlightIds.every((id) => document.getElementById(id));

        if (isReady()) {
            setTargetsReady(true);

            return;
        }

        const interval = window.setInterval(() => {
            if (!isReady()) return;

            setTargetsReady(true);
            window.clearInterval(interval);
        }, 150);

        return () => window.clearInterval(interval);
    }, [config, openCandidate]);

    return (
        <TutorialPortal
            open={open}
            config={config ?? EMPTY_TUTORIAL_CONFIG}
            closeCallback={closeCurrentTutorial}
            initialStepIndex={0}
        />
    );
};

export default MakeTutorial;
