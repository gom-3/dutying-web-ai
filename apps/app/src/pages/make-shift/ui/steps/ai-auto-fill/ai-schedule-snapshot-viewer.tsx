import * as Dialog from '@radix-ui/react-dialog';
import {useEffect, useMemo, useRef, useState} from 'react';
import type {TShift} from '@/entities/shift';
import type {TDutyDoc} from '@/features/shift-editor/model/types';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {MakeShiftCalendar} from '../shared/make-shift-calendar';
import {AiConversationLoading} from './ai-conversation-loading';

export type TScheduleSnapshot = {doc: TDutyDoc; shift: TShift};

type TProps<TSource> = {
    after: TSource;
    before?: TSource;
    loadBefore?: () => Promise<TSource>;
    toSnapshot: (source: TSource) => TScheduleSnapshot;
    year?: number;
    month?: number;
    returnFocusTo?: HTMLElement | null;
    disabled?: boolean;
    onClose: () => void;
    onContinue?: (source: TSource) => void;
    isCurrent?: (source: TSource) => boolean;
};

/** One read-only viewer for captured local drafts and saved server versions. */
export function AiScheduleSnapshotViewer<TSource>({
    after,
    before,
    loadBefore,
    toSnapshot,
    year,
    month,
    returnFocusTo,
    disabled = false,
    onClose,
    onContinue,
    isCurrent,
}: TProps<TSource>) {
    const {t} = useTypedTranslation();
    const [showBefore, setShowBefore] = useState(false);
    const [loadedBefore, setLoadedBefore] = useState<TSource>();
    const [sourceStatus, setSourceStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [sourceAttempt, setSourceAttempt] = useState(0);
    const initiatingControl = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const comparisonBefore = before ?? loadedBefore;
    const canCompare = !!(comparisonBefore ?? loadBefore);
    const waitingForBefore = showBefore && !comparisonBefore;
    const selected = showBefore && comparisonBefore ? comparisonBefore : after;
    const {shift, doc} = useMemo(() => toSnapshot(selected), [selected, toSnapshot]);
    const violations = useMemo(() => new Map(), []);
    const modeButtonClass =
        'min-h-[44px] flex-1 rounded-lg px-3 py-2.5 text-[13px] leading-5 font-medium whitespace-nowrap text-[#667085] transition-colors hover:bg-[#EDE7FF] hover:text-[#5931B9] focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none aria-pressed:bg-[#EDE7FF] aria-pressed:font-semibold aria-pressed:text-[#5931B9] aria-pressed:focus-visible:bg-[#4620B8] aria-pressed:focus-visible:text-white motion-reduce:transition-none';
    const selectBefore = () => {
        setShowBefore(true);

        if (!comparisonBefore && sourceStatus !== 'loading') {
            setSourceStatus('loading');
            setSourceAttempt((attempt) => attempt + 1);
        }
    };

    useEffect(() => {
        if (!loadBefore || before || loadedBefore || sourceAttempt === 0) return;

        let cancelled = false;

        void loadBefore()
            .then((savedBefore) => {
                if (cancelled) return;

                setLoadedBefore(savedBefore);
                setSourceStatus('idle');
            })
            .catch(() => {
                if (!cancelled) setSourceStatus('error');
            });

        return () => {
            cancelled = true;
        };
    }, [loadBefore, before, loadedBefore, sourceAttempt]);

    return (
        <Dialog.Root
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[1500] bg-black/20" />
                <Dialog.Content
                    className="text-gray-1 fixed inset-0 z-[1501] flex flex-col bg-white outline-none"
                    onKeyDown={(event) => event.stopPropagation()}
                    onPaste={(event) => event.stopPropagation()}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();

                        const control = returnFocusTo ?? initiatingControl.current;

                        if (control?.isConnected) {
                            control.focus();
                        }
                    }}
                >
                    <header className="flex shrink-0 flex-col gap-4 px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <Dialog.Title className="text-lg leading-7 font-semibold text-[#333D4B] sm:text-xl">
                                    {year && month
                                        ? t('aiAutofillUi.scheduleSnapshotViewer.schedule', {year, month})
                                        : t('aiAutofillUi.scheduleSnapshotViewer.schedule2')}
                                </Dialog.Title>
                                <Dialog.Description className="mt-1 text-[13px] leading-5 break-keep text-[#667085]">
                                    {t('aiAutofillUi.scheduleSnapshotViewer.thisIsTheScheduleWhenThisResultWasCreatedYouCannotEditItHere')}
                                </Dialog.Description>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="min-h-[44px] shrink-0 rounded-[10px] bg-[#F2F3F6] px-4 py-2 text-[13px] font-medium text-[#475467] transition-colors hover:bg-[#EDE7FF] hover:text-[#5931B9] focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none motion-reduce:transition-none"
                            >
                                {t('aiAdjust.snapshot.close')}
                            </button>
                        </div>
                        {canCompare && (
                            <div
                                role="group"
                                aria-label={t('aiAutofillUi.scheduleSnapshotViewer.compare')}
                                className="grid grid-cols-2 gap-1 rounded-xl bg-[#F4F5F7] p-1 sm:w-fit"
                            >
                                <button type="button" aria-pressed={showBefore} onClick={selectBefore} className={modeButtonClass}>
                                    {t('aiAutofillUi.scheduleSnapshotViewer.before')}
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={!showBefore}
                                    onClick={() => setShowBefore(false)}
                                    className={modeButtonClass}
                                >
                                    {t('aiAutofillUi.scheduleSnapshotViewer.after')}
                                </button>
                            </div>
                        )}
                    </header>
                    <div className="flex min-h-0 flex-1 flex-col bg-[#F8F9FB]">
                        {!waitingForBefore && (
                            <p className="shrink-0 px-4 pt-2 pb-1 text-xs leading-5 text-[#667085] sm:hidden">
                                {t('aiAutofillUi.scheduleSnapshotViewer.swipeHorizontallyToSeeAllDates')}
                            </p>
                        )}
                        <div
                            role="region"
                            aria-label={t('aiAutofillUi.scheduleSnapshotViewer.fullSchedule')}
                            aria-busy={waitingForBefore && sourceStatus === 'loading'}
                            tabIndex={0}
                            className="min-h-0 flex-1 overflow-auto p-4 focus-visible:bg-[#EDE7FF] focus-visible:text-[#5931B9] focus-visible:outline-none sm:p-6"
                        >
                            {waitingForBefore ? (
                                <div className="flex h-full min-h-40 items-center justify-center text-center text-[13px] leading-5 text-[#667085]">
                                    {sourceStatus === 'error' ? (
                                        <div role="alert" className="space-y-3">
                                            <p>{t('aiAutofillUi.scheduleSnapshotViewer.theEarlierScheduleCouldNotBeLoaded')}</p>
                                            <button
                                                type="button"
                                                onClick={selectBefore}
                                                className="min-h-[44px] rounded-lg bg-[#EDE7FF] px-3 py-2 font-medium text-[#5931B9] hover:bg-[#E3DAFF] focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none"
                                            >
                                                {t('aiAutofillUi.scheduleSnapshotViewer.tryAgain')}
                                            </button>
                                        </div>
                                    ) : (
                                        <AiConversationLoading
                                            label={t('aiAutofillUi.scheduleSnapshotViewer.loadingEarlierSchedule')}
                                            className="justify-center"
                                        />
                                    )}
                                </div>
                            ) : (
                                <div className="[container-type:inline-size] min-w-[1000px]">
                                    <MakeShiftCalendar
                                        shift={shift}
                                        doc={doc}
                                        violationMap={violations}
                                        showFaults={false}
                                        readonly
                                        staticPreview
                                        borderlessPreview
                                        showCellStatusPins
                                        showDivisionHeaders
                                        showDivisionStatistics
                                        nurseNameMaxChars={5}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    {onContinue && !isCurrent?.(selected) && (
                        <footer className="flex shrink-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
                            <p aria-live="polite" className="text-[13px] leading-5 text-[#667085]">
                                {canCompare
                                    ? showBefore
                                        ? waitingForBefore
                                            ? t('aiAutofillUi.scheduleSnapshotViewer.youCanStillViewTheScheduleAfterChanges')
                                            : t('aiAutofillUi.scheduleSnapshotViewer.youAreViewingTheScheduleBeforeChanges')
                                        : t('aiAutofillUi.scheduleSnapshotViewer.youAreViewingTheScheduleAfterChanges')
                                    : t('aiAutofillUi.scheduleSnapshotViewer.youCanContinueWorkingFromThisResult')}
                            </p>
                            <button
                                type="button"
                                disabled={disabled || waitingForBefore}
                                onClick={() => onContinue(selected)}
                                className="min-h-[44px] w-full shrink-0 rounded-[10px] bg-main-1 px-5 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#5931D9] focus-visible:bg-[#4620B8] focus-visible:text-[#FFF1D6] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none sm:w-auto"
                            >
                                {showBefore && comparisonBefore
                                    ? t('aiAutofillUi.scheduleSnapshotViewer.continueFromTheEarlierSchedule')
                                    : t('aiAutofillUi.scheduleSnapshotViewer.continueFromThisResult')}
                            </button>
                        </footer>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
