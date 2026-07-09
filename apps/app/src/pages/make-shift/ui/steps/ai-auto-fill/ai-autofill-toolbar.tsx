import {cn} from '@dutying/utils/style';
import type {AnimationItem} from 'lottie-web';
import {AlertTriangle, Check, Eye, History, Pin, PinOff, Redo2, Save, Undo2} from 'lucide-react';
import type {ReactNode} from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {BouncingDotsSlot} from '@/components/loading-ui/bouncing-dots';
import type {TAsyncScheduleValidationStatus} from '@/features/shift-editor';
import constraintValidationDotsAnimation from '@/shared/assets/animation/constraint-validation-dots.json';
import aiAutofillSparkleIcon from '@/shared/assets/images/ai-autofill-sparkle.png';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {getAiAutofillActionLabel, type TAiAutofillStatus} from '../../../model/ai-autofill-state';
import {
    MAKE_SHIFT_STEP_HEADING_BLOCK_CLASS,
    MAKE_SHIFT_STEP_SUBTITLE_CLASS,
    MAKE_SHIFT_STEP_TITLE_CLASS,
} from '../../make-shift-step-layout';

type TAiAutofillToolbarProps = {
    onFixedShiftsAttentionStart: () => void;
    onFixedShiftsAttentionEnd: () => void;
    onRequestShiftsAttentionStart: () => void;
    onRequestShiftsAttentionEnd: () => void;
    canFixSelection: boolean;
    canUnfixSelection: boolean;
    onFixSelection: () => void;
    onUnfixSelection: () => void;
    showFaults: boolean;
    onToggleFaults: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onOpenSnapshotHistory: () => void;
    onAiFill: () => void;
    isAiGenerating: boolean;
    aiStatus: TAiAutofillStatus;
    hasCompletedAiFill: boolean;
    scheduleValidationStatus: TAsyncScheduleValidationStatus;
    onConfirm: () => void;
    isConfirming: boolean;
    canConfirm: boolean;
    onSaveSnapshot: () => void;
    isSavingSnapshot: boolean;
};

const AI_ACTION_LABEL_KEYS = {
    action: 'page.makeShift.aiRefill.action',
    firstFill: 'page.makeShift.aiRefill.firstFill',
    generating: 'page.makeShift.aiRefill.generating',
    retry: 'page.makeShift.aiRefill.retry',
} as const;

export function AiAutofillToolbar({
    onFixedShiftsAttentionStart,
    onFixedShiftsAttentionEnd,
    onRequestShiftsAttentionStart,
    onRequestShiftsAttentionEnd,
    canFixSelection,
    canUnfixSelection,
    onFixSelection,
    onUnfixSelection,
    showFaults,
    onToggleFaults,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onOpenSnapshotHistory,
    onAiFill,
    isAiGenerating,
    aiStatus,
    hasCompletedAiFill,
    scheduleValidationStatus,
    onConfirm,
    isConfirming,
    canConfirm,
    onSaveSnapshot,
    isSavingSnapshot,
}: TAiAutofillToolbarProps) {
    const {t} = useTypedTranslation();
    const actionLabelKey = AI_ACTION_LABEL_KEYS[getAiAutofillActionLabel(aiStatus, hasCompletedAiFill)];
    const isValidationChecking = scheduleValidationStatus === 'validating';

    return (
        <div
            data-preserve-duty-selection="true"
            className="ai-autofill-toolbar flex w-full min-w-0 flex-nowrap items-center justify-between gap-3"
        >
            <div className={`ai-autofill-toolbar__titles ${MAKE_SHIFT_STEP_HEADING_BLOCK_CLASS}`}>
                <div className="ai-autofill-toolbar__title-row flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <h1 className={`ai-autofill-toolbar__title min-w-0 ${MAKE_SHIFT_STEP_TITLE_CLASS}`}>
                        {t('page.makeShift.aiRefill.toolbarTitle')}
                    </h1>
                    {isValidationChecking && (
                        <span
                            className={cn(
                                'ai-autofill-toolbar__validation-status inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5',
                                'font-apple text-[12px] leading-none font-semibold whitespace-nowrap',
                                'text-gray-2 bg-gray-7',
                            )}
                            aria-live="polite"
                        >
                            <ValidationCheckingLottie />
                            {t('page.makeShift.aiRefill.validationStatus.checking')}
                        </span>
                    )}
                </div>
                <p className={`ai-autofill-toolbar__subtitle ${MAKE_SHIFT_STEP_SUBTITLE_CLASS}`}>
                    {t('page.makeShift.aiRefill.toolbarSubTitle')}
                </p>
            </div>

            <div
                id="make_ai_autofill_actions"
                className="ai-autofill-toolbar__actions ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-[clamp(20px,3vw,48px)] [&_button:not(:disabled)]:cursor-pointer"
            >
                <div className="ai-autofill-toolbar__utility-actions flex shrink-0 flex-nowrap items-center gap-2">
                    <div
                        id="make_ai_fixed_tools"
                        className="ai-autofill-toolbar__fixed-actions flex min-h-[43px] shrink-0 items-center gap-1 rounded-[13px] bg-gray-7 px-1"
                        aria-label={t('page.makeShift.aiRefill.fixedSelectionTools')}
                    >
                        <IconButton
                            id="make_ai_fix_selected_button"
                            className="ai-autofill-toolbar__fixed-action ai-autofill-toolbar__fixed-action--fix"
                            onClick={onFixSelection}
                            disabled={!canFixSelection || isAiGenerating}
                            ariaLabel={t('page.makeShift.aiRefill.fixSelection')}
                            title={t('page.makeShift.aiRefill.fixSelection')}
                        >
                            <Pin className="size-3.5" aria-hidden />
                        </IconButton>
                        <IconButton
                            className="ai-autofill-toolbar__fixed-action ai-autofill-toolbar__fixed-action--unfix"
                            onClick={onUnfixSelection}
                            disabled={!canUnfixSelection || isAiGenerating}
                            ariaLabel={t('page.makeShift.aiRefill.unfixSelection')}
                            title={t('page.makeShift.aiRefill.unfixSelection')}
                        >
                            <PinOff className="size-3.5" aria-hidden />
                        </IconButton>
                    </div>

                    <div
                        id="make_ai_view_tools"
                        className="ai-autofill-toolbar__view-actions flex min-h-[43px] shrink-0 items-center gap-1 rounded-[13px] bg-gray-7 px-1"
                        aria-label={t('page.makeShift.aiRefill.viewOptions')}
                    >
                        <StatusHighlightMenu
                            onFixedShiftsAttentionStart={onFixedShiftsAttentionStart}
                            onFixedShiftsAttentionEnd={onFixedShiftsAttentionEnd}
                            onRequestShiftsAttentionStart={onRequestShiftsAttentionStart}
                            onRequestShiftsAttentionEnd={onRequestShiftsAttentionEnd}
                        />

                        <span aria-hidden="true" className="mx-1 h-5 w-px rounded-full bg-gray-5" />

                        <IconToolButton
                            className="ai-autofill-toolbar__icon-tool ai-autofill-toolbar__icon-tool--faults"
                            active={showFaults}
                            onClick={onToggleFaults}
                            ariaLabel={t(
                                showFaults ? 'page.makeShift.aiRefill.violationsShown' : 'page.makeShift.aiRefill.violationsHidden',
                            )}
                            activeClassName="bg-white text-[#B86E00] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                            inactiveClassName="text-gray-3 hover:bg-white hover:text-[#B86E00]"
                        >
                            <AlertTriangle className="size-3.5" aria-hidden />
                        </IconToolButton>
                    </div>

                    <span id="make_ai_history_tools" className="ai-autofill-toolbar__history flex min-h-[43px] items-center gap-2">
                        <span
                            id="make_ai_history_undo_redo_tools"
                            className="ai-autofill-toolbar__history-group ai-autofill-toolbar__history-group--undo-redo flex min-h-[43px] items-center gap-1 rounded-[13px] bg-gray-7 px-1"
                        >
                            <IconButton className="ai-autofill-toolbar__history-undo" onClick={onUndo} disabled={!canUndo} ariaLabel="Undo">
                                <Undo2 className="size-3.5" aria-hidden />
                            </IconButton>
                            <IconButton className="ai-autofill-toolbar__history-redo" onClick={onRedo} disabled={!canRedo} ariaLabel="Redo">
                                <Redo2 className="size-3.5" aria-hidden />
                            </IconButton>
                        </span>

                        <span
                            id="make_ai_history_snapshot_tools"
                            className="ai-autofill-toolbar__history-group ai-autofill-toolbar__history-group--snapshots flex min-h-[43px] items-center gap-1 rounded-[13px] bg-gray-7 px-1"
                        >
                            <IconButton
                                className="ai-autofill-toolbar__history-save"
                                onClick={onSaveSnapshot}
                                disabled={isSavingSnapshot}
                                ariaBusy={isSavingSnapshot}
                                ariaLabel={t(
                                    isSavingSnapshot ? 'page.makeShift.aiRefill.savingSnapshot' : 'page.makeShift.aiRefill.saveSnapshot',
                                )}
                            >
                                <BouncingDotsSlot active={isSavingSnapshot} className="w-5 shrink-0 text-main-1" />
                                <Save className={cn('size-3.5', isSavingSnapshot && 'hidden')} strokeWidth={2.2} aria-hidden />
                            </IconButton>
                            <IconButton
                                className="ai-autofill-toolbar__history-snapshots"
                                onClick={onOpenSnapshotHistory}
                                ariaLabel={t('page.makeShift.aiRefill.snapshotSidebar.title')}
                            >
                                <History className="size-3.5" aria-hidden />
                            </IconButton>
                        </span>
                    </span>
                </div>

                <div className="ai-autofill-toolbar__primary-actions flex shrink-0 flex-nowrap items-center gap-2">
                    <button
                        id="make_ai_fill_button"
                        type="button"
                        onClick={onAiFill}
                        disabled={isAiGenerating}
                        aria-busy={isAiGenerating}
                        className={cn(
                            'ai-autofill-toolbar__cta ai-autofill-toolbar__cta--ai-fill group isolate',
                            'relative inline-flex min-h-[43px] min-w-[142px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-[13px] px-4 py-0',
                            'bg-[linear-gradient(90deg,#C241F4_0%,#6B45F4_100%)] font-apple text-[13px] leading-none font-bold whitespace-nowrap text-white',
                            'shadow-[0_8px_22px_rgba(107,69,244,0.2)] transition-[box-shadow,filter,transform] duration-300 ease-out',
                            'enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_14px_34px_rgba(107,69,244,0.32),0_0_0_1px_rgba(255,255,255,0.16)_inset] enabled:hover:brightness-105',
                            'focus-visible:ring-2 focus-visible:ring-[#A978FF] focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.99] active:brightness-95',
                            'disabled:cursor-wait disabled:opacity-100',
                            isAiGenerating && 'shadow-[0_0_0_3px_rgba(169,120,255,0.24),0_8px_22px_rgba(107,69,244,0.2)]',
                        )}
                    >
                        {!isAiGenerating && (
                            <>
                                <span
                                    aria-hidden
                                    className="pointer-events-none absolute -inset-6 z-0 translate-y-3 scale-90 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.52),rgba(216,180,254,0.2)_34%,transparent_62%)] opacity-0 blur-xl transition-[opacity,transform] duration-500 ease-out group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 motion-reduce:transition-none"
                                />
                                <span
                                    aria-hidden
                                    className="pointer-events-none absolute top-[-60%] bottom-[-60%] left-[-30%] z-0 w-10 -translate-x-[180%] rotate-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.58),transparent)] opacity-0 blur-[6px] transition-[opacity,transform] duration-700 ease-out group-hover:translate-x-[520%] group-hover:opacity-100 motion-reduce:transition-none"
                                />
                            </>
                        )}
                        {isAiGenerating && (
                            <span
                                aria-hidden
                                className="pointer-events-none absolute inset-0 z-0 rounded-[13px] bg-white/12 motion-safe:animate-pulse"
                            />
                        )}
                        <BouncingDotsSlot active={isAiGenerating} className="relative z-10 w-5 shrink-0 text-white" />
                        <img
                            src={aiAutofillSparkleIcon}
                            alt=""
                            aria-hidden
                            className={cn('relative z-10 size-4 shrink-0 object-contain', isAiGenerating && 'hidden')}
                        />
                        <span className="relative z-10 truncate">{t(actionLabelKey)}</span>
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={!canConfirm}
                        aria-busy={isConfirming}
                        className={cn(
                            'ai-autofill-toolbar__cta ai-autofill-toolbar__cta--confirm',
                            'inline-flex min-h-[43px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[13px] bg-[#20A66A] px-4 py-0',
                            'font-apple text-[13px] leading-none font-bold whitespace-nowrap text-white transition-colors duration-150',
                            'hover:bg-[#1C925D] focus-visible:ring-2 focus-visible:ring-[#6ED7A2] focus-visible:ring-offset-2 focus-visible:outline-none active:bg-[#167A52]',
                            'disabled:cursor-not-allowed disabled:bg-gray-5 disabled:text-white/70',
                        )}
                    >
                        <BouncingDotsSlot active={isConfirming} className="w-5 shrink-0 text-white" />
                        <Check className={cn('size-3.5', isConfirming && 'hidden')} strokeWidth={2.4} aria-hidden />
                        {isConfirming ? t('page.makeShift.navigation.saving') : t('page.makeShift.aiRefill.confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function StatusHighlightMenu({
    onFixedShiftsAttentionStart,
    onFixedShiftsAttentionEnd,
    onRequestShiftsAttentionStart,
    onRequestShiftsAttentionEnd,
}: {
    onFixedShiftsAttentionStart: () => void;
    onFixedShiftsAttentionEnd: () => void;
    onRequestShiftsAttentionStart: () => void;
    onRequestShiftsAttentionEnd: () => void;
}) {
    const {t} = useTypedTranslation();
    const rootRef = useRef<HTMLSpanElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const [open, setOpen] = useState(false);
    const closeMenu = useCallback(() => {
        setOpen(false);
        onFixedShiftsAttentionEnd();
        onRequestShiftsAttentionEnd();
    }, [onFixedShiftsAttentionEnd, onRequestShiftsAttentionEnd]);
    const toggleMenu = useCallback(() => {
        setOpen((current) => {
            if (current) {
                onFixedShiftsAttentionEnd();
                onRequestShiftsAttentionEnd();
            }

            return !current;
        });
    }, [onFixedShiftsAttentionEnd, onRequestShiftsAttentionEnd]);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;

            if (target instanceof Node && rootRef.current?.contains(target)) return;

            closeMenu();
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;

            event.stopPropagation();
            closeMenu();
            triggerRef.current?.focus();
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [closeMenu, open]);

    return (
        <span
            ref={rootRef}
            className="ai-autofill-toolbar__status-highlight-tools relative inline-grid size-9 shrink-0 place-items-center"
            aria-label={t('page.makeShift.aiRefill.statusHighlightTools')}
            onBlur={(event) => {
                if (!open) return;

                const nextFocused = event.relatedTarget;

                if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) return;

                closeMenu();
            }}
        >
            <button
                ref={triggerRef}
                type="button"
                onClick={toggleMenu}
                aria-label={t('page.makeShift.aiRefill.statusHighlightTools')}
                aria-haspopup="menu"
                aria-expanded={open}
                className={cn(
                    'peer grid size-9 cursor-pointer place-items-center rounded-[10px] text-gray-3',
                    'transition-[color,background-color,box-shadow,transform] duration-150',
                    'hover:bg-white hover:text-main-1 focus-visible:ring-2 focus-visible:ring-main-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    open && 'bg-white text-main-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
                )}
            >
                <Eye className="size-3.5" aria-hidden />
            </button>

            {!open && (
                <span
                    role="tooltip"
                    className={cn(
                        'pointer-events-none absolute top-[calc(100%+7px)] left-1/2 z-50 -translate-x-1/2 -translate-y-1',
                        'rounded-full bg-[#111827] px-2.5 py-1.5 font-apple text-[11px] leading-none font-semibold whitespace-nowrap text-white',
                        'opacity-0 shadow-[0_6px_18px_rgba(15,23,42,0.18)] transition-[opacity,transform] duration-150 ease-out',
                        'peer-hover:translate-y-0 peer-hover:opacity-100 peer-focus-visible:translate-y-0 peer-focus-visible:opacity-100',
                    )}
                >
                    {t('page.makeShift.aiRefill.statusHighlightTools')}
                </span>
            )}

            {open && (
                <span
                    role="menu"
                    aria-label={t('page.makeShift.aiRefill.statusHighlightTools')}
                    className={cn(
                        'absolute top-[calc(100%+8px)] left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-[13px] border border-gray-6 bg-white p-1',
                        'shadow-[0_14px_32px_rgba(15,23,42,0.16)]',
                    )}
                >
                    <IconToolButton
                        className="ai-autofill-toolbar__icon-tool ai-autofill-toolbar__icon-tool--requests"
                        onClick={onRequestShiftsAttentionStart}
                        onAttentionStart={onRequestShiftsAttentionStart}
                        onAttentionEnd={onRequestShiftsAttentionEnd}
                        ariaLabel={t('page.makeShift.aiRefill.requestDisplayHighlight')}
                        tooltip={t('page.makeShift.aiRefill.requestDisplay')}
                        activeClassName="text-[#2877CC] hover:bg-gray-7 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                    >
                        <img src="/img/navigation/request-active.png" alt="" className="size-4 object-contain" aria-hidden />
                    </IconToolButton>

                    <IconToolButton
                        className="ai-autofill-toolbar__icon-tool ai-autofill-toolbar__icon-tool--fixed"
                        onClick={onFixedShiftsAttentionStart}
                        onAttentionStart={onFixedShiftsAttentionStart}
                        onAttentionEnd={onFixedShiftsAttentionEnd}
                        ariaLabel={t('page.makeShift.aiRefill.fixedDisplayHighlight')}
                        tooltip={t('page.makeShift.aiRefill.fixedDisplay')}
                        activeClassName="text-sub-1 hover:bg-gray-7 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                    >
                        <Pin className="size-3.5" aria-hidden />
                    </IconToolButton>
                </span>
            )}
        </span>
    );
}

function ValidationCheckingLottie() {
    const containerRef = useRef<HTMLSpanElement | null>(null);
    const animationRef = useRef<AnimationItem | null>(null);
    const [isAnimationReady, setIsAnimationReady] = useState(false);

    useEffect(() => {
        let isDisposed = false;

        if (!containerRef.current) return;

        if (import.meta.env.MODE === 'test') return;

        void import('lottie-web/build/player/lottie_light').then(({default: lottiePlayer}) => {
            if (isDisposed || !containerRef.current) return;

            const animation = lottiePlayer.loadAnimation({
                container: containerRef.current,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                animationData: constraintValidationDotsAnimation,
                rendererSettings: {
                    preserveAspectRatio: 'xMidYMid meet',
                },
            });

            animationRef.current = animation;
            setIsAnimationReady(true);
        });

        return () => {
            isDisposed = true;
            animationRef.current?.destroy();
            animationRef.current = null;
        };
    }, []);

    return (
        <span aria-hidden className="relative inline-block size-4 shrink-0 overflow-hidden">
            <span
                className={cn(
                    'absolute inset-0 flex items-center justify-center gap-[2px] transition-opacity duration-150',
                    isAnimationReady ? 'opacity-0' : 'opacity-100',
                )}
            >
                <span className="size-1 rounded-full bg-current opacity-50" />
                <span className="size-1 rounded-full bg-current opacity-75" />
                <span className="size-1 rounded-full bg-current opacity-50" />
            </span>
            <span ref={containerRef} className="absolute inset-0 block size-full" />
        </span>
    );
}

function IconToolButton({
    active = true,
    onClick,
    onAttentionStart,
    onAttentionEnd,
    ariaLabel,
    tooltip,
    className,
    activeClassName,
    inactiveClassName = 'text-gray-3',
    children,
}: {
    active?: boolean;
    onClick: () => void;
    onAttentionStart?: () => void;
    onAttentionEnd?: () => void;
    ariaLabel: string;
    tooltip?: string;
    className?: string;
    activeClassName?: string;
    inactiveClassName?: string;
    children: ReactNode;
}) {
    return (
        <span className="group relative inline-grid size-9 shrink-0 place-items-center">
            <button
                type="button"
                onClick={onClick}
                onPointerEnter={onAttentionStart}
                onPointerLeave={onAttentionEnd}
                onFocus={onAttentionStart}
                onBlur={onAttentionEnd}
                aria-label={ariaLabel}
                aria-pressed={active}
                className={cn(
                    'grid size-9 cursor-pointer place-items-center rounded-[10px]',
                    'transition-[color,background-color,box-shadow,transform] duration-150',
                    'focus-visible:ring-2 focus-visible:ring-main-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    active ? activeClassName : inactiveClassName,
                    className,
                )}
            >
                {children}
            </button>
            {tooltip && (
                <span
                    role="tooltip"
                    className={cn(
                        'pointer-events-none absolute top-[calc(100%+7px)] left-1/2 z-50 -translate-x-1/2 -translate-y-1',
                        'rounded-full bg-[#111827] px-2.5 py-1.5 font-apple text-[11px] leading-none font-semibold whitespace-nowrap text-white',
                        'opacity-0 shadow-[0_6px_18px_rgba(15,23,42,0.18)] transition-[opacity,transform] duration-150 ease-out',
                        'group-hover:translate-y-0 group-hover:opacity-100',
                    )}
                >
                    {tooltip}
                </span>
            )}
        </span>
    );
}

function IconButton({
    id,
    onClick,
    disabled,
    ariaBusy,
    ariaLabel,
    title,
    className,
    children,
}: {
    id?: string;
    onClick: () => void;
    disabled?: boolean;
    ariaBusy?: boolean;
    ariaLabel: string;
    title?: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <button
            id={id}
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-busy={ariaBusy}
            title={title}
            className={cn(
                'grid size-9 shrink-0 cursor-pointer place-items-center rounded-[10px] text-gray-3 transition-colors duration-150',
                'hover:bg-white hover:text-sub-1 focus-visible:ring-2 focus-visible:ring-main-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-3',
                className,
            )}
        >
            {children}
        </button>
    );
}
