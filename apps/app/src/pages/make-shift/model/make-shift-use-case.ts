import {useCallback} from 'react';
import {type TShift} from '@/entities';
import {getShiftEditorDraftStorageKey, useShiftEditorCommands, useShiftEditorStore} from '@/features/shift-editor';
import WardAPI from '@/shared/api/ward';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {showValidationFeedback} from '@/shared/util/feedback';
import {clearMakeShiftProgress, loadDraftStep, saveMaxReachedStep} from './make-shift-progress-storage';
import {
    canGoNext,
    canGoPrev,
    clearPersistedStep,
    hasRequiredWorkerForSchedule,
    MAKE_SHIFT_CONFIRMED_STEP,
    useMakeShiftStore,
    type TMakeShiftStep,
} from './make-shift-store';

export function useMakeShiftUseCase() {
    const {t} = useTypedTranslation();
    const editor = useShiftEditorCommands();
    const startFromStep = useMakeShiftStore((s) => s.startFromStep);
    const closeRestoreDraftModal = useMakeShiftStore((s) => s.closeRestoreDraftModal);
    const resetToOverview = useMakeShiftStore((s) => s.resetToOverview);
    const goPrev = useMakeShiftStore((s) => s.goPrev);
    const goNext = useMakeShiftStore((s) => s.goNext);
    const goToStep = useMakeShiftStore((s) => s.goToStep);
    const confirmSchedule = useMakeShiftStore((s) => s.confirmSchedule);
    const editConfirmedSchedule = useMakeShiftStore((s) => s.editConfirmedSchedule);
    const requestReload = useMakeShiftStore((s) => s.requestReload);
    const persistCurrentWorkflowStep = useCallback(() => {
        const s = useMakeShiftStore.getState();

        if (!s.wardId || !s.currentShiftTeamId || s.currentStep >= MAKE_SHIFT_CONFIRMED_STEP) return;

        void WardAPI.updateShiftWorkflow(s.wardId, s.currentShiftTeamId, s.year, s.month, {
            workflowStatus: 'IN_PROGRESS',
            workflowStep: s.currentStep,
        }).catch(() => undefined);
    }, []);
    const syncEditorPersistenceKey = useCallback(() => {
        const s = useMakeShiftStore.getState();

        if (!s.wardId || !s.currentShiftTeamId) return s;

        editor.setPersistenceKey(
            getShiftEditorDraftStorageKey({
                wardId: s.wardId,
                shiftTeamId: s.currentShiftTeamId,
                year: s.year,
                month: s.month,
            }),
        );

        return s;
    }, [editor]);
    const clearProgressState = useCallback(() => {
        const s = useMakeShiftStore.getState();

        if (s.wardId && s.currentShiftTeamId) {
            clearMakeShiftProgress(s.wardId, s.currentShiftTeamId, s.year, s.month);
        }

        clearPersistedStep();
    }, []);
    const start = useCallback(() => {
        const s = syncEditorPersistenceKey();
        const persisted = editor.getPersisted();
        const saved = s.wardId && s.currentShiftTeamId ? loadDraftStep(s.wardId, s.currentShiftTeamId, s.year, s.month) : null;
        const step =
            s.shiftStatus === 'success' && s.shiftFullyAssigned
                ? MAKE_SHIFT_CONFIRMED_STEP
                : saved === MAKE_SHIFT_CONFIRMED_STEP
                  ? 1
                  : (saved ?? 1);

        startFromStep({step, openRestoreDraftModal: step === MAKE_SHIFT_CONFIRMED_STEP ? false : persisted !== null});
        persistCurrentWorkflowStep();
    }, [editor, persistCurrentWorkflowStep, startFromStep, syncEditorPersistenceKey]);
    const confirmRestoreDraft = useCallback(() => {
        syncEditorPersistenceKey();

        const persisted = editor.getPersisted();

        if (persisted) editor.hydrate(persisted);

        closeRestoreDraftModal();
    }, [closeRestoreDraftModal, editor, syncEditorPersistenceKey]);
    const declineRestoreDraft = useCallback(() => {
        syncEditorPersistenceKey();
        editor.discardPersisted();

        const s = useMakeShiftStore.getState();

        if (s.wardId && s.currentShiftTeamId) {
            clearMakeShiftProgress(s.wardId, s.currentShiftTeamId, s.year, s.month);
            saveMaxReachedStep(s.wardId, s.currentShiftTeamId, s.year, s.month, 1);
        }

        clearPersistedStep();
        useMakeShiftStore.setState({currentStep: 1, maxReachedStep: 1});
        persistCurrentWorkflowStep();
        closeRestoreDraftModal();
    }, [closeRestoreDraftModal, editor, persistCurrentWorkflowStep, syncEditorPersistenceKey]);
    const complete = useCallback(() => {
        clearProgressState();
        editor.discardPersisted();
        resetToOverview();
    }, [clearProgressState, editor, resetToOverview]);
    const confirm = useCallback(
        (shiftSnapshot?: TShift | null) => {
            confirmSchedule(shiftSnapshot);
            editor.discardPersisted();
        },
        [confirmSchedule, editor],
    );
    const editConfirmed = useCallback(() => {
        editor.discardPersisted();
        editConfirmedSchedule();
        persistCurrentWorkflowStep();
    }, [editConfirmedSchedule, editor, persistCurrentWorkflowStep]);
    const prev = useCallback(() => {
        const s = useMakeShiftStore.getState();

        if (!canGoPrev(s)) return;

        goPrev();
        persistCurrentWorkflowStep();
    }, [goPrev, persistCurrentWorkflowStep]);
    const next = useCallback(() => {
        const s = useMakeShiftStore.getState();

        if (!canGoNext(s)) {
            if (s.currentStep === 1 && !hasRequiredWorkerForSchedule(s)) {
                showValidationFeedback(t('page.makeShift.navigation.workerRequired'));
            }

            return;
        }

        goNext();
        persistCurrentWorkflowStep();
    }, [goNext, persistCurrentWorkflowStep, t]);
    const jump = useCallback(
        (step: TMakeShiftStep) => {
            const state = useMakeShiftStore.getState();
            const {currentStep, maxReachedStep} = state;

            if (currentStep === MAKE_SHIFT_CONFIRMED_STEP) return;

            if (currentStep === 1 && step > 1 && !hasRequiredWorkerForSchedule(state)) {
                showValidationFeedback(t('page.makeShift.navigation.workerRequired'));

                return;
            }

            if (step > maxReachedStep) {
                showValidationFeedback(t('page.makeShift.navigation.sequentialRequired'));

                return;
            }

            goToStep(step);
            persistCurrentWorkflowStep();
        },
        [goToStep, persistCurrentWorkflowStep, t],
    );
    const closeModal = useCallback(() => {
        closeRestoreDraftModal();
    }, [closeRestoreDraftModal]);
    const retryOverview = useCallback(() => {
        requestReload();
    }, [requestReload]);
    // make-shift 단계에서 에디터 state가 필요할 때 대비 (예: 완료 조건 체크)
    const editorState = {
        doc: useShiftEditorStore((s) => s.doc),
        history: useShiftEditorStore((s) => s.history),
        selection: useShiftEditorStore((s) => s.selection),
    };

    return {
        start,
        confirmRestoreDraft,
        declineRestoreDraft,
        closeRestoreDraftModal: closeModal,
        complete,
        confirm,
        editConfirmed,
        prev,
        next,
        goToStep: jump,
        editorState,
        retryOverview,
    };
}
