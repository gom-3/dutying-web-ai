import {cn} from '@dutying/utils/style';
import * as Dialog from '@radix-ui/react-dialog';
import {ArrowRight, Pin, X} from 'lucide-react';
import type {TShift} from '@/entities';
import type {TDutyDoc, TViolation} from '@/features/shift-editor';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Button} from '@/shared/ui/primitives/button';
import {MakeShiftCalendar} from '../shared/make-shift-calendar';

type TAiFillDecisionDialogProps = {
    open: boolean;
    kind: 'initial' | 'regenerate';
    shift: TShift | null;
    doc: TDutyDoc;
    violationMap: Map<string, TViolation>;
    teamViolations: TViolation[];
    onClose: () => void;
    onToggleCellFixed: (rowIndex: number, colIndex: number) => void;
    onFixAll: () => void;
    onEdit: () => void;
    onConfirm: () => void;
    fixableCellCount: number;
    cancelLabel: string;
    confirmLabel: string;
};

export function AiFillDecisionDialog({
    open,
    kind,
    shift,
    doc,
    violationMap,
    teamViolations,
    onClose,
    onToggleCellFixed,
    onFixAll,
    onEdit,
    onConfirm,
    fixableCellCount,
    cancelLabel,
    confirmLabel,
}: TAiFillDecisionDialogProps) {
    const {t} = useTypedTranslation();
    const portalContainer = typeof document === 'undefined' ? undefined : (document.getElementById('modal-root') ?? document.body);
    const isRegenerate = kind === 'regenerate';

    return (
        <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <Dialog.Portal container={portalContainer}>
                <Dialog.Overlay className="fixed inset-0 z-[1100] bg-[#111827]/58 p-3 sm:p-5" />
                <Dialog.Content
                    className={cn(
                        'fixed top-1/2 left-1/2 z-[1101] flex max-h-[calc(100vh-24px)] w-[calc(100vw-24px)] max-w-[1180px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[26px] bg-white sm:max-h-[calc(100vh-40px)] sm:w-[calc(100vw-40px)] sm:rounded-[30px]',
                    )}
                >
                    <div className="shrink-0 bg-[#FAF8FF] px-5 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-5">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 items-start">
                                <div className="min-w-0">
                                    <Dialog.Title className="font-apple text-[22px] leading-7 font-semibold tracking-[-0.025em] text-sub-1 sm:text-[25px] sm:leading-8">
                                        {t(
                                            isRegenerate
                                                ? 'page.makeShift.aiRefill.regenerateDecision.title'
                                                : 'page.makeShift.aiRefill.prefillDecision.title',
                                        )}
                                    </Dialog.Title>
                                    <Dialog.Description className="mt-1.5 max-w-[760px] font-apple text-[14px] leading-5.5 whitespace-pre-line text-gray-3 sm:text-[15px] sm:leading-6">
                                        {t('page.makeShift.aiRefill.prefillDecision.previewDescription')}
                                    </Dialog.Description>
                                </div>
                            </div>
                            <Dialog.Close asChild>
                                <button
                                    type="button"
                                    className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-gray-7 text-gray-3 transition-colors hover:bg-gray-6 focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none"
                                    aria-label={t('shared.confirmActionDialog.close')}
                                >
                                    <X className="size-4" strokeWidth={2.2} />
                                </button>
                            </Dialog.Close>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-hidden bg-white px-3 pt-4 pb-2 sm:px-6 sm:pt-5 sm:pb-3">
                        <div className="h-full overflow-y-auto pr-1 sm:pr-2">
                            <div className="flex min-h-11 items-center justify-between gap-3 px-2 pb-3 sm:px-4 sm:pb-4">
                                <h2 className="font-apple text-[15px] font-semibold tracking-[-0.015em] text-sub-1 sm:text-base">
                                    {t('page.makeShift.aiRefill.prefillDecision.calendarTitle')}
                                </h2>
                                <Button
                                    type="button"
                                    variant="subtle"
                                    className="h-11 shrink-0 rounded-[12px] border-0 bg-white px-4 font-apple text-[14px] font-semibold text-[#6546D7] shadow-none hover:bg-white focus-visible:bg-white focus-visible:text-[#6546D7] focus-visible:ring-0 focus-visible:outline-none disabled:bg-white disabled:text-gray-3"
                                    disabled={fixableCellCount === 0}
                                    onClick={onFixAll}
                                >
                                    <Pin aria-hidden />
                                    {t(
                                        fixableCellCount === 0
                                            ? 'page.makeShift.aiRefill.prefillDecision.fixAllDone'
                                            : 'page.makeShift.aiRefill.prefillDecision.fixAll',
                                    )}
                                </Button>
                            </div>
                            <div className="overflow-hidden rounded-[20px] bg-white px-2 pb-1 sm:px-4 sm:pb-2">
                                {shift ? (
                                    <MakeShiftCalendar
                                        shift={shift}
                                        doc={doc}
                                        violationMap={violationMap}
                                        teamViolations={teamViolations}
                                        showFaults={false}
                                        variant="simplified"
                                        readonly
                                        staticPreview
                                        interactivePreview
                                        fixedCellPreview
                                        borderlessPreview
                                        disableInitialSelection
                                        showCellStatusPins
                                        canReorderRows={false}
                                        onCellClick={onToggleCellFixed}
                                    />
                                ) : (
                                    <div className="grid min-h-40 place-items-center font-apple text-sm text-gray-3">
                                        {t('page.makeShift.aiRefill.loading')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 bg-[#F8F7FB] px-5 py-4 sm:px-7 sm:py-5">
                        <div className="flex items-center justify-between gap-3">
                            <Button
                                type="button"
                                variant="soft"
                                className="h-11 rounded-[11px] border-0 px-4 text-[14px] font-semibold shadow-none focus-visible:bg-gray-3 focus-visible:text-white focus-visible:ring-0 focus-visible:outline-none"
                                aria-label={t('page.makeShift.aiRefill.prefillDecision.cancel')}
                                onClick={onEdit}
                            >
                                {cancelLabel}
                            </Button>
                            <Button
                                type="button"
                                variant="brand"
                                className="inline-flex min-h-11 w-full cursor-pointer rounded-[13px] bg-[#6B45F4] px-6 py-0 font-apple text-[13px] leading-none font-bold whitespace-nowrap text-white shadow-none transition-colors hover:bg-[#5A37DD] focus-visible:bg-[#4225B8] focus-visible:text-white focus-visible:ring-0 focus-visible:outline-none active:bg-[#4D2CCB] sm:w-auto"
                                onClick={onConfirm}
                            >
                                <span>{confirmLabel}</span>
                                <ArrowRight className="size-4" strokeWidth={2.2} />
                            </Button>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
