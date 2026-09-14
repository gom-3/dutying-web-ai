import * as Dialog from '@radix-ui/react-dialog';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Button} from '@/shared/ui/primitives/button';

interface ISchedulePublishSuccessDialogProps {
    open: boolean;
    connectedNurseCount: number;
    showConnectionHint: boolean;
    wardCode: string;
    onClose: () => void;
}

function SchedulePublishSuccessIcon() {
    return (
        <div className="schedule-publish-success__icon relative mx-auto h-20 w-20" aria-hidden="true">
            <span className="schedule-publish-success__halo absolute inset-0 rounded-full bg-[#DDF7EA]" />
            <span className="schedule-publish-success__badge absolute inset-2 flex items-center justify-center rounded-full bg-[#20AD73] text-white">
                <svg className="schedule-publish-success__check h-9 w-9" viewBox="0 0 24 24" fill="currentColor" focusable="false">
                    <path d="M9.15 18.1 4.4 13.35l2.3-2.3 2.45 2.45 8.15-8.15 2.3 2.3Z" />
                </svg>
            </span>
        </div>
    );
}

export function SchedulePublishSuccessDialog({
    open,
    connectedNurseCount,
    showConnectionHint,
    wardCode,
    onClose,
}: ISchedulePublishSuccessDialogProps) {
    const {t} = useTypedTranslation();
    const portalContainer = typeof document === 'undefined' ? undefined : (document.getElementById('modal-root') ?? document.body);
    const copyableWardCode = wardCode.trim();

    return (
        <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <Dialog.Portal container={portalContainer}>
                <Dialog.Overlay className="fixed inset-0 z-[1100] bg-[#121726]/55" />
                <Dialog.Content className="fixed top-1/2 left-1/2 z-[1101] w-[calc(100vw-32px)] max-w-[432px] -translate-x-1/2 -translate-y-1/2 rounded-[24px] bg-white px-5 pt-8 pb-5 text-center sm:px-6 sm:pb-6">
                    <SchedulePublishSuccessIcon />

                    <Dialog.Title className="mt-5 font-apple text-[22px] leading-7 font-semibold text-sub-1">
                        {t('page.makeShift.aiRefill.publishSuccess')}
                    </Dialog.Title>
                    <Dialog.Description asChild>
                        <div className="mt-2 font-apple text-[15px] leading-6 break-keep text-gray-3">
                            {connectedNurseCount > 0 && (
                                <p>{t('page.makeShift.aiRefill.publishSuccessWithRecipients', {count: connectedNurseCount})}</p>
                            )}
                            {showConnectionHint && (
                                <div className="mt-5">
                                    <p className="font-semibold text-sub-1">
                                        {t('page.makeShift.aiRefill.publishSuccessWithoutRecipients')}
                                    </p>
                                    {copyableWardCode && (
                                        <span className="mt-3 inline-flex max-w-full items-center rounded-full bg-main-light px-3 py-1.5">
                                            <span className="truncate font-poppins text-[13px] leading-4 font-semibold tracking-[0.04em] text-main-1">
                                                {copyableWardCode}
                                            </span>
                                        </span>
                                    )}
                                    <p className="mx-auto mt-4 max-w-full text-[13px] leading-[22px] font-medium whitespace-nowrap text-main-1">
                                        <span aria-hidden="true">📱</span>{' '}
                                        {t('page.makeShift.aiRefill.publishSuccessConnectionDescription')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </Dialog.Description>

                    <Dialog.Close asChild>
                        <Button
                            type="button"
                            className="mt-6 h-12 w-full rounded-[14px] bg-main-1 text-[15px] font-semibold text-white shadow-none hover:bg-main-1-hover"
                        >
                            {t('page.makeShift.aiRefill.publishSuccessConfirm')}
                        </Button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
