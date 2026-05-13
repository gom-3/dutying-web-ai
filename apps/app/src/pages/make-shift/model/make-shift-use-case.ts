import {useCallback} from 'react';
import {useShiftEditorCommands, useShiftEditorStore} from '@/features/shift-editor';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {showValidationFeedback} from '@/shared/util/feedback';
import {clearMakeShiftProgress, loadDraftStep, saveMaxReachedStep} from './make-shift-progress-storage';
import {canGoNext, canGoPrev, clearPersistedStep, loadPersistedStep, useMakeShiftStore, type TMakeShiftStep} from './make-shift-store';

export function useMakeShiftUseCase() {
    const {t} = useTypedTranslation();
    const editor = useShiftEditorCommands();
    const startFromStep = useMakeShiftStore((s) => s.startFromStep);
    const closeRestoreDraftModal = useMakeShiftStore((s) => s.closeRestoreDraftModal);
    const resetToOverview = useMakeShiftStore((s) => s.resetToOverview);
    const goPrev = useMakeShiftStore((s) => s.goPrev);
    const goNext = useMakeShiftStore((s) => s.goNext);
    const goToStep = useMakeShiftStore((s) => s.goToStep);
    const requestReload = useMakeShiftStore((s) => s.requestReload);
    const clearProgressState = useCallback(() => {
        const s = useMakeShiftStore.getState();

        if (s.wardId && s.currentShiftTeamId) {
            clearMakeShiftProgress(s.wardId, s.currentShiftTeamId, s.year, s.month);
        }

        clearPersistedStep();
    }, []);

    const start = useCallback(() => {
        const s = useMakeShiftStore.getState();

        if (s.shiftStatus === 'success' && s.shiftFullyAssigned) {
            showValidationFeedback(t('page.makeShift.overview.fullyAssignedCantStart'));

            return;
        }

        const persisted = editor.getPersisted();
        const saved =
            s.wardId && s.currentShiftTeamId
                ? loadDraftStep(s.wardId, s.currentShiftTeamId, s.year, s.month) ?? loadPersistedStep()
                : loadPersistedStep();
        const step = saved ?? 1;

        startFromStep({step, openRestoreDraftModal: persisted !== null});
    }, [editor, startFromStep, t]);
    const confirmRestoreDraft = useCallback(() => {
        const persisted = editor.getPersisted();

        if (persisted) editor.hydrate(persisted);

        closeRestoreDraftModal();
    }, [closeRestoreDraftModal, editor]);
    const declineRestoreDraft = useCallback(() => {
        editor.discardPersisted();
        const s = useMakeShiftStore.getState();

        if (s.wardId && s.currentShiftTeamId) {
            clearMakeShiftProgress(s.wardId, s.currentShiftTeamId, s.year, s.month);
            saveMaxReachedStep(s.wardId, s.currentShiftTeamId, s.year, s.month, 1);
        }

        clearPersistedStep();
        useMakeShiftStore.setState({maxReachedStep: 1});
        goToStep(1);
        closeRestoreDraftModal();
    }, [closeRestoreDraftModal, editor, goToStep]);
    const complete = useCallback(() => {
        clearProgressState();
        editor.discardPersisted();
        resetToOverview();
    }, [clearProgressState, editor, resetToOverview]);
    const prev = useCallback(() => {
        const s = useMakeShiftStore.getState();

        if (!canGoPrev(s)) return;

        goPrev();
    }, [goPrev]);
    const next = useCallback(() => {
        const s = useMakeShiftStore.getState();

        if (!canGoNext(s)) return;

        goNext();
    }, [goNext]);
    const jump = useCallback(
        (step: TMakeShiftStep) => {
            const {maxReachedStep} = useMakeShiftStore.getState();

            if (step > maxReachedStep) {
                showValidationFeedback(t('page.makeShift.navigation.sequentialRequired'));

                return;
            }

            goToStep(step);
        },
        [goToStep, t],
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
        prev,
        next,
        goToStep: jump,
        editorState,
        retryOverview,
    };
}
