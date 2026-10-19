import * as Dialog from '@radix-ui/react-dialog';
import {useEffect, useMemo, useRef, useState} from 'react';
import type {TShift} from '@/entities/shift';
import type {TDutyDoc} from '@/features/shift-editor/model/types';
import i18n from '@/i18n';
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
}: TProps<TSource>) {
    const {t} = useTypedTranslation();
    const [showBefore, setShowBefore] = useState(false);
    const [loadedBefore, setLoadedBefore] = useState<TSource>();
    const [sourceStatus, setSourceStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [sourceAttempt, setSourceAttempt] = useState(0);
    const initiatingControl = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const ko = i18n.language.startsWith('ko');
    const copy = (korean: string, english: string) => (ko ? korean : english);
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
                                        ? copy(`${year}년 ${month}월 근무표`, `${year} / ${month} schedule`)
                                        : copy('근무표', 'Schedule')}
                                </Dialog.Title>
                                <Dialog.Description className="mt-1 text-[13px] leading-5 break-keep text-[#667085]">
                                    {copy(
                                        '이 결과를 만든 시점의 근무표예요. 여기서는 수정할 수 없어요.',
                                        'This is the schedule when this result was created. You cannot edit it here.',
                                    )}
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
                                aria-label={copy('전후 비교', 'Compare')}
                                className="grid grid-cols-2 gap-1 rounded-xl bg-[#F4F5F7] p-1 sm:w-fit"
                            >
                                <button type="button" aria-pressed={showBefore} onClick={selectBefore} className={modeButtonClass}>
                                    {copy('변경 전', 'Before')}
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={!showBefore}
                                    onClick={() => setShowBefore(false)}
                                    className={modeButtonClass}
                                >
                                    {copy('변경 후', 'After')}
                                </button>
                            </div>
                        )}
                    </header>
                    <div className="flex min-h-0 flex-1 flex-col bg-[#F8F9FB]">
                        {!waitingForBefore && (
                            <p className="shrink-0 px-4 pt-2 pb-1 text-xs leading-5 text-[#667085] sm:hidden">
                                {copy('좌우로 밀어 전체 날짜를 확인하세요.', 'Swipe horizontally to see all dates.')}
                            </p>
                        )}
                        <div
                            role="region"
                            aria-label={copy('근무표 전체 보기', 'Full schedule')}
                            aria-busy={waitingForBefore && sourceStatus === 'loading'}
                            tabIndex={0}
                            className="min-h-0 flex-1 overflow-auto p-4 focus-visible:bg-[#EDE7FF] focus-visible:text-[#5931B9] focus-visible:outline-none sm:p-6"
                        >
                            {waitingForBefore ? (
                                <div className="flex h-full min-h-40 items-center justify-center text-center text-[13px] leading-5 text-[#667085]">
                                    {sourceStatus === 'error' ? (
                                        <div role="alert" className="space-y-3">
                                            <p>
                                                {copy('변경 전 근무표를 불러오지 못했어요.', 'The earlier schedule could not be loaded.')}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={selectBefore}
                                                className="min-h-[44px] rounded-lg bg-[#EDE7FF] px-3 py-2 font-medium text-[#5931B9] hover:bg-[#E3DAFF] focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none"
                                            >
                                                {copy('다시 불러오기', 'Try again')}
                                            </button>
                                        </div>
                                    ) : (
                                        <AiConversationLoading
                                            label={copy('변경 전 근무표 불러오는 중', 'Loading earlier schedule')}
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
                    {onContinue && (
                        <footer className="flex shrink-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
                            <p aria-live="polite" className="text-[13px] leading-5 text-[#667085]">
                                {canCompare
                                    ? showBefore
                                        ? waitingForBefore
                                            ? copy(
                                                  '변경 후 근무표는 바로 확인할 수 있어요.',
                                                  'You can still view the schedule after changes.',
                                              )
                                            : copy('변경 전 근무표를 보고 있어요.', 'You are viewing the schedule before changes.')
                                        : copy('변경 후 근무표를 보고 있어요.', 'You are viewing the schedule after changes.')
                                    : copy('이 결과를 바탕으로 이어서 작성할 수 있어요.', 'You can continue working from this result.')}
                            </p>
                            <button
                                type="button"
                                disabled={disabled || waitingForBefore}
                                onClick={() => onContinue(selected)}
                                className="min-h-[44px] w-full shrink-0 rounded-[10px] bg-main-1 px-5 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#5931D9] focus-visible:bg-[#4620B8] focus-visible:text-[#FFF1D6] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none sm:w-auto"
                            >
                                {showBefore && comparisonBefore
                                    ? copy('변경 전 표로 이어서 작성하기', 'Continue from the earlier schedule')
                                    : copy('이 표로 이어서 작성하기', 'Continue from this result')}
                            </button>
                        </footer>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
