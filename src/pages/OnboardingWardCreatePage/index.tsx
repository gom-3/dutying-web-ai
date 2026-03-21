import Card from '@/shared/ui/Card';
import HeaderLogo from './components/HeaderLogo';
import OnboardingStepLayout from './components/OnboardingStepLayout';
import SectionHeader from './components/SectionHeader';
import NurseStep from './components/steps/NurseStep';
import ShiftTypeStep from './components/steps/ShiftTypeStep';
import SkillLevelModal from './components/steps/SkillLevelModal';
import UploadStep from './components/steps/UploadStep';
import useOnboardingWardWizard from './hooks/useOnboardingWardWizard';

function OnboardingWardCreatePage() {
    const {
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
        canGoNext,
        canComplete,
    } = useOnboardingWardWizard();
    const stepContent = (() => {
        switch (draft.currentStep) {
            case 1:
                return <UploadStep draft={draft} onUpload={(file) => uploadMockFile(file.name)} />;
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
                    onNext={draft.currentStep < 4 ? goNextStep : complete}
                    nextDisabled={draft.currentStep < 4 ? !canGoNext : !canComplete}
                >
                    {stepContent}
                </OnboardingStepLayout>
                {completedPayload ? (
                    <Card className="mt-10">
                        <p className="mb-4 font-apple text-[20px] font-semibold text-text-1">Mock CreateWard Payload</p>
                        <pre
                            data-testid="mock-create-ward-payload"
                            className="overflow-auto rounded-[10px] bg-gray-7 p-4 text-sm text-sub-1"
                        >
                            {completedPayload}
                        </pre>
                    </Card>
                ) : null}
            </div>
        </div>
    );
}

export default OnboardingWardCreatePage;
