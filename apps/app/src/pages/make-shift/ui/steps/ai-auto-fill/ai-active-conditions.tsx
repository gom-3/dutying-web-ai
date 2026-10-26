import * as Dialog from '@radix-ui/react-dialog';
import {type CSSProperties, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useImperativeHandle, type Ref} from 'react';
import toast, {resolveValue, useToaster} from 'react-hot-toast';
import {useRestEditorCopy} from '@/features/personal-rest-policy/rest-editor-copy';
import {
    SidebarRestEditor,
    type TRestEditorContext,
    type TRestEditorHandle,
    type TRestEditorState,
} from '@/features/personal-rest-policy/sidebar-rest-editor';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TResolvedRestConflict} from '../../../model/rest-conflict-settings';
import type {TAiWardCondition} from '../../../model/use-ai-active-conditions';
import {Constraints, type TConstraintsEditorHandle, type TConstraintsEditorState} from '../constraints';
import {AiConversationLoading} from './ai-conversation-loading';

export type TAiActiveCondition = {id: string; label: string; description?: string; onRemove: () => Promise<void> | void};
export type TActiveConditionsHandle = {openConditions: () => void; openRestTargets: (conflicts: TResolvedRestConflict[]) => void};
type TProps = {
    ref?: Ref<TActiveConditionsHandle>;
    restTargets?: TRestEditorContext;
    onRestTargetsApplied?: () => void;
    wardId: number;
    teamId: number;
    year: number;
    month: number;
    wardRules: TAiWardCondition[];
    aiConditions: TAiActiveCondition[];
    loading?: boolean;
    error?: boolean;
    onRetry?: () => Promise<void> | void;
    disabled?: boolean;
    /** A closed sheet or schedule preparation must not leave a body portal behind. */
    available?: boolean;
    onWardRulesApplied: () => Promise<void> | void;
    onBusyChange?: (busy: boolean) => void;
};

const emptyEditorState: TConstraintsEditorState = {dirty: false, saving: false, ready: false, count: 0};

/** The step-two editor manages ward rules; AI requests keep their own deletion path. */
export function AiActiveConditions({
    ref,
    restTargets,
    onRestTargetsApplied,
    wardId,
    teamId,
    year,
    month,
    wardRules,
    aiConditions,
    loading = false,
    error = false,
    onRetry,
    disabled = false,
    available = true,
    onWardRulesApplied,
    onBusyChange,
}: TProps) {
    const {t} = useTypedTranslation();
    const restText = useRestEditorCopy();
    const [section, setSection] = useState<'conditions' | 'rest'>('conditions');
    const [restConflicts, setRestConflicts] = useState<TResolvedRestConflict[]>([]);
    const returnFocus = useRef<HTMLElement | null>(null);
    const [restState, setRestState] = useState<TRestEditorState>({dirty: false, saving: false, ready: false, refreshPending: false});
    const restStateRef = useRef(restState);
    const restEditor = useRef<TRestEditorHandle>(null);

    restStateRef.current = restState;

    const id = useId();
    const toastId = `ai-conditions:${id}`;
    const {toasts, handlers: notificationHandlers} = useToaster({}, toastId);
    const [open, setOpen] = useState(false);
    const [discardOpen, setDiscardOpen] = useState(false);
    const [editorState, setEditorState] = useState<TConstraintsEditorState>(emptyEditorState);
    const editorStateRef = useRef(editorState);
    const editor = useRef<TConstraintsEditorHandle>(null);
    const applyPending = useRef(false);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const pending = useRef<string | null>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const popup = useRef<HTMLDivElement>(null);
    const closeButton = useRef<HTMLButtonElement>(null);
    const removalFocus = useRef<{index: number; button: HTMLButtonElement} | null>(null);
    const modalVisible = useRef(false);
    const mounted = useRef(true);
    const editorSaving = editorState.saving || restState.saving;
    const hasChanges = editorState.dirty || restState.dirty || Boolean(editorState.refreshPending) || restState.refreshPending;

    editorStateRef.current = editorState;
    modalVisible.current = open && available;

    useImperativeHandle(
        ref,
        () => ({
            openConditions: () => {
                if (!available || disabled || hasChanges || editorSaving) return;

                returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                setSection('conditions');
                setOpen(true);
            },
            openRestTargets: (conflicts) => {
                if (!available || disabled || !restTargets?.nurses.length || hasChanges || editorSaving) return;

                const targets = conflicts.filter((conflict) => restTargets.nurses.some((nurse) => nurse.nurseId === conflict.nurseId));

                if (!targets.length) return;

                returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                setRestConflicts(targets);
                setSection('rest');
                setOpen(true);
            },
        }),
        [available, disabled, restTargets, hasChanges, editorSaving],
    );

    const finishClose = useCallback(() => {
        modalVisible.current = false;
        toast.remove(toastId, toastId);
        setDiscardOpen(false);
        setOpen(false);
        setEditorState(emptyEditorState);
        setRestState({dirty: false, saving: false, ready: false, refreshPending: false});
        setRestConflicts([]);
    }, [toastId]);
    const close = useCallback(() => {
        if (editorStateRef.current.saving || restStateRef.current.saving || applyPending.current) return;

        if (editorStateRef.current.dirty || restStateRef.current.dirty) setDiscardOpen(true);
        else finishClose();
    }, [finishClose]);

    useEffect(() => {
        if (!available) finishClose();
    }, [available, finishClose]);
    useEffect(() => {
        onBusyChange?.(editorSaving);

        return () => onBusyChange?.(false);
    }, [editorSaving, onBusyChange]);

    useLayoutEffect(() => {
        if (pendingId !== null || !removalFocus.current) return;

        const {index, button} = removalFocus.current;

        removalFocus.current = null;

        if (
            !open ||
            !available ||
            (document.activeElement !== document.body && document.activeElement !== button && document.activeElement !== popup.current)
        )
            return;

        const remaining = popup.current?.querySelectorAll<HTMLButtonElement>('[data-ai-condition]:not(:disabled)');

        (remaining?.item(Math.min(index, remaining.length - 1)) ?? closeButton.current)?.focus();
    }, [aiConditions, pendingId, open, available]);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
            toast.remove(toastId, toastId);
        };
    }, [toastId]);
    useEffect(() => {
        if (disabled) toast.remove(toastId, toastId);
    }, [disabled, toastId]);

    const notify = (message: string) => {
        if (!modalVisible.current) return;

        toast.custom(
            (notification) => (
                <div
                    hidden={!notification.visible}
                    style={notification.visible ? undefined : {display: 'none'}}
                    className="flex max-w-full items-center gap-3 rounded-[12px] bg-[#333D4B] px-4 py-2 text-white"
                >
                    <p role="status" aria-live="polite" className="min-w-0 flex-1 text-[13px] leading-5 break-keep">
                        {message}
                    </p>
                    <button
                        type="button"
                        aria-label={t('aiAutofillUi.activeConditions.dismissNotification')}
                        onClick={() => toast.remove(toastId, toastId)}
                        className="grid size-[44px] shrink-0 place-items-center rounded-[8px] text-white hover:bg-[#4E5968] focus-visible:bg-[#EDE7FF] focus-visible:text-[#5931B9] focus-visible:outline-none"
                    >
                        <CloseIcon />
                    </button>
                </div>
            ),
            {id: toastId, toasterId: toastId, duration: 4000, position: 'bottom-center'},
        );
    };
    const remove = async (condition: TAiActiveCondition, button: HTMLButtonElement) => {
        if (disabled || loading || editorStateRef.current.saving || applyPending.current || pending.current !== null) return;

        pending.current = condition.id;

        if (document.activeElement === button)
            removalFocus.current = {index: aiConditions.findIndex((item) => item.id === condition.id), button};

        setPendingId(condition.id);

        try {
            await condition.onRemove();

            if (mounted.current) notify(t('aiAutofillUi.activeConditions.conditionRemoved'));
        } catch {
            if (mounted.current) notify(t('aiAutofillUi.activeConditions.couldNotRemoveThisConditionPleaseTryAgain'));
        } finally {
            pending.current = null;

            if (mounted.current) setPendingId(null);
        }
    };
    const count = wardRules.length + aiConditions.length;
    const summary = t('aiAutofillUi.activeConditions.conditions', {count});
    const controlDisabled = disabled || loading || pendingId !== null || editorSaving;
    const showAiOrigin = new Set(aiConditions.map((condition) => condition.description)).size > 1;
    const apply = async () => {
        if (controlDisabled || applyPending.current || (section === 'rest' ? !restEditor.current : !editor.current)) return;

        applyPending.current = true;

        try {
            const applied = section === 'rest' ? await restEditor.current!.apply() : await editor.current!.apply();

            if (applied) {
                if (section === 'rest') onRestTargetsApplied?.();

                finishClose();
            }
        } catch {
            notify(t('aiAutofillUi.activeConditions.couldNotApplyChangesPleaseTryAgain'));
        } finally {
            applyPending.current = false;
        }
    };

    return (
        <Dialog.Root
            open={open && available}
            onOpenChange={(next) => {
                if (next) {
                    returnFocus.current = null;
                    setSection('conditions');
                    setOpen(true);
                } else close();
            }}
        >
            <section className="ai-active-conditions min-w-0" data-preserve-duty-selection="true">
                <Dialog.Trigger asChild>
                    <button
                        ref={trigger}
                        type="button"
                        aria-describedby={`${id}-count`}
                        aria-haspopup="dialog"
                        aria-expanded={open && available}
                        aria-controls={`${id}-list`}
                        disabled={!available}
                        className="group flex min-h-[52px] w-full items-center gap-3 rounded-[12px] bg-[#F0EBFF] px-4 py-4 text-left text-[#5931B9] transition-colors hover:bg-[#E6DEFF] focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40 motion-reduce:transition-none"
                    >
                        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[20px] shrink-0 max-[280px]:hidden" fill="currentColor">
                            <path d="M2 4h16v2H2zm0 5h16v2H2zm0 5h16v2H2z" />
                            <path d="M5 2h3v6H5zm7 5h3v6h-3zm-6 5h3v6H6z" />
                        </svg>
                        <span className="min-w-0 flex-1 text-[14px] leading-[22px] font-semibold [overflow-wrap:anywhere] break-keep">
                            {t('aiAutofillUi.activeConditions.viewActiveConstraints')}
                        </span>
                        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[18px] shrink-0" fill="currentColor">
                            <path d="m7 3 7 7-7 7-1.4-1.4L11.2 10 5.6 4.4z" />
                        </svg>
                    </button>
                </Dialog.Trigger>
                <span id={`${id}-count`} className="sr-only">
                    {summary}
                </span>
                <div role="separator" className="mt-5 mb-3 h-px w-full bg-[#E5E8EB]" />
            </section>
            <Dialog.Portal>
                <Dialog.Overlay
                    data-testid="ai-conditions-overlay"
                    className="fixed inset-0 z-[1550] flex items-center justify-center bg-[#121726]/55 p-4"
                >
                    <Dialog.Content
                        ref={popup}
                        id={`${id}-list`}
                        aria-modal="true"
                        data-preserve-duty-selection="true"
                        style={{'--spacing': '0.225rem', '--text-sm': '0.8125rem', '--text-base': '0.90625rem'} as CSSProperties}
                        onOpenAutoFocus={(event) => {
                            event.preventDefault();
                            closeButton.current?.focus();
                        }}
                        onCloseAutoFocus={(event) => {
                            event.preventDefault();

                            const target = returnFocus.current?.isConnected ? returnFocus.current : trigger.current;

                            returnFocus.current = null;

                            if (available && target?.isConnected) target.focus();
                        }}
                        onEscapeKeyDown={(event) => {
                            if (popup.current?.querySelector('[data-constraint-layer-open="true"]')) {
                                event.preventDefault();

                                return;
                            }

                            event.stopPropagation();

                            if (editorStateRef.current.saving || restStateRef.current.saving || applyPending.current)
                                event.preventDefault();
                        }}
                        onInteractOutside={(event) => {
                            if (editorStateRef.current.saving || restStateRef.current.saving || applyPending.current)
                                event.preventDefault();
                        }}
                        onKeyDown={(event) => {
                            // Keep modal key presses out of the calendar and chat shortcuts.
                            event.stopPropagation();
                        }}
                        className={`ai-conditions-modal relative flex max-h-[min(86dvh,780px)] w-full ${section === 'rest' ? 'max-w-[480px]' : 'max-w-[960px]'} min-w-0 flex-col overflow-x-hidden overflow-y-auto rounded-[20px] bg-white text-[14px] focus-visible:outline-none`}
                    >
                        <header className="flex shrink-0 items-center justify-between gap-3 pt-5 pr-4 pb-4 pl-6 sm:pl-7">
                            <div className="min-w-0 pt-1">
                                <Dialog.Title className="text-[22px] leading-8 font-semibold tracking-[-0.02em] text-[#242B36]">
                                    {section === 'rest' ? restText.tab : t('aiAutofillUi.activeConditions.constraints')}
                                </Dialog.Title>
                                <Dialog.Description className="sr-only">
                                    {section === 'rest'
                                        ? restText.next
                                        : t('aiAutofillUi.activeConditions.editAndApplyConstraintsOrRemoveConditionsAddedThroughAi')}
                                </Dialog.Description>
                            </div>
                            <button
                                ref={closeButton}
                                type="button"
                                aria-label={t('aiAutofillUi.activeConditions.closeConditions')}
                                onClick={close}
                                disabled={editorSaving}
                                className="grid size-[44px] shrink-0 place-items-center rounded-[10px] text-[#667085] hover:bg-[#F3F5F7] hover:text-[#333D4B] focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none"
                            >
                                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[16px]" fill="currentColor">
                                    <path d="m5.4 4 4.6 4.6L14.6 4 16 5.4 11.4 10l4.6 4.6-1.4 1.4-4.6-4.6L5.4 16 4 14.6 8.6 10 4 5.4z" />
                                </svg>
                            </button>
                        </header>
                        <div
                            className={`${section === 'rest' ? 'flex-1' : ''} min-h-[min(120px,24dvh)] overflow-y-auto overscroll-contain px-6 pb-5 [overflow-wrap:anywhere] sm:px-7`}
                        >
                            {section === 'conditions' && loading && (
                                <AiConversationLoading label={t('aiAutofillUi.activeConditions.loadingConditions')} className="mb-2" />
                            )}
                            {section === 'conditions' && error && (
                                <div className="mb-3 flex flex-wrap items-center gap-2 py-2">
                                    <p role="alert" className="min-w-0 flex-1 text-[13px] leading-5 text-[#667085]">
                                        {t('aiAutofillUi.activeConditions.couldNotLoadConditions')}
                                    </p>
                                    <button
                                        type="button"
                                        disabled={disabled || loading || !onRetry}
                                        onClick={() => {
                                            void Promise.resolve()
                                                .then(() => onRetry?.())
                                                .catch(() => notify(t('aiAutofillUi.activeConditions.couldNotLoadConditions')));
                                        }}
                                        className="min-h-[44px] shrink-0 rounded-[8px] px-3 text-[13px] font-medium text-main-1 hover:bg-main-light focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40"
                                    >
                                        {t('aiAutofillUi.activeConditions.retry')}
                                    </button>
                                </div>
                            )}
                            {section === 'rest' && restTargets ? (
                                <SidebarRestEditor
                                    key={`${wardId}:${teamId}:${year}:${month}:${restConflicts.map((conflict) => conflict.nurseId).join(',')}`}
                                    conflicts={restConflicts}
                                    shiftTypes={restTargets.shiftTypes}
                                    year={year}
                                    month={month}
                                    disabled={disabled || pendingId !== null}
                                    editorRef={restEditor}
                                    onStateChange={setRestState}
                                    onApplied={onWardRulesApplied}
                                />
                            ) : (
                                <>
                                    <section aria-label={t('aiAutofillUi.activeConditions.conditionsFromTheConditionsTab')}>
                                        <Constraints
                                            key={`${wardId}:${teamId}:${year}:${month}`}
                                            variant="dialog"
                                            wardId={wardId}
                                            shiftTeamId={teamId}
                                            year={year}
                                            month={month}
                                            editorRef={editor}
                                            onEditorStateChange={setEditorState}
                                            onApplied={onWardRulesApplied}
                                            disabled={disabled || pendingId !== null}
                                        />
                                    </section>
                                    <section
                                        aria-label={t('aiAutofillUi.activeConditions.conditionsAddedWithAi')}
                                        className="mt-5 rounded-[18px] bg-[#F8F9FB] px-3 pt-4 pb-5"
                                    >
                                        <header className="mb-3 flex flex-wrap items-center justify-between gap-2 px-3">
                                            <h3 className="text-[13px] leading-5 font-semibold text-[#667085]">
                                                {t('aiAutofillUi.activeConditions.aiRequests')}{' '}
                                                <span className="ml-1">{aiConditions.length}</span>
                                            </h3>
                                            <span className="text-[12px] leading-5 text-[#667085]">
                                                {t('aiAutofillUi.activeConditions.removeOnly')}
                                            </span>
                                        </header>
                                        {aiConditions.length ? (
                                            <ul className="space-y-2.5">
                                                {aiConditions.map((condition) => (
                                                    <li
                                                        key={condition.id}
                                                        className="flex min-w-0 items-start gap-3 rounded-[10px] bg-white px-3 py-2.5"
                                                    >
                                                        <div className="min-w-0 flex-1 pt-[10px] pl-2">
                                                            <p className="text-[15px] leading-6 break-words text-[#333D4B]">
                                                                {condition.label}
                                                            </p>
                                                            {showAiOrigin && condition.description && (
                                                                <p className="mt-1 text-[12px] leading-5 text-[#667085]">
                                                                    {condition.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            data-ai-condition={condition.id}
                                                            aria-label={t('aiAutofillUi.activeConditions.remove', {label: condition.label})}
                                                            aria-busy={pendingId === condition.id}
                                                            disabled={controlDisabled}
                                                            onClick={(event) => {
                                                                void remove(condition, event.currentTarget);
                                                            }}
                                                            className="grid size-[44px] shrink-0 place-items-center rounded-[10px] text-[#667085] transition-colors hover:bg-[#FFF1F0] hover:text-[#C83F36] focus-visible:bg-[#C83F36] focus-visible:text-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                                                        >
                                                            <TrashIcon />
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : !loading && !error ? (
                                            <p className="rounded-[10px] bg-white px-4 py-5 text-center text-[13px] leading-5 text-[#667085]">
                                                {t('aiAutofillUi.activeConditions.noAiConditionsAdded')}
                                            </p>
                                        ) : null}
                                    </section>
                                </>
                            )}
                        </div>
                        {toasts.some((item) => item.visible) && (
                            <div
                                className="shrink-0 space-y-2 px-6 pb-4 sm:px-7"
                                onMouseEnter={notificationHandlers.startPause}
                                onMouseLeave={notificationHandlers.endPause}
                            >
                                {toasts
                                    .filter((item) => item.visible)
                                    .map((item) => (
                                        <div key={item.id}>{resolveValue(item.message, item)}</div>
                                    ))}
                            </div>
                        )}
                        <footer className="flex shrink-0 flex-wrap justify-end gap-2 px-6 pt-2 pb-5 sm:px-7">
                            <button
                                type="button"
                                onClick={close}
                                disabled={editorSaving}
                                className="min-h-[44px] grow rounded-[10px] bg-[#F3F5F7] px-6 py-3 text-[14px] leading-5 font-semibold text-[#475467] transition-colors hover:bg-[#E5E8EB] focus-visible:bg-[#333D4B] focus-visible:text-white focus-visible:outline-none disabled:opacity-40 motion-reduce:transition-none sm:grow-0"
                            >
                                {section === 'rest' ? restText.back : t('aiAutofillUi.activeConditions.close')}
                            </button>
                            <button
                                type="button"
                                onClick={() => void apply()}
                                disabled={
                                    controlDisabled ||
                                    (section === 'rest'
                                        ? !restState.ready || (!restState.dirty && !restState.refreshPending)
                                        : !editorState.ready || (!editorState.dirty && !editorState.refreshPending))
                                }
                                className="min-h-[44px] grow rounded-[10px] bg-main-1 px-6 py-3 text-[14px] leading-5 font-semibold text-white transition-colors hover:bg-[#5931B9] focus-visible:bg-[#4620B8] focus-visible:text-[#FFF1D6] focus-visible:outline-none disabled:opacity-40 motion-reduce:transition-none sm:grow-0"
                            >
                                {editorSaving
                                    ? t('aiAutofillUi.activeConditions.applying')
                                    : section === 'rest'
                                      ? restState.refreshPending
                                          ? restText.refresh
                                          : restText.save
                                      : editorState.refreshPending
                                        ? t('aiAutofillUi.activeConditions.retryRefresh')
                                        : t('aiAutofillUi.activeConditions.applyChanges')}
                            </button>
                        </footer>
                    </Dialog.Content>
                </Dialog.Overlay>
            </Dialog.Portal>
            <Dialog.Root open={discardOpen && open && available} onOpenChange={setDiscardOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[1600] flex items-center justify-center bg-[#121726]/55 p-4">
                        <Dialog.Content
                            role="alertdialog"
                            onKeyDown={(event) => event.stopPropagation()}
                            onEscapeKeyDown={(event) => event.stopPropagation()}
                            className="w-full max-w-[420px] rounded-[18px] bg-white p-6 focus-visible:outline-none"
                        >
                            <Dialog.Title className="text-[20px] leading-7 font-semibold text-[#242B36]">
                                {t('aiAutofillUi.activeConditions.discardChanges')}
                            </Dialog.Title>
                            <Dialog.Description className="mt-2 text-[14px] leading-6 text-[#667085]">
                                {t('aiAutofillUi.activeConditions.youHaveUnappliedConstraintChanges')}
                            </Dialog.Description>
                            <div className="mt-5 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setDiscardOpen(false)}
                                    className="min-h-[44px] grow rounded-[10px] bg-[#F3F5F7] px-4 py-3 text-[14px] font-semibold text-[#475467] focus-visible:bg-[#333D4B] focus-visible:text-white focus-visible:outline-none"
                                >
                                    {t('aiAutofillUi.activeConditions.keepEditing')}
                                </button>
                                <button
                                    type="button"
                                    onClick={finishClose}
                                    className="min-h-[44px] grow rounded-[10px] bg-[#C83F36] px-4 py-3 text-[14px] font-semibold text-white focus-visible:bg-[#982F28] focus-visible:text-[#FFF1D6] focus-visible:outline-none"
                                >
                                    {t('aiAutofillUi.activeConditions.discardChanges2')}
                                </button>
                            </div>
                        </Dialog.Content>
                    </Dialog.Overlay>
                </Dialog.Portal>
            </Dialog.Root>
        </Dialog.Root>
    );
}

function TrashIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[18px]" fill="currentColor">
            <path d="M7 2h6l1 2h3v2H3V4h3zm-2 5h10l-.7 10H5.7zM8 9v6h1V9zm3 0v6h1V9z" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[18px]" fill="currentColor">
            <path d="m5.4 4 4.6 4.6L14.6 4 16 5.4 11.4 10l4.6 4.6-1.4 1.4-4.6-4.6L5.4 16 4 14.6 8.6 10 4 5.4z" />
        </svg>
    );
}
