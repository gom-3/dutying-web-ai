import {type DropResult} from '@hello-pangea/dnd';
import {useEffect, useState} from 'react';
import toast from 'react-hot-toast';
import {
    applyMockUpload,
    applySkillLevels,
    createEmptyNurse,
    createEmptyShiftType,
    createInitialDraft,
    serializeDraft,
    type TOnboardingNurseDraft,
    type TOnboardingStep,
    type TOnboardingWardDraft,
    type TOnboardingWardShiftType,
    type TSkillLevelConfig,
} from '../model';
import type {TSortMode} from '../types';

const MIN_STEP = 1;
const MAX_STEP = 4;

function getNextStep(step: TOnboardingStep): TOnboardingStep {
    return Math.min(MAX_STEP, step + 1) as TOnboardingStep;
}

function getPreviousStep(step: TOnboardingStep): TOnboardingStep {
    return Math.max(MIN_STEP, step - 1) as TOnboardingStep;
}

function useOnboardingWardWizard() {
    const [draft, setDraft] = useState<TOnboardingWardDraft>(() => createInitialDraft());
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [sortMode, setSortMode] = useState<TSortMode>('manual');
    const [showSkillModal, setShowSkillModal] = useState(false);
    const [completedPayload, setCompletedPayload] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedTeamId && draft.teams[0]) {
            setSelectedTeamId(draft.teams[0].id);
        }
    }, [draft.teams, selectedTeamId]);

    const selectedTeamExists = draft.teams.some((team) => team.id === selectedTeamId);
    const activeTeamId = selectedTeamExists ? selectedTeamId : (draft.teams[0]?.id ?? '');
    const goToStep = (step: TOnboardingStep) => {
        setDraft((prev) => ({...prev, currentStep: step}));
    };
    const goNextStep = () => {
        setDraft((prev) => ({...prev, currentStep: getNextStep(prev.currentStep)}));
    };
    const goPreviousStep = () => {
        setDraft((prev) => ({...prev, currentStep: getPreviousStep(prev.currentStep)}));
    };
    const updateShiftType = (shiftTypeId: string, updater: Partial<TOnboardingWardShiftType>) => {
        setDraft((prev) => ({
            ...prev,
            shiftTypes: prev.shiftTypes.map((shiftType) => (shiftType.id === shiftTypeId ? {...shiftType, ...updater} : shiftType)),
        }));
    };
    const addShiftType = () => {
        setDraft((prev) => ({
            ...prev,
            shiftTypes: [...prev.shiftTypes, createEmptyShiftType()],
        }));
    };
    const deleteShiftType = (shiftTypeId: string) => {
        setDraft((prev) => ({
            ...prev,
            shiftTypes: prev.shiftTypes.filter((shiftType) => shiftType.id !== shiftTypeId),
            nurses: prev.nurses.map((nurse) => ({
                ...nurse,
                possibleShiftTypeIds: nurse.possibleShiftTypeIds.filter((value) => value !== shiftTypeId),
            })),
        }));
    };
    const updateNurse = (nurseId: string, updater: Partial<TOnboardingNurseDraft>) => {
        setDraft((prev) => ({
            ...prev,
            nurses: prev.nurses.map((nurse) => (nurse.id === nurseId ? {...nurse, ...updater} : nurse)),
        }));
    };
    const addTeam = () => {
        const team = {
            id: `team-new-${draft.teams.length + 1}`,
            name: `간호사 ${draft.teams.length + 1}팀`,
        };

        setDraft((prev) => ({...prev, teams: [...prev.teams, team]}));
        setSelectedTeamId(team.id);
    };
    const addNurse = () => {
        if (!activeTeamId) {
            return;
        }

        setDraft((prev) => ({
            ...prev,
            nurses: [...prev.nurses, createEmptyNurse(activeTeamId, prev.shiftTypes)],
        }));
    };
    const handleNurseDragEnd = ({destination, source}: DropResult) => {
        if (!destination || !activeTeamId || destination.index === source.index || sortMode !== 'manual') {
            return;
        }

        setDraft((prev) => {
            const teamNurses = prev.nurses.filter((nurse) => nurse.teamId === activeTeamId);
            const otherNurses = prev.nurses.filter((nurse) => nurse.teamId !== activeTeamId);
            const nextNurses = [...teamNurses];
            const [moved] = nextNurses.splice(source.index, 1);

            if (!moved) {
                return prev;
            }

            nextNurses.splice(destination.index, 0, moved);

            return {
                ...prev,
                nurses: [...otherNurses, ...nextNurses],
            };
        });
    };
    const uploadMockFile = (fileName: string) => {
        setDraft((prev) => applyMockUpload(prev, fileName));
    };
    const saveSkillConfig = (config: TSkillLevelConfig) => {
        setDraft((prev) => ({
            ...prev,
            skillLevelConfig: config,
            nurses: applySkillLevels(prev.nurses, config),
        }));
    };
    const complete = () => {
        const payload = serializeDraft(draft);
        const stringified = JSON.stringify(payload, null, 2);

        console.info('mockCreateWardPayload', payload);
        setCompletedPayload(stringified);
        toast.success('mock 병동 생성 payload를 만들었습니다.');
    };
    const skipOrComplete = () => {
        if (draft.currentStep === MAX_STEP) {
            complete();

            return;
        }

        goNextStep();
    };

    return {
        draft,
        activeTeamId,
        selectedTeamId,
        setSelectedTeamId,
        sortMode,
        setSortMode,
        showSkillModal,
        setShowSkillModal,
        completedPayload,
        goToStep,
        goNextStep,
        goPreviousStep,
        skipOrComplete,
        addShiftType,
        updateShiftType,
        deleteShiftType,
        addTeam,
        addNurse,
        updateNurse,
        handleNurseDragEnd,
        uploadMockFile,
        saveSkillConfig,
        complete,
    };
}

export default useOnboardingWardWizard;
