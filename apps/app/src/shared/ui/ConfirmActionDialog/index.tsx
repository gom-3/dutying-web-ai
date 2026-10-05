import {cn} from '@dutying/utils/style';
import * as Dialog from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import {type ReactNode, type SyntheticEvent, useLayoutEffect, useState} from 'react';
import redWarnIcon from '@/shared/assets/images/red-warn-icon.webp';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Button} from '@/shared/ui/primitives/button';

type TConfirmActionDialogTone = 'default' | 'danger';

interface IConfirmActionDialogProps {
    open: boolean;
    title: string;
    description: ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    tone?: TConfirmActionDialogTone;
    onClose: () => void;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmButtonVariant?: 'default' | 'ai';
    icon?: ReactNode;
    /** 선택한 영역은 보여주되, 모달 뒤의 입력은 막는다. */
    spotlightSelector?: string;
    zIndex?: number;
}

type TSpotlightRect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};

const SPOTLIGHT_PADDING = 8;
const SPOTLIGHT_RADIUS = 12;

function getSpotlightRect(selector: string): TSpotlightRect | null {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const rects = elements.map((element) => element.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0);

    if (rects.length === 0) return null;

    const rawLeft = Math.min(...rects.map((rect) => rect.left)) - SPOTLIGHT_PADDING;
    const rawTop = Math.min(...rects.map((rect) => rect.top)) - SPOTLIGHT_PADDING;
    const rawRight = Math.max(...rects.map((rect) => rect.right)) + SPOTLIGHT_PADDING;
    const rawBottom = Math.max(...rects.map((rect) => rect.bottom)) + SPOTLIGHT_PADDING;
    const left = Math.max(0, Math.min(window.innerWidth, rawLeft));
    const top = Math.max(0, Math.min(window.innerHeight, rawTop));
    const right = Math.max(left, Math.min(window.innerWidth, rawRight));
    const bottom = Math.max(top, Math.min(window.innerHeight, rawBottom));

    return right > left && bottom > top ? {left, top, right, bottom} : null;
}

export function ConfirmationSpotlight({
    spotlightSelector,
    zIndex,
    interactive = false,
    modal = false,
}: Pick<IConfirmActionDialogProps, 'spotlightSelector' | 'zIndex'> & {interactive?: boolean; modal?: boolean}) {
    const Overlay = modal ? Dialog.Overlay : 'div';
    const [spotlightRect, setSpotlightRect] = useState<TSpotlightRect | null>(null);

    useLayoutEffect(() => {
        if (!spotlightSelector) {
            setSpotlightRect(null);

            return undefined;
        }

        let animationFrameId: number;

        const measureSpotlight = () => {
            const next = getSpotlightRect(spotlightSelector);

            setSpotlightRect((previous) => {
                if (
                    previous?.left === next?.left &&
                    previous?.top === next?.top &&
                    previous?.right === next?.right &&
                    previous?.bottom === next?.bottom
                )
                    return previous;

                return next;
            });
            // Opening the sheet also collapses navigation over 300ms. Track actual
            // positions while visible, including layout shifts without resize/scroll events.
            animationFrameId = window.requestAnimationFrame(measureSpotlight);
        };

        measureSpotlight();

        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [spotlightSelector]);

    const blockSpotlightInteraction = (event: SyntheticEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
    };

    return (
        <Overlay
            aria-hidden="true"
            data-confirmation-spotlight="true"
            className="pointer-events-none fixed inset-0 z-[1100] overflow-hidden bg-transparent"
            style={zIndex === undefined ? undefined : {zIndex}}
        >
            {spotlightRect ? (
                <div
                    aria-hidden="true"
                    data-spotlight-blocker="true"
                    className={cn('absolute z-[1] cursor-default touch-none bg-transparent', !interactive && 'pointer-events-auto')}
                    style={{
                        top: spotlightRect.top,
                        left: spotlightRect.left,
                        width: spotlightRect.right - spotlightRect.left,
                        height: spotlightRect.bottom - spotlightRect.top,
                        borderRadius: SPOTLIGHT_RADIUS,
                        boxShadow: '0 0 0 9999px rgba(18, 23, 38, 0.55)',
                    }}
                    onPointerDown={blockSpotlightInteraction}
                    onClick={blockSpotlightInteraction}
                    onContextMenu={blockSpotlightInteraction}
                />
            ) : (
                <div aria-hidden="true" className="pointer-events-auto absolute inset-0 bg-[#121726]/55 backdrop-blur-[2px]" />
            )}
            {spotlightRect && (
                <>
                    <div className="pointer-events-auto absolute inset-x-0 top-0" style={{height: spotlightRect.top}} />
                    <div className="pointer-events-auto absolute inset-x-0 bottom-0" style={{top: spotlightRect.bottom}} />
                    <div
                        className="pointer-events-auto absolute left-0"
                        style={{top: spotlightRect.top, height: spotlightRect.bottom - spotlightRect.top, width: spotlightRect.left}}
                    />
                    <div
                        className="pointer-events-auto absolute right-0"
                        style={{top: spotlightRect.top, height: spotlightRect.bottom - spotlightRect.top, left: spotlightRect.right}}
                    />
                </>
            )}
        </Overlay>
    );
}

function ConfirmActionDialog({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    tone = 'default',
    onClose,
    onConfirm,
    onCancel,
    confirmButtonVariant = 'default',
    icon,
    spotlightSelector,
    zIndex,
}: IConfirmActionDialogProps) {
    const {t} = useTypedTranslation();
    const resolvedCancelLabel = cancelLabel ?? t('shared.confirmActionDialog.cancel');
    const portalContainer = typeof document === 'undefined' ? undefined : (document.getElementById('modal-root') ?? document.body);
    const isDanger = tone === 'danger';

    return (
        <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <Dialog.Portal container={portalContainer}>
                <ConfirmationSpotlight modal spotlightSelector={spotlightSelector} zIndex={zIndex} />
                <Dialog.Content
                    style={zIndex === undefined ? undefined : {zIndex: zIndex + 1}}
                    className="fixed top-1/2 left-1/2 z-[1101] w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] bg-white p-6 shadow-[0_24px_80px_rgba(18,23,38,0.2)]"
                >
                    <div className="flex items-start justify-between gap-4">
                        {icon ? (
                            <div className="shrink-0" aria-hidden="true">
                                {icon}
                            </div>
                        ) : (
                            <div className="shrink-0" aria-hidden="true">
                                <img src={redWarnIcon} alt="" className="h-12 w-12 object-contain" />
                            </div>
                        )}
                        <Dialog.Close asChild>
                            <button
                                type="button"
                                className="h-9 w-9 shrink-0 cursor-pointer rounded-full bg-gray-7 text-gray-3 transition-colors hover:bg-gray-6"
                                aria-label={t('shared.confirmActionDialog.close')}
                            >
                                <X className="h-4 w-4" strokeWidth={2.2} />
                            </button>
                        </Dialog.Close>
                    </div>

                    <Dialog.Title className="mt-4 font-apple text-[22px] leading-7 font-semibold text-sub-1">{title}</Dialog.Title>
                    <Dialog.Description className="mt-2 font-apple text-[15px] leading-6 break-keep whitespace-pre-line text-gray-3">
                        {description}
                    </Dialog.Description>

                    <div className="mt-6 grid grid-cols-2 gap-2">
                        <Dialog.Close asChild>
                            <Button type="button" variant="soft" className="h-11 rounded-[12px] text-[15px]" onClick={onCancel}>
                                {resolvedCancelLabel}
                            </Button>
                        </Dialog.Close>
                        <Button
                            type="button"
                            className={cn(
                                'h-11 rounded-[12px] text-[15px] font-semibold text-white shadow-none',
                                isDanger
                                    ? 'bg-[#D14343] hover:bg-[#BD3434]'
                                    : confirmButtonVariant === 'ai'
                                      ? 'bg-[linear-gradient(90deg,#C241F4_0%,#6B45F4_100%)] shadow-[0_8px_22px_rgba(107,69,244,0.2)] hover:-translate-y-0.5 hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[#A978FF] focus-visible:ring-offset-2 active:scale-[0.99] active:brightness-95'
                                      : 'bg-main-1 hover:bg-main-1-hover',
                            )}
                            onClick={onConfirm}
                        >
                            {confirmLabel}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

export default ConfirmActionDialog;
