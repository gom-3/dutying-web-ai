import {useCallback} from 'react';
import {useShiftEditorCommands, useShiftEditorStore} from '@/features/shift-editor';
import {canGoNext, canGoPrev, clearPersistedStep, loadPersistedStep, useMakeShiftStore, type TMakeShiftStep} from './make-shift-store';

export function useMakeShiftUseCase() {
    const editor = useShiftEditorCommands();
    const startFromStep = useMakeShiftStore((s) => s.startFromStep);
    const closeRestoreDraftModal = useMakeShiftStore((s) => s.closeRestoreDraftModal);
    const resetToOverview = useMakeShiftStore((s) => s.resetToOverview);
    const goPrev = useMakeShiftStore((s) => s.goPrev);
    const goNext = useMakeShiftStore((s) => s.goNext);
    const goToStep = useMakeShiftStore((s) => s.goToStep);
    const requestReload = useMakeShiftStore((s) => s.requestReload);
    const start = useCallback(() => {
        const persisted = editor.getPersisted();
        const savedStep = loadPersistedStep();

        startFromStep({step: persisted ? (savedStep ?? 1) : 1, openRestoreDraftModal: persisted !== null});
    }, [editor, startFromStep]);
    const confirmRestoreDraft = useCallback(() => {
        const persisted = editor.getPersisted();

        if (persisted) editor.hydrate(persisted);

        closeRestoreDraftModal();
    }, [closeRestoreDraftModal, editor]);
    const declineRestoreDraft = useCallback(() => {
        editor.discardPersisted();
        clearPersistedStep();
        goToStep(1);
        closeRestoreDraftModal();
    }, [closeRestoreDraftModal, editor, goToStep]);
    const complete = useCallback(() => {
        editor.discardPersisted();
        clearPersistedStep();
        resetToOverview();
    }, [editor, resetToOverview]);
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
            goToStep(step);
        },
        [goToStep],
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
