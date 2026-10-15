import type {TScheduleAdjustInterpretRes, TScheduleMonthRequestRes} from '@dutying/api/ward';
import {X} from 'lucide-react';
import {useEffect, useImperativeHandle, useLayoutEffect, useRef, type Ref, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import headerIcon from '@/shared/assets/images/ai-adjust/header.svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {ConfirmationSpotlight} from '@/shared/ui/ConfirmActionDialog';
import type {TAiConversationFailure} from '../../../model/ai-conversation-failure';
import type {TAdjustResultActions} from './ai-adjust-result';
import AiAdjustTextInput, {type TAdjustApply, type TAdjustTextInputHandle} from './ai-adjust-text-input';
import type {TAutofillFlow} from './ai-autofill-preparation';
import AiMonthRequestList from './ai-month-request-list';

type TProps = {
    open: boolean;
    preparation?: ReactNode;
    autofillFlow?: TAutofillFlow | null;
    onNewConversation?: () => void;
    spotlightSelector?: string;
    spotlightInteractive?: boolean;
    onClose: () => void;
    onRegenerate: () => void;
    onGenerate?: () => void;
    hasGeneratedSchedule?: boolean;
    generationCompleted?: boolean;
    generationFailure?: TAiConversationFailure | null;
    onDismissFailure?: () => void;
    disabled: boolean;
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
    preparation,
    autofillFlow,
    onNewConversation,
    spotlightSelector,
    spotlightInteractive,
    onClose,
    onRegenerate,
    onGenerate,
    hasGeneratedSchedule = false,
    generationCompleted = false,
    generationFailure,
    onDismissFailure,
    disabled,
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
    const input = useRef<TAdjustTextInputHandle>(null);
    useImperativeHandle(
        textInputRef,
        () => ({
            fill: (sentence) => input.current?.fill(sentence),
            restart: () => input.current?.restart(),
        }),
        [],
    );
    const preparing = Boolean(preparation);

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
                <header className="relative flex h-24 shrink-0 items-center gap-3 border-b border-gray-5 px-[25px]">
                    <img src={headerIcon} alt="" width={32} height={32} className="shrink-0" />
                    <h2 className="text-[18px] leading-6 font-semibold text-[#242B36]">{t('aiAdjust.title')}</h2>
                    <button
                        type="button"
                        onClick={() => input.current?.restart()}
                        className="ml-auto min-h-11 shrink-0 rounded-lg px-3 text-[13px] text-[#475467] hover:text-main-1 focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none disabled:opacity-40"
                    >
                        {t('aiAdjust.chat.restart')}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('aiAdjust.close')}
                        className="grid size-8 shrink-0 place-items-center rounded-lg text-gray-4 hover:text-main-1"
                    >
                        <X className="size-[18px]" />
                    </button>
                </header>
                <div className="flex min-h-0 flex-1 flex-col">
                    <AiAdjustTextInput
                        ref={input}
                        open={open}
                        hideRestartButton
                        preparation={preparation}
                        autofillFlow={autofillFlow}
                        onNewConversation={onNewConversation}
                        onReviewSchedule={onClose}
                        onRegenerate={hasGeneratedSchedule ? onRegenerate : onGenerate}
                        disabled={disabled}
                        modifyDisabled={modifyDisabled}
                        generationCompleted={generationCompleted}
                        generationFailure={generationFailure}
                        onDismissFailure={onDismissFailure}
                        interpret={interpret}
                        onApply={onApply}
                        goalNurses={goalNurses}
                        shiftCodes={shiftCodes}
                        requests={requests}
                        requestsLoading={requestsLoading}
                        requestsError={requestsError}
                        onRetryRequests={onRetryRequests}
                        resultActions={resultActions}
                        onUndo={onUndo}
                        currentRevision={currentRevision}
                        requestList={
                            <AiMonthRequestList
                                requests={requests}
                                disabled={disabled}
                                disablingRequestId={disablingRequestId}
                                onDisable={onDisableRequest}
                                isLoading={requestsLoading}
                                isError={requestsError}
                                onRetry={onRetryRequests}
                            />
                        }
                    />
                </div>
            </aside>
        </div>,
        document.body,
    );
}
