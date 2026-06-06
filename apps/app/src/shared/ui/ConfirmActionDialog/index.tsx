import {cn} from '@dutying/utils/style';
import * as Dialog from '@radix-ui/react-dialog';
import {AlertTriangle, X} from 'lucide-react';
import {Button} from '@/shared/ui/primitives/button';

type TConfirmActionDialogTone = 'default' | 'danger';

interface IConfirmActionDialogProps {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel?: string;
    tone?: TConfirmActionDialogTone;
    onClose: () => void;
    onConfirm: () => void;
}

function ConfirmActionDialog({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel = '취소',
    tone = 'default',
    onClose,
    onConfirm,
}: IConfirmActionDialogProps) {
    const portalContainer = typeof document === 'undefined' ? undefined : (document.getElementById('modal-root') ?? document.body);
    const isDanger = tone === 'danger';

    return (
        <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <Dialog.Portal container={portalContainer}>
                <Dialog.Overlay className="fixed inset-0 z-[1100] bg-[#121726]/55 backdrop-blur-[2px]" />
                <Dialog.Content className="fixed top-1/2 left-1/2 z-[1101] w-[calc(100vw-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] bg-white p-6 shadow-[0_24px_80px_rgba(18,23,38,0.2)]">
                    <div className="flex items-start justify-between gap-4">
                        <div
                            className={cn(
                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                                isDanger ? 'bg-[#FFF5F5] text-[#D14343]' : 'bg-main-light text-main-1',
                            )}
                            aria-hidden="true"
                        >
                            <AlertTriangle className="h-5 w-5" strokeWidth={2.2} />
                        </div>
                        <Dialog.Close asChild>
                            <button
                                type="button"
                                className="h-9 w-9 shrink-0 cursor-pointer rounded-full bg-gray-7 text-gray-3 transition-colors hover:bg-gray-6"
                                aria-label="닫기"
                            >
                                <X className="h-4 w-4" strokeWidth={2.2} />
                            </button>
                        </Dialog.Close>
                    </div>

                    <Dialog.Title className="mt-4 font-apple text-[22px] leading-7 font-semibold text-sub-1">{title}</Dialog.Title>
                    <Dialog.Description className="mt-2 font-apple text-[15px] leading-6 whitespace-pre-line text-gray-3">
                        {description}
                    </Dialog.Description>

                    <div className="mt-6 grid grid-cols-2 gap-2">
                        <Dialog.Close asChild>
                            <Button type="button" variant="soft" className="h-11 rounded-[12px] text-[15px]">
                                {cancelLabel}
                            </Button>
                        </Dialog.Close>
                        <Button
                            type="button"
                            className={cn(
                                'h-11 rounded-[12px] text-[15px] font-semibold text-white shadow-none',
                                isDanger ? 'bg-[#D14343] hover:bg-[#BD3434]' : 'bg-main-1 hover:bg-[#5832E7]',
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
