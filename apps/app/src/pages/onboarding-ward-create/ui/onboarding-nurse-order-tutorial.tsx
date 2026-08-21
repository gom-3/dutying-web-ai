import {useCallback, useEffect, useMemo, useState} from 'react';
import useAuth from '@/features/auth';
import {isTutorialDismissedForAccount, setTutorialDismissedForAccount} from '@/features/tutorial/model/tutorial-dismiss-storage';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {type ITutorialConfig} from '@/widgets/tutorial/tutorial.types';
import {TutorialPortal} from '@/widgets/tutorial/TutorialPortal';

const ONBOARDING_NURSE_ORDER_TUTORIAL_KEY = 'onboarding-nurse-order';
const HIGHLIGHT_IDS = ['onboarding_nurse_order_sample', 'onboarding_nurse_order_handle'];

type TOnboardingNurseOrderTutorialProps = {
    canStart: boolean;
};

function areTutorialTargetsReady() {
    return HIGHLIGHT_IDS.every((id) => document.getElementById(id));
}

function OnboardingNurseOrderTutorial({canStart}: TOnboardingNurseOrderTutorialProps) {
    const {t} = useTypedTranslation();
    const {
        state: {accountId, accountMe},
    } = useAuth();
    const resolvedAccountId = accountId ?? accountMe?.accountId ?? null;
    const [showTutorial, setShowTutorial] = useState(true);
    const [localDismissed, setLocalDismissed] = useState(false);
    const [targetsReady, setTargetsReady] = useState(false);
    const backendSeen = accountMe?.tutorials?.seen?.includes(ONBOARDING_NURSE_ORDER_TUTORIAL_KEY) ?? false;
    const openCandidate = canStart && showTutorial && !backendSeen && !localDismissed;
    const open = openCandidate && targetsReady;
    const config = useMemo<ITutorialConfig>(
        () => ({
            steps: [
                {
                    highlightIds: HIGHLIGHT_IDS,
                    title: t('page.onboardingWardCreate.nurse.tutorial.order.title'),
                    info: t('page.onboardingWardCreate.nurse.tutorial.order.info'),
                    infoBoxAlignment: 'left',
                },
            ],
            highLightPadding: 6,
            infoBoxHeight: 150,
            infoBoxWidth: 480,
            infoBoxMargin: 20,
            scrollLock: true,
        }),
        [t],
    );
    const closeTutorial = useCallback(() => {
        setShowTutorial(false);
        setLocalDismissed(true);

        if (resolvedAccountId != null) {
            setTutorialDismissedForAccount(ONBOARDING_NURSE_ORDER_TUTORIAL_KEY, resolvedAccountId);
        }
    }, [resolvedAccountId]);

    useEffect(() => {
        if (resolvedAccountId == null) {
            setLocalDismissed(false);

            return;
        }

        setLocalDismissed(isTutorialDismissedForAccount(ONBOARDING_NURSE_ORDER_TUTORIAL_KEY, resolvedAccountId));
    }, [resolvedAccountId]);

    useEffect(() => {
        setTargetsReady(false);

        if (!openCandidate) return;

        if (areTutorialTargetsReady()) {
            setTargetsReady(true);

            return;
        }

        const interval = window.setInterval(() => {
            if (!areTutorialTargetsReady()) return;

            setTargetsReady(true);
            window.clearInterval(interval);
        }, 150);

        return () => window.clearInterval(interval);
    }, [openCandidate]);

    useEffect(() => {
        if (!open || resolvedAccountId == null) return;

        setTutorialDismissedForAccount(ONBOARDING_NURSE_ORDER_TUTORIAL_KEY, resolvedAccountId);
    }, [open, resolvedAccountId]);

    return <TutorialPortal open={open} config={config} closeCallback={closeTutorial} initialStepIndex={0} />;
}

export default OnboardingNurseOrderTutorial;
