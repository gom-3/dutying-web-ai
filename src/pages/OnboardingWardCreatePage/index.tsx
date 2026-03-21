import {useNavigate} from 'react-router';
import ROUTE from '@/shared/constant/path';
import Card from '@/shared/ui/Card';
import HeaderLogo from './components/HeaderLogo';
import OnboardingStepLayout from './components/OnboardingStepLayout';
import SectionHeader from './components/SectionHeader';
import NurseStep from './components/steps/NurseStep';
import ShiftTypeStep from './components/steps/ShiftTypeStep';
import SkillLevelModal from './components/steps/SkillLevelModal';
import UploadStep from './components/steps/UploadStep';
import WizardButton from './components/WizardButton';
import useOnboardingWardWizard from './hooks/useOnboardingWardWizard';

function OnboardingWardCreatePage() {
    const navigate = useNavigate();
    const {
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
        canGoNext,
        canComplete,
        submissionStatus,
        submissionError,
    } = useOnboardingWardWizard();
    const isSubmitting = submissionStatus === 'submitting';
    const isSuccess = submissionStatus === 'success';
    const stepContent = (() => {
        switch (draft.currentStep) {
            case 1:
                return <UploadStep draft={draft} onUpload={(file) => applyUploadedFile(file.name)} />;
            case 2:
                return (
                    <ShiftTypeStep
                        shiftTypes={draft.shiftTypes}
                        onChange={updateShiftType}
                        onAdd={addShiftType}
                        onDelete={deleteShiftType}
                    />
                );
            case 3:
            case 4:
                return (
                    <NurseStep
                        step={draft.currentStep}
                        draft={draft}
                        selectedTeamId={activeTeamId}
                        sortMode={sortMode}
                        onSortModeChange={setSortMode}
                        onSelectTeam={setSelectedTeamId}
                        onAddTeam={addTeam}
                        onAddNurse={addNurse}
                        onNurseChange={updateNurse}
                        onDragEnd={handleNurseDragEnd}
                        onOpenSkillModal={() => setShowSkillModal(true)}
                    />
                );
        }
    })();

    return (
        <div className="relative min-h-screen bg-main-bg">
            <HeaderLogo />
            <SkillLevelModal
                open={showSkillModal}
                config={draft.skillLevelConfig}
                onClose={() => setShowSkillModal(false)}
                onSave={saveSkillConfig}
            />
            <div className="mx-auto w-[1120px] pt-[140px] pb-20">
                <SectionHeader step={draft.currentStep} />
                <OnboardingStepLayout
                    step={draft.currentStep}
                    onSkip={skipOrComplete}
                    onPrev={goPreviousStep}
                    onNext={draft.currentStep < 4 ? goNextStep : () => void complete()}
                    nextDisabled={
                        draft.currentStep < 4 ? !canGoNext || isSubmitting || isSuccess : !canComplete || isSubmitting || isSuccess
                    }
                    actionsDisabled={isSubmitting || isSuccess}
                    nextLabel={draft.currentStep < 4 ? '다음' : isSubmitting ? '생성 중...' : isSuccess ? '생성 완료' : '완료'}
                >
                    {stepContent}
                </OnboardingStepLayout>
                {isSubmitting ? (
                    <Card data-testid="ward-create-submitting" className="mt-10 border border-main-3 bg-main-light px-6 py-5">
                        <p className="font-apple text-[20px] font-semibold text-main-1">병동을 생성하고 있어요</p>
                        <p className="mt-2 font-apple text-[16px] text-gray-3">완료되면 바로 다음 단계로 안내해드릴게요.</p>
                    </Card>
                ) : null}
                {submissionStatus === 'error' ? (
                    <Card data-testid="ward-create-error" className="mt-10 border border-[#F3C6C6] bg-[#FFF5F5] px-6 py-5">
                        <p className="font-apple text-[20px] font-semibold text-[#C55252]">병동 생성에 실패했어요</p>
                        <p className="mt-2 font-apple text-[16px] text-[#7A4F4F]">{submissionError ?? '잠시 후 다시 시도해주세요.'}</p>
                        <div className="mt-4">
                            <WizardButton disabled={isSubmitting} onClick={() => void complete()}>
                                다시 시도
                            </WizardButton>
                        </div>
                    </Card>
                ) : null}
                {isSuccess ? (
                    <Card data-testid="ward-create-success" className="mt-10 border border-[#BDE7D5] bg-[#F2FFF8] px-6 py-5">
                        <p className="font-apple text-[20px] font-semibold text-[#237A4B]">병동 생성이 완료됐어요</p>
                        <p className="mt-2 font-apple text-[16px] text-[#3A5F4C]">
                            이제 근무표를 만들 수 있도록 다음 화면으로 이동해 주세요.
                        </p>
                        <div className="mt-4">
                            <WizardButton onClick={() => navigate(ROUTE.MAKE)}>근무표 만들러 가기</WizardButton>
                        </div>
                    </Card>
                ) : null}
            </div>
        </div>
    );
}

export default OnboardingWardCreatePage;
