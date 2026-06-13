import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {type TTutorialKey} from '@dutying/api/account';
import useAuth from '@/features/auth';
import {isTutorialDismissedForAccount, setTutorialDismissedForAccount} from '@/features/tutorial/model/tutorial-dismiss-storage';
import {useTutorialStore} from '@/features/tutorial/model/store';
import {AccountAPI} from '@/shared/api';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {type ITutorialConfig} from '@/widgets/tutorial/tutorial.types';
import {TutorialPortal} from '@/widgets/tutorial/TutorialPortal';
import {type TMakeShiftStep, useMakeShiftStore} from '../model/make-shift-store';

const EMPTY_TUTORIAL_CONFIG: ITutorialConfig = {
    steps: [],
};

type TTypedT = ReturnType<typeof useTypedTranslation>['t'];

const createMakeTutorialConfigByStep = (t: TTypedT): Partial<Record<TMakeShiftStep, ITutorialConfig>> => ({
    1: {
        steps: [
            {
                highlightIds: ['make_stepper'],
                title: t('page.makeShift.tutorial.stepper.title'),
                info: t('page.makeShift.tutorial.stepper.info'),
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
                title: t('page.makeShift.tutorial.constraints.title'),
                info: t('page.makeShift.tutorial.constraints.info'),
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
                title: t('page.makeShift.tutorial.requests.title'),
                info: t('page.makeShift.tutorial.requests.info'),
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
                title: t('page.makeShift.tutorial.fixedShifts.title'),
                info: t('page.makeShift.tutorial.fixedShifts.info'),
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
                title: t('page.makeShift.tutorial.aiAutofill.title'),
                info: t('page.makeShift.tutorial.aiAutofill.info'),
                infoBoxAlignment: 'right',
            },
            {
                highlightIds: ['make_ai_view_tools', 'make_ai_history_undo_redo_tools', 'make_ai_history_snapshot_tools'],
                title: t('page.makeShift.tutorial.tools.title'),
                info: t('page.makeShift.tutorial.tools.info'),
                infoBoxAlignment: 'right',
            },
        ],
        infoBoxHeight: 150,
        infoBoxMargin: 24,
        scrollLock: true,
    },
});

function getHighlightIds(config: ITutorialConfig | undefined) {
    return [...new Set(config?.steps.flatMap((step) => step.highlightIds) ?? [])];
}

function getMakeStepTutorialKey(step: TMakeShiftStep): TTutorialKey | null {
    if (step < 1 || step > 5) return null;

    return `make-step-${step}` as TTutorialKey;
}

const MakeTutorial = () => {
    const {t} = useTypedTranslation();
    const showMakeTutorial = useTutorialStore((state) => state.showMakeTutorial);
    const phase = useMakeShiftStore((state) => state.phase);
    const currentStep = useMakeShiftStore((state) => state.currentStep);
    const markedSeenKeysRef = useRef<Set<TTutorialKey>>(new Set());
    const [completedSteps, setCompletedSteps] = useState<Set<TMakeShiftStep>>(() => new Set());
    const [targetsReady, setTargetsReady] = useState(false);
    const {
        state: {accountId, accountMe},
    } = useAuth();
    const config = useMemo(() => createMakeTutorialConfigByStep(t)[currentStep], [currentStep, t]);
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
