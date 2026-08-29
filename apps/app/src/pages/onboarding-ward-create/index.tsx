import {cn} from '@dutying/utils/style';
import {ArrowLeft, Trash2} from 'lucide-react';
import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import toast from 'react-hot-toast';
import {useNavigate} from 'react-router';
import {getWardDisplayTitle} from '@/entities/ward';
import useAuth from '@/features/auth';
import {isOnboardingWardCreatePreviewAllowed} from '@/shared/config/feature-flags';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {getRequiredRotationClassificationCounts} from '@/shared/lib/shift-rotation-selection';
import {
    getOnboardingInitialScheduleTargets,
    isOnboardingShiftMappingResolved,
    isOnboardingShiftTypeActive,
    resolveOnboardingRotationSystem,
    useOnboardingWardWizard,
} from './model';
import HeaderLogo from './ui/header-logo';
import OnboardingNurseOrderTutorial from './ui/onboarding-nurse-order-tutorial';
import OnboardingStepLayout from './ui/onboarding-step-layout';
import SectionHeader from './ui/section-header';
import NightRecoveryStep from './ui/steps/night-recovery-step';
import NurseStep from './ui/steps/nurse-step';
import RotationStep from './ui/steps/rotation-step';
import ScheduleInputStep from './ui/steps/schedule-input-step';
import ShiftTypeStep from './ui/steps/shift-type-step';
import WardIdentityStep from './ui/steps/ward-identity-step';
import WardCreationProgressOverlay from './ui/ward-creation-progress-overlay';
import WizardButton from './ui/wizard-button';

const WARD_CREATED_GUIDE_STORAGE_KEY = 'dutying:onboardingWardCreatedGuide';

function OnboardingWardCreatePage() {
    const {t} = useTypedTranslation();
    const navigate = useNavigate();
    const {
        state: {accountMe},
    } = useAuth();
    const {
        draft,
        activeTeamId,
        setSelectedTeamId,
        sortMode,
        setSortMode,
        goNextStep,
        goPreviousStep,
        updateWardIdentity,
        updateRotationMode,
        updateTwoShiftNightRecoveryDisplay,
        skipOrComplete,
        addShiftType,
        updateShiftType,
        deleteShiftType,
        addTeam,
        addNurse,
        deleteActiveTeam,
        deleteNurse,
        updateNurse,
        updateTeamName,
        updateTeamDivisionName,
        addDivisionAfterNurse,
        deleteDivision,
        updateScheduleInput,
        addScheduleDivisionAfterRow,
        deleteScheduleDivision,
        handleNurseDragEnd,
        handleShiftTypeDragEnd,
        applyUploadedFile,
        uploadStatus,
        uploadError,
        draftCreationStatus,
        createdWard,
        complete,
        isStepTransitioning,
        canGoNext,
        canComplete,
        submissionStatus,
        canAddTeam,
        hasScheduleInput,
        currentStepValidation,
        completionValidationIssues,
    } = useOnboardingWardWizard();
    const [showDeleteTeamModal, setShowDeleteTeamModal] = useState(false);
    const [showIdentityNameError, setShowIdentityNameError] = useState(false);
    const [showTwoShiftNightRecoveryStep, setShowTwoShiftNightRecoveryStep] = useState(false);
    const isSubmitting = submissionStatus === 'submitting';
    const isSuccess = submissionStatus === 'success';
    const isSavingDraft = draftCreationStatus === 'creating';
    const actionsDisabled = isSavingDraft || isStepTransitioning || isSubmitting || isSuccess;
    const isNurseRegistrationStep = draft.currentStep === 5;
    const isScheduleInputStep = draft.currentStep === 3;
    const isNightRecoveryStep = draft.currentStep === 2 && draft.rotationMode === 'TWO' && showTwoShiftNightRecoveryStep;
    const activeShiftTypes = draft.shiftTypes.filter(isOnboardingShiftTypeActive);
    const activeTeam = draft.teams.find((team) => team.id === activeTeamId);
    const activeTeamNurseCount = draft.nurses.filter((nurse) => nurse.teamId === activeTeamId).length;
    const activeTeamScheduleRowCount = Object.values(draft.scheduleInputs[activeTeamId] ?? {}).reduce(
        (count, schedule) =>
            count +
            (schedule?.rows.filter((row) => row.name.trim() || Object.values(row.shifts).some((shift) => shift.trim())).length ?? 0),
        0,
    );
    const getDeleteTeamModalDescription = () => {
        if (activeTeamNurseCount > 0 && activeTeamScheduleRowCount > 0) {
            return t('page.onboardingWardCreate.modal.deleteTeamDescriptionWithNursesAndSchedule', {
                nurseCount: activeTeamNurseCount,
            });
        }

        if (activeTeamNurseCount > 0) {
            return t('page.onboardingWardCreate.modal.deleteTeamDescriptionWithNurses', {nurseCount: activeTeamNurseCount});
        }

        if (activeTeamScheduleRowCount > 0) {
            return t('page.onboardingWardCreate.modal.deleteTeamDescriptionWithSchedule');
        }

        return t('page.onboardingWardCreate.modal.deleteTeamDescription');
    };
    const handleDeleteTeamClick = () => {
        if (!activeTeam) {
            return;
        }

        if (activeTeamNurseCount === 0 && activeTeamScheduleRowCount === 0) {
            deleteActiveTeam();

            return;
        }

        setShowDeleteTeamModal(true);
    };
    const deleteTeamButton = (
        <WizardButton
            variant="link"
            className="flex items-center gap-2 px-0 text-[18px] text-[#C55252] no-underline hover:bg-transparent hover:text-[#A53F3F]"
            disabled={actionsDisabled || !activeTeam}
            onClick={handleDeleteTeamClick}
        >
            <Trash2 className="h-4 w-4" />
            {t('page.onboardingWardCreate.deleteTeamAction')}
        </WizardButton>
    );
    const handlePreviousStep = () => {
        if (isNightRecoveryStep) {
            setShowTwoShiftNightRecoveryStep(false);

            return;
        }

        if (draft.currentStep === 3 && draft.rotationMode === 'TWO') {
            setShowTwoShiftNightRecoveryStep(true);
        }

        goPreviousStep();
    };
    const getRequiredShiftTypeStatuses = () => {
        const activeShiftTypes = draft.shiftTypes.filter(
            (shiftType) => isOnboardingShiftTypeActive(shiftType) && isOnboardingShiftMappingResolved(shiftType.mappingStatus),
        );

        return getRequiredRotationClassificationCounts(
            draft.rotationMode,
            activeShiftTypes.map((shiftType) => ({
                classification: shiftType.classification,
                rotationSystem: resolveOnboardingRotationSystem(shiftType),
            })),
            {includeNightContinuation: draft.twoShiftNightRecoveryDisplay === 'NIGHT_CONTINUATION'},
        ).map((requiredShiftType) => ({
            ...requiredShiftType,
            label:
                requiredShiftType.rotationSystem === 'TWO'
                    ? requiredShiftType.classification === 'DAY'
                        ? t('page.onboardingWardCreate.shiftType.twoDayLabel')
                        : requiredShiftType.classification === 'NIGHT_CONTINUATION'
                          ? t('page.onboardingWardCreate.shiftType.classification.nightContinuation')
                          : t('page.onboardingWardCreate.shiftType.twoNightLabel')
                    : requiredShiftType.classification === 'DAY'
                      ? t('page.onboardingWardCreate.shiftType.classification.day')
                      : requiredShiftType.classification === 'EVENING'
                        ? t('page.onboardingWardCreate.shiftType.classification.evening')
                        : requiredShiftType.classification === 'NIGHT'
                          ? t('page.onboardingWardCreate.shiftType.classification.night')
                          : t('page.onboardingWardCreate.shiftType.classification.off'),
        }));
    };
    const getMissingRequiredShiftTypeLabels = () =>
        getRequiredShiftTypeStatuses()
            .filter(({count}) => count === 0)
            .map(({label}) => label);
    const getDuplicateRequiredShiftTypeLabels = () =>
        getRequiredShiftTypeStatuses()
            .filter(({count}) => count > 1)
            .map(({label}) => label);
    const getNextBlockedReasonMessage = () => {
        if (isSubmitting) {
            return t('page.onboardingWardCreate.blocked.submitting');
        }

        if (isSuccess) {
            return t('page.onboardingWardCreate.blocked.success');
        }

        const blockingIssues = draft.currentStep === 5 && !canComplete ? completionValidationIssues : currentStepValidation.issues;
        const codes = new Set(blockingIssues.map((issue) => issue.code));

        if (codes.has('missing-hospital-name')) {
            return t('page.onboardingWardCreate.blocked.missingHospitalName');
        }

        if (codes.has('missing-two-shift-night-recovery-display')) {
            return t('page.onboardingWardCreate.blocked.missingTwoShiftNightRecoveryDisplay');
        }

        if (codes.has('invalid-ward-name') || codes.has('invalid-hospital-name')) {
            return t('page.onboardingWardCreate.blocked.invalidWardIdentity');
        }

        if (codes.has('empty-team-nurses')) {
            return t('page.onboardingWardCreate.blocked.emptyTeamNurses');
        }

        if (codes.has('empty-team')) {
            return t('page.onboardingWardCreate.blocked.emptyTeam');
        }

        if (codes.has('schedule-row-missing-nurse-name')) {
            return t('page.onboardingWardCreate.blocked.scheduleMissingNurseName');
        }

        if (codes.has('missing-nurse-name') || codes.has('invalid-nurse-name')) {
            return t('page.onboardingWardCreate.blocked.invalidNurseName');
        }

        if (codes.has('duplicate-shift-short-name')) {
            return t('page.onboardingWardCreate.blocked.duplicateShiftType');
        }

        if (codes.has('unmapped-shift-type')) {
            const unmappedShiftType = draft.shiftTypes.find(
                (shiftType) => isOnboardingShiftTypeActive(shiftType) && !isOnboardingShiftMappingResolved(shiftType.mappingStatus),
            );

            return t('page.onboardingWardCreate.blocked.unmappedShiftType', {
                shiftCode: unmappedShiftType?.shortName.trim() ? unmappedShiftType.shortName : '-',
            });
        }

        if (codes.has('duplicate-required-shift-types')) {
            return t('page.onboardingWardCreate.blocked.duplicateRequiredShiftTypes', {
                shiftTypes: getDuplicateRequiredShiftTypeLabels().join(', '),
            });
        }

        if (codes.has('missing-required-shift-types')) {
            return t('page.onboardingWardCreate.blocked.missingRequiredShiftTypes', {
                shiftTypes: getMissingRequiredShiftTypeLabels().join(', '),
            });
        }

        if (codes.has('missing-shift-time') || codes.has('invalid-shift-time-format') || codes.has('invalid-shift-time-order')) {
            return t('page.onboardingWardCreate.blocked.invalidShiftTime');
        }

        if (
            codes.has('invalid-shift-rotation') ||
            codes.has('missing-shift-short-name') ||
            codes.has('invalid-shift-short-name') ||
            codes.has('empty-shift-types')
        ) {
            return t('page.onboardingWardCreate.blocked.invalidShiftType');
        }

        return t('page.onboardingWardCreate.blocked.default');
    };
    const getStepOneIssueCodes = () => new Set(currentStepValidation.issues.map((issue) => issue.code));
    const focusFirstInvalidIdentityField = () => {
        const codes = getStepOneIssueCodes();
        const nextFocusId =
            codes.has('missing-hospital-name') || codes.has('invalid-hospital-name') ? 'onboarding-hospital-name' : 'onboarding-ward-name';

        document.getElementById(nextFocusId)?.focus();
    };
    const handleIdentityNameEnter = () => {
        if (actionsDisabled) {
            return;
        }

        if (canGoNext) {
            setShowIdentityNameError(false);
            void goNextStep();

            return;
        }

        if (draft.currentStep === 1) {
            setShowIdentityNameError(true);
            focusFirstInvalidIdentityField();
        }

        toast.error(getNextBlockedReasonMessage());
    };

    useEffect(() => {
        if (isOnboardingWardCreatePreviewAllowed()) return;

        if (isSubmitting || isSuccess) {
            return;
        }

        if (accountMe?.status === 'LINKED' || accountMe?.status === 'DEMO') {
            navigate(ROUTE.MAKE, {replace: true});

            return;
        }

        if (accountMe && !['INITIAL', 'NURSE_INFO_PENDING', 'WARD_SELECT_PENDING', 'WORKSPACE_SETUP_PENDING'].includes(accountMe.status)) {
            navigate(ROUTE.REGISTER);
        }
    }, [accountMe, isSubmitting, isSuccess, navigate]);

    useEffect(() => {
        if (!isSuccess) {
            return;
        }

        const guidePayload = createdWard
            ? {
                  wardCode: createdWard.code,
                  wardTitle: getWardDisplayTitle(createdWard),
              }
            : true;

        window.sessionStorage.setItem(WARD_CREATED_GUIDE_STORAGE_KEY, JSON.stringify(guidePayload));

        const initialScheduleTargets = getOnboardingInitialScheduleTargets(draft, {
            preferredTeamId: activeTeamId,
            createdWard,
        });
        const initialScheduleTarget = initialScheduleTargets[0] ?? null;
        const navigationState =
            initialScheduleTargets.length > 0
                ? {
                      onboardingWardCreated: guidePayload,
                      onboardingInitialSchedule: initialScheduleTarget,
                      onboardingInitialSchedules: initialScheduleTargets,
                  }
                : {
                      onboardingWardCreated: guidePayload,
                      onboardingInitialSchedule: null,
                  };

        navigate(ROUTE.HOME, {
            replace: true,
            state: navigationState,
        });

        return undefined;
    }, [activeTeamId, createdWard, draft, isSuccess, navigate]);

    const stepContent = (() => {
        switch (draft.currentStep) {
            case 1: {
                const stepOneIssueCodes = getStepOneIssueCodes();

                return (
                    <WardIdentityStep
                        hospitalName={draft.hospitalName}
                        wardName={draft.wardName}
                        hasHospitalNameError={
                            showIdentityNameError &&
                            (stepOneIssueCodes.has('missing-hospital-name') || stepOneIssueCodes.has('invalid-hospital-name'))
                        }
                        hasWardNameError={showIdentityNameError && stepOneIssueCodes.has('invalid-ward-name')}
                        onHospitalNameChange={(hospitalName) => {
                            if (showIdentityNameError) {
                                setShowIdentityNameError(false);
                            }

                            updateWardIdentity({
                                hospitalName,
                            });
                        }}
                        onWardNameChange={(wardName) => {
                            if (showIdentityNameError) {
                                setShowIdentityNameError(false);
                            }

                            updateWardIdentity({
                                wardName,
                            });
                        }}
                        onIdentityNameEnter={handleIdentityNameEnter}
                    />
                );
            }
            case 2:
                return isNightRecoveryStep ? (
                    <NightRecoveryStep value={draft.twoShiftNightRecoveryDisplay} onChange={updateTwoShiftNightRecoveryDisplay} />
                ) : (
                    <RotationStep rotationMode={draft.rotationMode} onRotationModeChange={updateRotationMode} />
                );
            case 3:
                return (
                    <ScheduleInputStep
                        draft={draft}
                        selectedTeamId={activeTeamId}
                        onSelectTeam={setSelectedTeamId}
                        onAddTeam={addTeam}
                        canAddTeam={canAddTeam}
                        onTeamNameChange={updateTeamName}
                        onDivisionNameChange={updateTeamDivisionName}
                        onAddDivisionAfterRow={addScheduleDivisionAfterRow}
                        onDeleteDivision={deleteScheduleDivision}
                        onScheduleChange={updateScheduleInput}
                        onUploadFile={applyUploadedFile}
                        uploadStatus={uploadStatus}
                        uploadError={uploadError}
                        onDeleteTeam={handleDeleteTeamClick}
                        isDeleteTeamDisabled={actionsDisabled || !activeTeam}
                    />
                );
            case 4:
                return (
                    <ShiftTypeStep
                        shiftTypes={activeShiftTypes}
                        rotationMode={draft.rotationMode}
                        allowNightContinuation={draft.rotationMode !== 'TWO' || draft.twoShiftNightRecoveryDisplay === 'NIGHT_CONTINUATION'}
                        requireNightContinuation={draft.twoShiftNightRecoveryDisplay === 'NIGHT_CONTINUATION'}
                        onChange={updateShiftType}
                        onDragEnd={handleShiftTypeDragEnd}
                        onAdd={addShiftType}
                        onDelete={deleteShiftType}
                    />
                );
            case 5:
                return (
                    <NurseStep
                        draft={draft}
                        selectedTeamId={activeTeamId}
                        sortMode={sortMode}
                        onSortModeChange={setSortMode}
                        onSelectTeam={setSelectedTeamId}
                        onAddTeam={addTeam}
                        canAddTeam={canAddTeam}
                        onAddNurse={addNurse}
                        onDeleteNurse={deleteNurse}
                        onNurseChange={updateNurse}
                        onTeamNameChange={updateTeamName}
                        onDivisionNameChange={updateTeamDivisionName}
                        onAddDivisionAfterNurse={addDivisionAfterNurse}
                        onDeleteDivision={deleteDivision}
                        onDragEnd={handleNurseDragEnd}
                    />
                );
            default:
                return null;
        }
    })();
    const modalRoot = document.getElementById('modal-root') ?? document.body;

    return (
        <div className="relative min-h-screen bg-main-bg">
            <HeaderLogo />
            {showDeleteTeamModal && activeTeam
                ? createPortal(
                      <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[1px]">
                          <div role="dialog" aria-modal="true" className="w-full max-w-[440px] rounded-[16px] bg-white px-6 py-5">
                              <p className="font-apple text-[20px] font-semibold text-sub-1">
                                  {t('page.onboardingWardCreate.modal.deleteTeamTitle')}
                              </p>
                              <p className="mt-2 font-apple text-[15px] text-gray-3">
                                  <span className="font-semibold text-sub-1">{activeTeam.name}</span>
                                  {getDeleteTeamModalDescription()}
                              </p>
                              <div className="mt-5 flex justify-end gap-2">
                                  <button
                                      type="button"
                                      className="rounded-[8px] px-4 py-2 font-apple text-[14px] font-medium text-gray-3 transition-colors hover:bg-gray-7"
                                      onClick={() => setShowDeleteTeamModal(false)}
                                  >
                                      {t('page.member.common.close')}
                                  </button>
                                  <button
                                      type="button"
                                      className="rounded-[8px] bg-[#D14343] px-4 py-2 font-apple text-[14px] font-semibold text-white transition-colors hover:bg-[#BD3434]"
                                      onClick={() => {
                                          deleteActiveTeam();
                                          setShowDeleteTeamModal(false);
                                      }}
                                  >
                                      {t('page.member.common.deleteAction')}
                                  </button>
                              </div>
                          </div>
                      </div>,
                      modalRoot,
                  )
                : null}
            {isSubmitting || isSuccess ? createPortal(<WardCreationProgressOverlay isComplete={isSuccess} />, modalRoot) : null}
            <OnboardingNurseOrderTutorial
                canStart={isNurseRegistrationStep && draft.nurses.length > 0 && !showDeleteTeamModal && !isSubmitting && !isSuccess}
            />
            <div
                className={cn(
                    'mx-auto w-full px-4 pt-7 pb-20 sm:px-6 lg:px-0',
                    isNightRecoveryStep
                        ? 'max-w-[560px]'
                        : draft.currentStep === 1 || draft.currentStep === 2
                          ? 'max-w-[480px]'
                          : isScheduleInputStep
                            ? 'max-w-[1200px]'
                            : 'max-w-[1120px]',
                )}
            >
                {draft.currentStep === 1 ? (
                    <button
                        type="button"
                        className="mb-6 flex h-10 w-fit cursor-pointer items-center gap-2 rounded-[12px] bg-white px-3 font-apple text-sm font-medium text-gray-3 transition-colors hover:bg-gray-7 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={actionsDisabled}
                        onClick={() => navigate(ROUTE.REGISTER)}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {t('page.onboardingWardCreate.backToWardSelect')}
                    </button>
                ) : null}
                <SectionHeader step={draft.currentStep} nightRecovery={isNightRecoveryStep} />
                <OnboardingStepLayout
                    step={draft.currentStep}
                    onPrev={handlePreviousStep}
                    onNext={() => {
                        if (draft.currentStep === 1) {
                            setShowIdentityNameError(false);
                        }

                        if (isScheduleInputStep && !hasScheduleInput) {
                            skipOrComplete();

                            return;
                        }

                        if (draft.currentStep === 2 && draft.rotationMode === 'TWO' && !isNightRecoveryStep) {
                            setShowTwoShiftNightRecoveryStep(true);

                            return;
                        }

                        if (draft.currentStep < 5) {
                            void goNextStep();

                            return;
                        }

                        void complete();
                    }}
                    onNextDisabledClick={() => {
                        if (draft.currentStep === 1) {
                            setShowIdentityNameError(true);
                            focusFirstInvalidIdentityField();
                        }

                        toast.error(getNextBlockedReasonMessage());
                    }}
                    leftAction={
                        isScheduleInputStep && !hasScheduleInput ? (
                            <WizardButton variant="link" className="text-[18px]" disabled={actionsDisabled} onClick={skipOrComplete}>
                                {t('page.onboardingWardCreate.action.skip')}
                            </WizardButton>
                        ) : isNurseRegistrationStep ? (
                            deleteTeamButton
                        ) : undefined
                    }
                    nextDisabled={
                        draft.currentStep < 5
                            ? (!canGoNext && !(draft.currentStep === 2 && !isNightRecoveryStep)) ||
                              isSavingDraft ||
                              isSubmitting ||
                              isSuccess
                            : !canComplete || isSavingDraft || isSubmitting || isSuccess
                    }
                    actionsDisabled={actionsDisabled}
                    nextLabel={
                        (draft.currentStep === 1 && isSavingDraft) || isStepTransitioning
                            ? t('page.onboardingWardCreate.action.saving')
                            : draft.currentStep < 5
                              ? t('page.onboardingWardCreate.action.next')
                              : isSubmitting
                                ? t('page.onboardingWardCreate.action.creating')
                                : isSuccess
                                  ? t('page.onboardingWardCreate.action.created')
                                  : t('page.onboardingWardCreate.action.complete')
                    }
                >
                    {stepContent}
                </OnboardingStepLayout>
            </div>
        </div>
    );
}

export default OnboardingWardCreatePage;
