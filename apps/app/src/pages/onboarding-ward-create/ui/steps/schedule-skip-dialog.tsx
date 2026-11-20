import * as Dialog from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import {useRef} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Button} from '@/shared/ui/primitives/button';

interface IScheduleSkipDialogProps {
    disabled: boolean;
    onChooseFile: () => void;
    onSkip: () => void;
}

export default function ScheduleSkipDialog({disabled, onChooseFile, onSkip}: IScheduleSkipDialogProps) {
    const {t} = useTypedTranslation();
    const uploadButtonRef = useRef<HTMLButtonElement>(null);

    return (
        <Dialog.Root>
            <Dialog.Trigger asChild>
                <Button
                    variant="link"
                    className="min-h-11 cursor-pointer rounded-lg px-2 font-apple text-[15px] text-sub-2 hover:text-main-1"
                    disabled={disabled}
                >
                    {t('page.onboardingWardCreate.action.skip')}
                </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[1100] bg-[#171324]/45" />
                <Dialog.Content
                    className="fixed top-1/2 left-1/2 z-[1101] max-h-[90dvh] w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[20px] bg-white p-6 font-apple sm:p-7"
                    onOpenAutoFocus={(event) => {
                        event.preventDefault();
                        uploadButtonRef.current?.focus();
                    }}
                >
                    <div className="flex items-start justify-between gap-2">
                        <Dialog.Title className="text-[22px] leading-[1.4] font-bold tracking-[-0.03em] break-keep text-sub-1">
                            {t('page.onboardingWardCreate.scheduleEntry.skipTitle')}
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t('shared.confirmActionDialog.close')}
                                className="-mt-1 -mr-1 shrink-0 cursor-pointer text-gray-3"
                            >
                                <X aria-hidden="true" />
                            </Button>
                        </Dialog.Close>
                    </div>
                    <Dialog.Description className="mt-2 text-[15px] leading-6 break-keep text-sub-2">
                        {t('page.onboardingWardCreate.scheduleEntry.skipDescription')}
                    </Dialog.Description>
                    <div className="mt-6 grid grid-cols-2 gap-2">
                        <Dialog.Close asChild>
                            <Button
                                variant="soft"
                                className="h-auto min-h-11 cursor-pointer rounded-xl px-3 py-2 leading-5 whitespace-normal"
                                onClick={onSkip}
                            >
                                {t('page.onboardingWardCreate.scheduleEntry.skipConfirm')}
                            </Button>
                        </Dialog.Close>
                        <Dialog.Close asChild>
                            <Button
                                ref={uploadButtonRef}
                                variant="brand"
                                className="h-auto min-h-11 cursor-pointer rounded-xl px-3 py-2 leading-5 font-semibold whitespace-normal"
                                onClick={onChooseFile}
                            >
                                {t('page.onboardingWardCreate.scheduleEntry.skipUpload')}
                            </Button>
                        </Dialog.Close>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
