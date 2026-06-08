import {cn} from '@dutying/utils/style';
import {ArrowLeft, ArrowRight, Trash2} from 'lucide-react';
import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import toast from 'react-hot-toast';
import {useNavigate} from 'react-router';
import {getWardDisplayTitle} from '@/entities/ward';
import useAuth from '@/features/auth';
import skillBubbleBadgeIcon from '@/shared/assets/images/skill-bubble-badge.png';
import {isOnboardingWardCreatePreviewAllowed} from '@/shared/config/feature-flags';
import ROUTE from '@/shared/constant/path';
import {getOnboardingInitialScheduleTarget, useOnboardingWardWizard} from './model';
import HeaderLogo from './ui/header-logo';
import OnboardingStepLayout from './ui/onboarding-step-layout';
import SectionHeader from './ui/section-header';
import NurseStep from './ui/steps/nurse-step';
import ScheduleInputStep from './ui/steps/schedule-input-step';
import ShiftTypeStep from './ui/steps/shift-type-step';
import SkillLevelModal from './ui/steps/skill-level-modal';
import WardIdentityStep from './ui/steps/ward-identity-step';
import WizardButton from './ui/wizard-button';

const WARD_CREATED_GUIDE_STORAGE_KEY = 'dutying:onboardingWardCreatedGuide';
const ONBOARDING_INITIAL_SCHEDULE_SEARCH_PARAM = 'onboardingSchedule';

function buildMakeRouteWithOnboardingSchedule(params: {year: number; month: number; shiftTeamId?: number}) {
    const searchParams = new URLSearchParams({
        onboardingWardCreated: '1',
        [ONBOARDING_INITIAL_SCHEDULE_SEARCH_PARAM]: '1',
        year: String(params.year),
        month: String(params.month),
    });

    if (typeof params.shiftTeamId === 'number') {
        searchParams.set('shiftTeamId', String(params.shiftTeamId));
    }

    return `${ROUTE.MAKE}?${searchParams.toString()}`;
}

function OnboardingWardCreatePage() {
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
        showSkillModal,
        setShowSkillModal,
        isSkillLevelEnabled,
        goNextStep,
        goPreviousStep,
        updateWardIdentity,
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
        updateScheduleInput,
        handleNurseDragEnd,
        applyUploadedFile,
        uploadStatus,
        uploadError,
        draftCreationStatus,
        createdWard,
        saveSkillConfig,
        disableSkillConfig,
        complete,
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
    const isSubmitting = submissionStatus === 'submitting';
    const isSuccess = submissionStatus === 'success';
    const isSavingDraft = draftCreationStatus === 'creating';
    const actionsDisabled = isSavingDraft || isSubmitting || isSuccess;
    const isNurseRegistrationStep = draft.currentStep === 4;
    const isScheduleInputStep = draft.currentStep === 2;
    const activeTeam = draft.teams.find((team) => team.id === activeTeamId);
    const activeTeamNurseCount = draft.nurses.filter((nurse) => nurse.teamId === activeTeamId).length;
    const activeTeamScheduleRowCount = Object.values(draft.scheduleInputs[activeTeamId] ?? {}).reduce(
        (count, schedule) =>
            count +
            (schedule?.rows.filter((row) => row.name.trim() || Object.values(row.shifts).some((shift) => shift.trim())).length ?? 0),
        0,
    );
    const openSkillModal = () => setShowSkillModal(true);
    const getDeleteTeamModalDescription = () => {
        if (activeTeamNurseCount > 0 && activeTeamScheduleRowCount > 0) {
            return ` 팀을 삭제하면 소속 간호사 ${activeTeamNurseCount}명과 입력한 근무표도 함께 삭제돼요.`;
        }

        if (activeTeamNurseCount > 0) {
            return ` 팀을 삭제하면 소속 간호사 ${activeTeamNurseCount}명도 함께 삭제돼요.`;
        }

        if (activeTeamScheduleRowCount > 0) {
            return ' 팀을 삭제하면 입력한 근무표도 함께 삭제돼요.';
        }

        return ' 팀을 삭제할게요.';
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
            <Trash2 className="h-4 w-4" />팀 삭제하기
        </WizardButton>
    );
    const getNextBlockedReasonMessage = () => {
        if (isSubmitting) {
            return '병동을 생성하고 있어요. 잠시만 기다려 주세요.';
        }

        if (isSuccess) {
            return '이미 병동 생성을 마쳤어요.';
        }

        const blockingIssues = draft.currentStep === 4 && !canComplete ? completionValidationIssues : currentStepValidation.issues;
        const codes = new Set(blockingIssues.map((issue) => issue.code));

        if (codes.has('missing-hospital-name')) {
            return '병원명을 입력해 주세요.';
        }

        if (codes.has('invalid-ward-name') || codes.has('invalid-hospital-name')) {
            return '입력값은 한글, 영문, 숫자, 공백만 1~20자로 입력해 주세요.';
        }

        if (codes.has('empty-team-nurses')) {
            return '간호사 없는 팀이 있어요. 간호사를 추가하거나 팀을 삭제해 주세요.';
        }

        if (codes.has('empty-team')) {
            return '팀을 추가하면 병동을 만들 수 있어요.';
        }

        if (codes.has('missing-nurse-name') || codes.has('invalid-nurse-name')) {
            return '간호사 이름을 확인해 주세요.';
        }

        if (codes.has('duplicate-shift-name') || codes.has('duplicate-shift-short-name')) {
            return '중복된 근무명 또는 약자가 있어요.';
        }

        if (codes.has('missing-shift-time') || codes.has('invalid-shift-time-format') || codes.has('invalid-shift-time-order')) {
            return '근무 시간을 확인해 주세요.';
        }

        if (codes.has('missing-shift-name') || codes.has('missing-shift-short-name') || codes.has('empty-shift-types')) {
            return '근무 유형 정보를 확인해 주세요.';
        }

        return '입력 정보를 확인해 주세요.';
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
    const headerAside =
        draft.currentStep === 4 ? (
            <div className="space-y-3">
                <button
                    type="button"
                    aria-label="숙련도 설정"
                    className="group relative w-full cursor-pointer rounded-[16px] bg-[#E9E4FF] px-6 py-5 pr-16 text-left transition-colors duration-200 before:absolute before:inset-0 before:rounded-[16px] before:bg-[#DDD2FF] before:opacity-0 before:transition-opacity before:duration-200 before:content-[''] group-hover:before:opacity-100 after:absolute after:right-8 after:-bottom-2.5 after:h-5 after:w-5 after:rotate-45 after:rounded-[2px] after:bg-[#E9E4FF] after:transition-colors after:duration-200 after:content-[''] group-hover:after:bg-[#DDD2FF] focus-visible:ring-2 focus-visible:ring-main-1/25 focus-visible:outline-none"
                    onClick={openSkillModal}
                >
                    <img
                        src={skillBubbleBadgeIcon}
                        alt=""
                        className="pointer-events-none absolute -top-[17px] -left-[15px] z-20 h-[37px] w-[37px]"
                    />
                    <div className="relative z-10 space-y-1.5">
                        <p className="font-apple text-[19px] font-semibold text-[#5E45C1]">간호사 숙련도를 설정해볼까요?</p>
                        <p className="font-apple text-[16px] text-gray-3">근무표 작성시, 숙련도에 따라 자동으로 배정할 수 있어요</p>
                    </div>
                    <span className="pointer-events-none absolute top-1/2 right-5 z-10 -translate-y-1/2 text-[#6A4AE1] transition-transform duration-200 group-hover:translate-x-0.5">
                        <ArrowRight className="h-6 w-6" />
                    </span>
                </button>
            </div>
        ) : undefined;

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
        const initialScheduleTarget = getOnboardingInitialScheduleTarget(draft, {
            preferredTeamId: activeTeamId,
            createdWard,
        });
        const makeRoute = initialScheduleTarget ? buildMakeRouteWithOnboardingSchedule(initialScheduleTarget) : ROUTE.MAKE;

        navigate(makeRoute, {
            replace: true,
            state: {
                onboardingWardCreated: guidePayload,
                onboardingInitialSchedule: initialScheduleTarget,
            },
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
                return (
                    <ScheduleInputStep
                        draft={draft}
                        selectedTeamId={activeTeamId}
                        onSelectTeam={setSelectedTeamId}
                        onAddTeam={addTeam}
                        canAddTeam={canAddTeam}
                        onTeamNameChange={updateTeamName}
                        onScheduleChange={updateScheduleInput}
                        onUploadFile={applyUploadedFile}
                        uploadStatus={uploadStatus}
                        uploadError={uploadError}
                        onDeleteTeam={handleDeleteTeamClick}
                        isDeleteTeamDisabled={actionsDisabled || !activeTeam}
                    />
                );
            case 3:
                return (
                    <ShiftTypeStep
                        shiftTypes={draft.shiftTypes}
                        onChange={updateShiftType}
                        onAdd={addShiftType}
                        onDelete={deleteShiftType}
                    />
                );
            case 4:
                return (
                    <NurseStep
                        draft={draft}
                        selectedTeamId={activeTeamId}
                        showSkillColumn={isSkillLevelEnabled}
                        sortMode={sortMode}
                        onSortModeChange={setSortMode}
                        onSelectTeam={setSelectedTeamId}
                        onAddTeam={addTeam}
                        canAddTeam={canAddTeam}
                        onAddNurse={addNurse}
                        onDeleteNurse={deleteNurse}
                        onNurseChange={updateNurse}
                        onTeamNameChange={updateTeamName}
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
            <SkillLevelModal
                open={showSkillModal}
                config={draft.skillLevelConfig}
                onClose={() => setShowSkillModal(false)}
                onSave={saveSkillConfig}
                onDisable={() => {
                    disableSkillConfig();
                    setShowSkillModal(false);
                }}
            />
            {showDeleteTeamModal && activeTeam
                ? createPortal(
                      <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[1px]">
                          <div role="dialog" aria-modal="true" className="w-full max-w-[440px] rounded-[16px] bg-white px-6 py-5">
                              <p className="font-apple text-[20px] font-semibold text-sub-1">팀을 삭제할까요?</p>
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
                                      닫기
                                  </button>
                                  <button
                                      type="button"
                                      className="rounded-[8px] bg-[#D14343] px-4 py-2 font-apple text-[14px] font-semibold text-white transition-colors hover:bg-[#BD3434]"
                                      onClick={() => {
                                          deleteActiveTeam();
                                          setShowDeleteTeamModal(false);
                                      }}
                                  >
                                      삭제하기
                                  </button>
                              </div>
                          </div>
                      </div>,
                      modalRoot,
                  )
                : null}
            <div
                className={cn(
                    'mx-auto w-full px-4 pt-7 pb-20 sm:px-6 lg:px-0',
                    draft.currentStep === 1 ? 'max-w-[480px]' : isScheduleInputStep ? 'max-w-[1200px]' : 'max-w-[1120px]',
                )}
            >
                {draft.currentStep === 1 ? (
                    <button
                        type="button"
                        className="mb-6 flex h-10 w-fit cursor-pointer items-center gap-2 rounded-[12px] bg-white px-3 font-apple text-sm font-medium text-gray-3 transition-colors hover:bg-gray-7"
                        onClick={() => navigate(ROUTE.REGISTER)}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        병동 선택으로
                    </button>
                ) : null}
                <SectionHeader step={draft.currentStep} aside={headerAside} />
                <OnboardingStepLayout
                    step={draft.currentStep}
                    onPrev={goPreviousStep}
                    onNext={() => {
                        if (draft.currentStep === 1) {
                            setShowIdentityNameError(false);
                        }

                        if (isScheduleInputStep && !hasScheduleInput) {
                            skipOrComplete();

                            return;
                        }

                        if (draft.currentStep < 4) {
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
                                건너뛰기
                            </WizardButton>
                        ) : isNurseRegistrationStep ? (
                            deleteTeamButton
                        ) : undefined
                    }
                    nextDisabled={
                        draft.currentStep < 4
                            ? !canGoNext || isSavingDraft || isSubmitting || isSuccess
                            : !canComplete || isSavingDraft || isSubmitting || isSuccess
                    }
                    actionsDisabled={actionsDisabled}
                    nextLabel={
                        draft.currentStep === 1 && isSavingDraft
                            ? '저장 중...'
                            : draft.currentStep < 4
                              ? '다음'
                              : isSubmitting
                                ? '생성 중...'
                                : isSuccess
                                  ? '생성 완료'
                                  : '완료'
                    }
                >
                    {stepContent}
                </OnboardingStepLayout>
            </div>
        </div>
    );
}

export default OnboardingWardCreatePage;
