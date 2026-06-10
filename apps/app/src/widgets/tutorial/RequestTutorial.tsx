import {useMemo} from 'react';
import useAuth from '@/features/auth';
import useRequestShift from '@/features/request-shift';
import useTutorialUseCase from '@/features/tutorial';
import {useTutorialStore} from '@/features/tutorial/model/store';
import {useTutorialDismissPersistence} from '@/features/tutorial/model/use-tutorial-dismiss-persistence';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {type ITutorialConfig} from './tutorial.types';
import {TutorialPortal} from './TutorialPortal';

const RequestTutorial = () => {
    const {t} = useTypedTranslation();
    const showRequestTutorial = useTutorialStore((state) => state.showRequestTutorial);
    const {setRequestTutorial} = useTutorialUseCase();
    const {
        state: {accountId},
    } = useAuth();
    const onTutorialClose = useTutorialDismissPersistence('request', accountId, setRequestTutorial);
    const {
        state: {
            bootstrapStatus,
            dutyRequestList,
            dutyRequestStatus,
            editAvailability,
            requestShift,
            shiftStatus,
            shiftTeamsStatus,
            shiftTeams,
        },
    } = useRequestShift();
    const canStartRequestTutorial =
        bootstrapStatus === 'success' &&
        shiftTeamsStatus === 'success' &&
        shiftStatus === 'success' &&
        dutyRequestStatus === 'success' &&
        editAvailability.canEdit &&
        Boolean(requestShift) &&
        (shiftTeams?.length ?? 0) > 0;
    const shouldShowPendingToggleStep = (dutyRequestList?.length ?? 0) > 0;
    const config = useMemo<ITutorialConfig>(
        () => ({
            steps: [
                {
                    highlightIds: ['nurse_request_list'],
                    title: t('widget.requestTutorial.listTitle'),
                    info: t('widget.requestTutorial.listInfo'),
                    infoBoxAlignment: 'right',
                },
                ...(shouldShowPendingToggleStep
                    ? [
                          {
                              highlightIds: ['nurse_request_pending_toggle'],
                              title: t('widget.requestTutorial.pendingTitle'),
                              info: t('widget.requestTutorial.pendingInfo'),
                              infoBoxAlignment: 'right' as const,
                          },
                      ]
                    : []),
            ],
            infoBoxHeight: 150,
            infoBoxMargin: 20,
            scrollLock: true,
        }),
        [shouldShowPendingToggleStep, t],
    );

    return <TutorialPortal open={showRequestTutorial && canStartRequestTutorial} config={config} closeCallback={onTutorialClose} />;
};

export default RequestTutorial;
