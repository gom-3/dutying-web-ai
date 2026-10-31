import type {TScheduleObservation} from '@dutying/api/ward';
import type {TScheduleAdjustInterpretRes, TScheduleMonthRequestRes} from '@dutying/api/ward';
import {useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import type {TShift} from '@/entities/shift';
import ROUTE from '@/shared/constant/path';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {ConfirmationSpotlight} from '@/shared/ui/ConfirmActionDialog';
import type {TAiConversationFailure} from '../../../model/ai-conversation-failure';
import {useAiActiveConditions} from '../../../model/use-ai-active-conditions';
import {AiActiveConditions, type TActiveConditionsHandle} from './ai-active-conditions';
import type {TAdjustResultActions} from './ai-adjust-result';
import AiAdjustTextInput, {type TAdjustApply, type TAdjustTextInputHandle, type TConflictReviewRenderer} from './ai-adjust-text-input';
import type {TAutofillFlow} from './ai-autofill-preparation';
import {AiConversationHeader} from './ai-conversation-header';
import AiMonthRequestList from './ai-month-request-list';
import {JourneyObserved} from './journey-observed';

type TProps = {
    open: boolean;
    loading?: boolean;
    preparation?: ReactNode;
    autofillFlow?: TAutofillFlow | null;
    historyKey?: string | null;
    onNewConversation?: () => void;
    spotlightSelector?: string;
    spotlightInteractive?: boolean;
    onClose: () => void;
    onRequestBusyChange?: (busy: boolean) => void;
    onOpenConstraints?: () => void;
    wardId?: number;
    teamId?: number;
    year?: number;
    month?: number;
    onRegenerate: (requestText?: string) => void;
    onEditSchedule?: () => void;
    onGenerate?: (requestText?: string) => void;
    onRecoverGeneration?: () => void;
    hasGeneratedSchedule?: boolean;
    generationCompleted?: boolean;
    generationCompletedMessage?: string;
    generationReviewRequired?: boolean;
    snapshotShift?: TShift;
    generationObservation?: TScheduleObservation;
    generationFailure?: TAiConversationFailure | null;
    renderConflictReview?: TConflictReviewRenderer;
    onDismissFailure?: () => void;
    disabled: boolean;
    conditionsDisabled?: boolean;
    modifyDisabled?: boolean;
    textInputRef: Ref<TAdjustTextInputHandle>;
    onPickExample: (sentence: string) => void;
    interpret: (text: string) => Promise<TScheduleAdjustInterpretRes>;
    onApply: TAdjustApply;
    goalNurses: {nurseId: number; name: string}[];
    shiftCodes?: string[];
    requests: TScheduleMonthRequestRes[];
    requestsLoading?: boolean;
    requestsError?: boolean;
    onRetryRequests?: () => void;
    resultActions?: TAdjustResultActions;
    onUndo?: (revision: number) => Promise<boolean> | boolean;
    currentRevision?: number;
    disablingRequestId: number | null;
    onDisableRequest: (request: TScheduleMonthRequestRes) => void;
};

// Reserve the sheet width once in the page frame, leaving the schedule the remaining viewport.
const AI_ADJUST_SIDEBAR_WIDTH_PX = 407;

/** Non-modal: the schedule stays visible and usable while the conversation is open. */
export default function AiAdjustDialog({
    open,
    loading = false,
    preparation,
    autofillFlow,
    historyKey,
    onNewConversation,
    spotlightSelector,
    spotlightInteractive,
    onClose,
    onRequestBusyChange,
    wardId,
    teamId,
    year,
    month,
    onRegenerate,
    onEditSchedule,
    onGenerate,
    onRecoverGeneration,
    hasGeneratedSchedule = false,
    generationCompleted = false,
    generationCompletedMessage,
    generationReviewRequired,
    snapshotShift,
    generationObservation,
    generationFailure,
    renderConflictReview,
    onDismissFailure,
    disabled,
    conditionsDisabled = disabled,
    modifyDisabled,
    textInputRef,
    interpret,
    onApply,
    goalNurses,
    shiftCodes,
    requests,
    requestsLoading,
    requestsError,
    onRetryRequests,
    onUndo,
    resultActions,
    currentRevision,
    disablingRequestId,
    onDisableRequest,
}: TProps) {
    const {t} = useTypedTranslation();
    const panel = useRef<HTMLElement>(null);
    const conditionEditor = useRef<TActiveConditionsHandle>(null);
    const input = useRef<TAdjustTextInputHandle>(null);
    const [inputBusy, setInputBusy] = useState(false);
    const [conditionEditorBusy, setConditionEditorBusy] = useState(false);
    const [conditionsVersion, setConditionsVersion] = useState(0);
    const hasConditionContext = wardId != null && teamId != null && year != null && month != null;
    const activeConditions = useAiActiveConditions({
        wardId: wardId ?? 0,
        teamId: teamId ?? 0,
        year: year ?? 0,
        month: month ?? 0,
        enabled: open && hasConditionContext,
        onChanged: async () => {
            setConditionsVersion((version) => version + 1);
            await onRetryRequests?.();
        },
    });

    useImperativeHandle(
        textInputRef,
        () => ({
            fill: (sentence) => input.current?.fill(sentence),
            restart: () => input.current?.restart(),
        }),
        [],
    );

    const preparing = Boolean(preparation);

    useEffect(() => {
        onRequestBusyChange?.(inputBusy);
    }, [inputBusy, onRequestBusyChange]);

    useEffect(() => () => onRequestBusyChange?.(false), [onRequestBusyChange]);

    useEffect(() => {
        // Execution can create saved AI requests while this sheet stays open.
        if (open && hasConditionContext) void activeConditions.reload();
    }, [requests, open, hasConditionContext, activeConditions.reload]);

    useLayoutEffect(() => {
        const root = document.documentElement;

        root.dataset.makeAiAdjustOpen = String(open);
        root.dataset.makeAiPreparing = String(open && preparing);

        if (open) root.style.setProperty('--make-ai-adjust-sidebar-width', `${AI_ADJUST_SIDEBAR_WIDTH_PX}px`);
        else root.style.removeProperty('--make-ai-adjust-sidebar-width');

        return () => {
            delete root.dataset.makeAiAdjustOpen;
            delete root.dataset.makeAiPreparing;
            root.style.removeProperty('--make-ai-adjust-sidebar-width');
        };
    }, [open, preparing]);

    useEffect(() => {
        if (!open) return;

        const previous = document.activeElement;

        panel.current?.focus();

        return () => {
            if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
        };
    }, [open]);

    // Keep the sheet above notification and ward-chat layers, outside page stacking contexts.
    return createPortal(
        <div className="pointer-events-none fixed inset-0 z-[1400] overflow-hidden">
            {open && preparation && spotlightSelector && (
                <ConfirmationSpotlight spotlightSelector={spotlightSelector} interactive={spotlightInteractive} zIndex={1399} />
            )}
            <aside
                ref={panel}
                data-state={open ? 'open' : 'closed'}
                data-preparing={preparing}
                data-loading={loading}
                aria-hidden={!open}
                inert={!open}
                role="dialog"
                aria-modal="false"
                aria-label={t('aiAdjust.title')}
                tabIndex={-1}
                onKeyDown={(event) => {
                    event.stopPropagation();

                    if (event.key === 'Escape') onClose();
                }}
                onPaste={(event) => event.stopPropagation()}
                className="ai-adjust-sidebar pointer-events-auto absolute top-0 right-0 z-[1400] flex h-dvh w-[407px] max-w-full flex-col overflow-hidden bg-white focus-visible:bg-[#FAF9FF] focus-visible:text-main-1 focus-visible:outline-none"
            >
                <AiConversationHeader
                    onNewRequest={() => input.current?.restart()}
                    onClose={onClose}
                    disabled={conditionEditorBusy || activeConditions.removingId !== null}
                />
                {hasConditionContext && (
                    <div className="shrink-0 px-[25px] pb-1">
                        <AiActiveConditions
                            ref={conditionEditor}
                            wardId={wardId!}
                            teamId={teamId!}
                            year={year!}
                            month={month!}
                            available={open && !loading && !preparing}
                            wardRules={activeConditions.wardRules}
                            aiConditions={activeConditions.requests
                                .filter((request) => request.promotedRuleId == null)
                                .map((request) => ({
                                    id: `request:${request.id}`,
                                    label: request.displayLabel,
                                    description: t('aiAutofillUi.activeConditions.savedForMonth'),
                                    onRemove: () => activeConditions.removeRequest(request.id),
                                }))}
                            loading={activeConditions.loading}
                            error={activeConditions.error}
                            onRetry={activeConditions.reload}
                            disabled={conditionsDisabled || inputBusy || preparing || conditionEditorBusy}
                            onWardRulesApplied={activeConditions.refreshAfterRuleChange}
                            onBusyChange={setConditionEditorBusy}
                        />
                    </div>
                )}
                <JourneyObserved
                    observation={generationCompleted ? generationObservation : undefined}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <AiAdjustTextInput
                        ref={input}
                        open={open}
                        hideRestartButton
                        preparation={preparation}
                        autofillFlow={autofillFlow}
                        historyKey={historyKey}
                        onNewConversation={onNewConversation}
                        onReviewSchedule={onEditSchedule ?? onClose}
                        settingsHref={teamId != null ? `${ROUTE.MEMBER}?shiftTeamId=${teamId}` : undefined}
                        onEditFailureSettings={hasConditionContext ? () => conditionEditor.current?.openConditions() : undefined}
                        onRegenerate={hasGeneratedSchedule ? onRegenerate : onGenerate}
                        onRecoverGeneration={onRecoverGeneration}
                        disabled={disabled || conditionEditorBusy || activeConditions.removingId !== null}
                        onBusyChange={setInputBusy}
                        conditionsVersion={conditionsVersion}
                        modifyDisabled={modifyDisabled}
                        generationCompleted={generationCompleted}
                        hasGeneratedSchedule={hasGeneratedSchedule}
                        generationCompletedMessage={generationCompletedMessage}
                        generationReviewRequired={generationReviewRequired}
                        snapshotShift={snapshotShift}
                        generationFailure={generationFailure}
                        renderConflictReview={renderConflictReview}
                        onDismissFailure={onDismissFailure}
                        interpret={interpret}
                        onApply={onApply}
                        goalNurses={goalNurses}
                        shiftCodes={shiftCodes}
                        requests={hasConditionContext ? activeConditions.requests : requests}
                        requestsLoading={hasConditionContext ? activeConditions.loading : requestsLoading}
                        requestsError={hasConditionContext ? activeConditions.error : requestsError}
                        onRetryRequests={hasConditionContext ? activeConditions.reload : onRetryRequests}
                        resultActions={resultActions}
                        onUndo={onUndo}
                        currentRevision={currentRevision}
                        requestList={
                            hasConditionContext ? undefined : (
                                <AiMonthRequestList
                                    requests={requests}
                                    disabled={disabled}
                                    disablingRequestId={disablingRequestId}
                                    onDisable={onDisableRequest}
                                    isLoading={requestsLoading}
                                    isError={requestsError}
                                    onRetry={onRetryRequests}
                                />
                            )
                        }
                    />
                </JourneyObserved>
            </aside>
        </div>,
        document.body,
    );
}
