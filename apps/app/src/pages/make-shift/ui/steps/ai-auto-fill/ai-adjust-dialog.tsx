import type {TScheduleAdjustInterpretRes, TScheduleMonthRequestRes} from '@dutying/api/ward';
import {X} from 'lucide-react';
import {useEffect, useLayoutEffect, useRef, type Ref} from 'react';
import {createPortal} from 'react-dom';
import divider from '@/shared/assets/images/ai-adjust/divider.svg';
import headerIcon from '@/shared/assets/images/ai-adjust/header.svg';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import AiAdjustTextInput, {type TAdjustApply, type TAdjustTextInputHandle} from './ai-adjust-text-input';
import AiMonthRequestList from './ai-month-request-list';

type TProps = {
    open: boolean;
    onClose: () => void;
    onRegenerate: () => void;
    hasGeneratedSchedule?: boolean;
    generationCompleted?: boolean;
    disabled: boolean;
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
    onClose,
    onRegenerate,
    hasGeneratedSchedule = false,
    generationCompleted = false,
    disabled,
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
    currentRevision,
    disablingRequestId,
    onDisableRequest,
}: TProps) {
    const {t} = useTypedTranslation();
    const panel = useRef<HTMLElement>(null);

    useLayoutEffect(() => {
        const root = document.documentElement;

        root.dataset.makeAiAdjustOpen = String(open);
        if (open) root.style.setProperty('--make-ai-adjust-sidebar-width', `${AI_ADJUST_SIDEBAR_WIDTH_PX}px`);
        else root.style.removeProperty('--make-ai-adjust-sidebar-width');

        return () => {
            delete root.dataset.makeAiAdjustOpen;
            root.style.removeProperty('--make-ai-adjust-sidebar-width');
        };
    }, [open]);

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
            <aside
                ref={panel}
                data-state={open ? 'open' : 'closed'}
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
                className="ai-adjust-sidebar pointer-events-auto absolute top-0 right-0 flex h-dvh w-[407px] max-w-full flex-col overflow-hidden border-l-[1.5px] border-gray-6 bg-white shadow-[-5px_0_30px_#ede9f5] outline-none"
            >
                <header className="relative flex h-24 shrink-0 items-center gap-3 px-[28px]">
                    <img src={headerIcon} alt="" width={36} height={36} className="shrink-0" />
                    <h2 className="text-[20px] leading-6 font-semibold text-gray-3">{t('aiAdjust.title')}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('aiAdjust.close')}
                        className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-gray-4 hover:bg-gray-7 hover:text-main-1"
                    >
                        <X className="size-[18px]" />
                    </button>
                    <img src={divider} alt="" className="absolute bottom-0 left-0 max-w-none" />
                </header>
                <AiAdjustTextInput
                    ref={textInputRef}
                    disabled={disabled}
                    generationCompleted={generationCompleted}
                    interpret={interpret}
                    onApply={onApply}
                    goalNurses={goalNurses}
                    shiftCodes={shiftCodes}
                    requests={requests}
                    requestsLoading={requestsLoading}
                    requestsError={requestsError}
                    onRetryRequests={onRetryRequests}
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
                    conversationActions={
                        hasGeneratedSchedule && (
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={onRegenerate}
                                className="px-4 text-[12px] text-gray-4 underline disabled:opacity-50"
                            >
                                {t('aiAdjust.regenerating')}
                            </button>
                        )
                    }
                />
            </aside>
        </div>,
        document.body,
    );
}
