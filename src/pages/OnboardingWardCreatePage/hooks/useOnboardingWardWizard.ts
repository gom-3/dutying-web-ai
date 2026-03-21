import {type DropResult} from '@hello-pangea/dnd';
import * as Sentry from '@sentry/react';
import {useEffect, useMemo, useState} from 'react';
import toast from 'react-hot-toast';
import useRegister from '@/features/auth/useRegister';
import {FileAPI} from '@/shared/api';
import {
    applyParsedWardData,
    buildOnboardingParseDraftInjection,
    getOnboardingUploadFailureMessage,
    isSupportedOnboardingUploadFile,
} from '../adapter';
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
type TUploadStatus = 'idle' | 'uploading' | 'success' | 'warning' | 'error';

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
    const [uploadStatus, setUploadStatus] = useState<TUploadStatus>('idle');
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
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
    const applyUploadedFile = async (file: File) => {
        if (!isSupportedOnboardingUploadFile(file.name)) {
            const message = '엑셀 파일(.xlsx, .xls, .csv)만 업로드할 수 있어요.';

            setUploadStatus('error');
            setUploadError(message);
            setUploadWarnings([]);
            toast.error(message);

            return;
        }

        setUploadStatus('uploading');
        setUploadError(null);
        setUploadWarnings([]);

        try {
            const response = await FileAPI.parseOnboardingWardExcel(file);
            const {parsedWardData, warnings} = buildOnboardingParseDraftInjection(response, file.name);

            setDraft((prev) => applyParsedWardData(prev, parsedWardData));
            setUploadWarnings(warnings);
            setUploadStatus(warnings.length > 0 ? 'warning' : 'success');

            if (warnings.length > 0) {
                toast.error('일부 데이터만 반영했어요. 누락된 항목을 확인해 주세요.');
            } else {
                toast.success('엑셀 데이터를 불러왔어요.');
            }
        } catch (error) {
            const message = getOnboardingUploadFailureMessage(error);

            setUploadStatus('error');
            setUploadError(message);
            setUploadWarnings([]);
            toast.error(message);
        }
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

            setSubmissionStatus('success');
            toast.success(submission.successMessage);
        } catch (error) {
            Sentry.captureException(error, {
                tags: {feature: 'onboarding-ward-create'},
                extra: {step: draft.currentStep},
            });
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
        uploadStatus,
        uploadError,
        uploadWarnings,
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
