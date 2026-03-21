import {type DropResult} from '@hello-pangea/dnd';
import {useEffect, useState} from 'react';
import toast from 'react-hot-toast';
import {applyParsedWardData} from '../adapter';
import {
    addNurseDraft,
    addShiftTypeDraft,
    addTeamDraft,
    canComplete,
    canGoNext,
    canGoPrev,
    createInitialDraft,
    deleteShiftTypeDraft,
    getStepValidation,
    goNextStep as goNextStepDraft,
    goPreviousStep as goPreviousStepDraft,
    reorderNursesWithinTeam,
    saveSkillLevelConfig,
    type TOnboardingWardDraft,
    type TSkillLevelConfig,
    updateNurseDraft,
    updateShiftTypeDraft,
} from '../model';
import {onboardingWardCreateExecutor} from '../submission';
import type {TSortMode} from '../types';

const MAX_STEP = 4;

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
    const goNextStep = () => {
        setDraft((prev) => goNextStepDraft(prev));
    };
    const goPreviousStep = () => {
        setDraft((prev) => goPreviousStepDraft(prev));
    };
    const updateShiftType = (shiftTypeId: string, updater: Parameters<typeof updateShiftTypeDraft>[2]) => {
        setDraft((prev) => updateShiftTypeDraft(prev, shiftTypeId, updater));
    };
    const addShiftType = () => {
        setDraft((prev) => addShiftTypeDraft(prev));
    };
    const deleteShiftType = (shiftTypeId: string) => {
        setDraft((prev) => deleteShiftTypeDraft(prev, shiftTypeId));
    };
    const updateNurse = (nurseId: string, updater: Parameters<typeof updateNurseDraft>[2]) => {
        setDraft((prev) => updateNurseDraft(prev, nurseId, updater));
    };
    const addTeam = () => {
        const {draft: nextDraft, addedTeamId} = addTeamDraft(draft);

        setDraft(nextDraft);
        setSelectedTeamId(addedTeamId);
    };
    const addNurse = () => {
        setDraft((prev) => addNurseDraft(prev, activeTeamId));
    };
    const handleNurseDragEnd = ({destination, source}: DropResult) => {
        if (!destination || !activeTeamId || destination.index === source.index || sortMode !== 'manual') {
            return;
        }

        setDraft((prev) => reorderNursesWithinTeam(prev, activeTeamId, {destination, source}));
    };
    const uploadMockFile = (fileName: string) => {
        setDraft((prev) => applyParsedWardData(prev, {fileName}));
    };
    const saveSkillConfig = (config: TSkillLevelConfig) => {
        setDraft((prev) => saveSkillLevelConfig(prev, config));
    };
    const complete = () => {
        if (!canComplete(draft)) {
            return;
        }

        const submission = onboardingWardCreateExecutor(draft);
        const stringified = JSON.stringify(submission.previewPayload, null, 2);

        console.info('createWardPayload', submission.wardCreatePayload);
        console.info('mockCreateWardPayload', submission.previewPayload);
        setCompletedPayload(stringified);
        toast.success(submission.successMessage);
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
        setSelectedTeamId,
        sortMode,
        setSortMode,
        showSkillModal,
        setShowSkillModal,
        completedPayload,
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
        currentStepValidation: getStepValidation(draft),
        canGoPrev: canGoPrev(draft),
        canGoNext: canGoNext(draft),
        canComplete: canComplete(draft),
    };
}

export default useOnboardingWardWizard;
