import {useEffect, useMemo, useRef} from 'react';
import useAuth from '@/features/auth';
import useEditShiftTeam from '@/features/edit-shift-team';
import useTutorialUseCase from '@/features/tutorial';
import {useTutorialStore} from '@/features/tutorial/model/store';
import {useTutorialDismissPersistence} from '@/features/tutorial/model/use-tutorial-dismiss-persistence';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {type ITutorialConfig} from './tutorial.types';
import {TutorialPortal} from './TutorialPortal';

function scrollTutorialTargetIntoView(id: string) {
    if (typeof document === 'undefined') return;

    document.getElementById(id)?.scrollIntoView({block: 'center', inline: 'nearest'});
}

const MemberTutorial = () => {
    const {t} = useTypedTranslation();
    const showMemberTutorial = useTutorialStore((state) => state.showMemberTutorial);
    const {setMemberTutorial} = useTutorialUseCase();
    const {
        state: {accountId},
    } = useAuth();
    const onTutorialClose = useTutorialDismissPersistence('member', accountId, setMemberTutorial);
    const {
        state: {shiftTeams},
        actions: {selectNurse},
    } = useEditShiftTeam();
    const firstNurseId = shiftTeams?.flatMap((shiftTeam) => shiftTeam.nurses).find((nurse) => typeof nurse.nurseId === 'number')?.nurseId;
    const isTutorialReady = shiftTeams !== undefined;
    const selectNurseRef = useRef(selectNurse);

    useEffect(() => {
        selectNurseRef.current = selectNurse;
    }, [selectNurse]);

    const config = useMemo<ITutorialConfig>(() => {
        const steps: ITutorialConfig['steps'] = [
            {
                highlightIds: ['shift_team_list'],
                title: t('page.member.tutorial.team.title'),
                info: t('page.member.tutorial.team.info'),
                infoBoxAlignment: 'left',
                onNextStep: () => {
                    scrollTutorialTargetIntoView('member_add_nurse_button');
                },
            },
            {
                highlightIds: ['member_add_nurse_button'],
                title: t('page.member.tutorial.add.title'),
                info: t('page.member.tutorial.add.info'),
                infoBoxAlignment: 'right',
                onPrevStep: () => {
                    selectNurseRef.current(null);
                    scrollTutorialTargetIntoView('shift_team_list');
                },
                onNextStep: () => {
                    scrollTutorialTargetIntoView('nurse_sample');

                    if (typeof firstNurseId === 'number') {
                        selectNurseRef.current(firstNurseId);
                    }
                },
            },
        ];

        if (typeof firstNurseId === 'number') {
            steps.push({
                highlightIds: ['nurse_sample', 'nurse_edit_drawer'],
                title: t('page.member.tutorial.edit.title'),
                info: t('page.member.tutorial.edit.info'),
                infoBoxAlignment: 'right',
                onPrevStep: () => {
                    selectNurseRef.current(null);
                    scrollTutorialTargetIntoView('member_add_nurse_button');
                },
                onNextStep: () => {
                    selectNurseRef.current(null);
                },
            });
        }

        return {
            steps,
            infoBoxHeight: 150,
            infoBoxMargin: 20,
            scrollLock: true,
        };
    }, [firstNurseId, t]);

    useEffect(() => {
        if (showMemberTutorial) {
            selectNurseRef.current(null);
        }
    }, [showMemberTutorial]);

    return <TutorialPortal open={showMemberTutorial && isTutorialReady} config={config} closeCallback={onTutorialClose} />;
};

export default MemberTutorial;
