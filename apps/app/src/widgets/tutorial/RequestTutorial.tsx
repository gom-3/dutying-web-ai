import {useMemo} from 'react';
import useAuth from '@/features/auth';
import useRequestShift from '@/features/request-shift';
import useTutorialUseCase from '@/features/tutorial';
import {useTutorialStore} from '@/features/tutorial/model/store';
import {useTutorialDismissPersistence} from '@/features/tutorial/model/use-tutorial-dismiss-persistence';
import {type ITutorialConfig} from './tutorial.types';
import {TutorialPortal} from './TutorialPortal';

const RequestTutorial = () => {
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
                    title: '오른쪽에서 신청근무를 확인해요',
                    info: '간호사들이 신청한 근무를 여기서 한 번에 볼 수 있어요.',
                    infoBoxAlignment: 'right',
                },
                ...(shouldShowPendingToggleStep
                    ? [
                          {
                              highlightIds: ['nurse_request_pending_toggle'],
                              title: '대기 신청만 모아 볼 수 있어요',
                              info: '남은 대기를 여기서 한 번에 볼 수 있어요.',
                              infoBoxAlignment: 'right' as const,
                          },
                      ]
                    : []),
            ],
            infoBoxHeight: 150,
            infoBoxMargin: 20,
            scrollLock: true,
        }),
        [shouldShowPendingToggleStep],
    );

    return <TutorialPortal open={showRequestTutorial && canStartRequestTutorial} config={config} closeCallback={onTutorialClose} />;
};

export default RequestTutorial;
