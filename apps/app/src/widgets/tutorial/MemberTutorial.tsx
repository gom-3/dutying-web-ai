import {useEffect, useMemo, useRef} from 'react';
import useAuth from '@/features/auth';
import useEditShiftTeam from '@/features/edit-shift-team';
import useTutorialUseCase from '@/features/tutorial';
import {useTutorialStore} from '@/features/tutorial/model/store';
import {useTutorialDismissPersistence} from '@/features/tutorial/model/use-tutorial-dismiss-persistence';
import {type ITutorialConfig} from './tutorial.types';
import {TutorialPortal} from './TutorialPortal';

function scrollTutorialTargetIntoView(id: string) {
    if (typeof document === 'undefined') return;

    document.getElementById(id)?.scrollIntoView({block: 'center', inline: 'nearest'});
}

const MemberTutorial = () => {
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
                title: '팀별 간호사 보기',
                info: '근무팀별 간호사 목록을 한눈에 볼 수 있어요.\n팀명을 두 번 클릭하면 팀 이름도 바꿀 수 있어요.',
                infoBoxAlignment: 'left',
                onNextStep: () => {
                    scrollTutorialTargetIntoView('member_add_nurse_button');
                },
            },
            {
                highlightIds: ['member_add_nurse_button'],
                title: '간호사 추가하기',
                info: '팀을 선택하고 간호사 추가하기를 누르면 새 간호사가 만들어져요.\n추가한 뒤 이름과 근무 정보를 바로 입력할 수 있어요.',
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
                title: '간호사 정보 수정하기',
                info: '오른쪽 패널에서 이름, 숙련도, 가능한 근무, 역할·권한, 메모를 바로 수정할 수 있어요.',
                infoBoxAlignment: 'right',
                onPrevStep: () => {
                    selectNurseRef.current(null);
                    scrollTutorialTargetIntoView('member_add_nurse_button');
                },
            });
        }

        steps.push({
            highlightIds: ['member_skill_settings_button'],
            title: '숙련도 설정하기',
            info: '숙련도 기능을 쓰려면 병원·병동 기준에 맞춰 단계와 색상을 설정해 주세요.',
            infoBoxAlignment: 'right',
            onNextStep: () => {
                selectNurseRef.current(null);
            },
        });

        return {
            steps,
            infoBoxHeight: 150,
            infoBoxMargin: 20,
            scrollLock: true,
        };
    }, [firstNurseId]);

    useEffect(() => {
        if (showMemberTutorial) {
            selectNurseRef.current(null);
        }
    }, [showMemberTutorial]);

    return <TutorialPortal open={showMemberTutorial && isTutorialReady} config={config} closeCallback={onTutorialClose} />;
};

export default MemberTutorial;
