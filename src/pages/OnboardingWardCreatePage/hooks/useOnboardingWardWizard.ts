import {type DropResult} from '@hello-pangea/dnd';
import {useEffect, useMemo, useState} from 'react';
import toast from 'react-hot-toast';
import useRegister from '@/features/auth/useRegister';
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
import {createOnboardingWardCreateExecutor} from '../submission';
import type {TSortMode} from '../types';

const MAX_STEP = 4;

type TSubmissionStatus = 'idle' | 'submitting' | 'success' | 'error';

function useOnboardingWardWizard() {
    const {
        actions: {createWard},
    } = useRegister();
    const [draft, setDraft] = useState<TOnboardingWardDraft>(() => createInitialDraft());
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [sortMode, setSortMode] = useState<TSortMode>('manual');
    const [showSkillModal, setShowSkillModal] = useState(false);
    const [submissionStatus, setSubmissionStatus] = useState<TSubmissionStatus>('idle');
    const [submissionError, setSubmissionError] = useState<string | null>(null);
    const onboardingWardCreateExecutor = useMemo(() => createOnboardingWardCreateExecutor(createWard), [createWard]);

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
    const applyUploadedFile = (fileName: string) => {
        setDraft((prev) => applyParsedWardData(prev, {fileName}));
    };
    const saveSkillConfig = (config: TSkillLevelConfig) => {
        setDraft((prev) => saveSkillLevelConfig(prev, config));
    };
    const complete = async () => {
        if (!canComplete(draft) || submissionStatus === 'submitting') {
            return;
        }

        setSubmissionStatus('submitting');
        setSubmissionError(null);

        try {
            const submission = await onboardingWardCreateExecutor(draft);

            console.info('createWardPayload', submission.wardCreatePayload);
            setSubmissionStatus('success');
            toast.success(submission.successMessage);
        } catch (error) {
            console.error('Failed to complete onboarding ward creation.', error);
            setSubmissionStatus('error');
            setSubmissionError(error instanceof Error ? error.message : '병동 생성에 실패했습니다. 다시 시도해주세요.');
        }
    };
    const skipOrComplete = () => {
        if (draft.currentStep === MAX_STEP) {
            void complete();

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
        applyUploadedFile,
        saveSkillConfig,
        complete,
        submissionStatus,
        submissionError,
        currentStepValidation: getStepValidation(draft),
        canGoPrev: canGoPrev(draft),
        canGoNext: canGoNext(draft),
        canComplete: canComplete(draft),
    };
}

export default useOnboardingWardWizard;
