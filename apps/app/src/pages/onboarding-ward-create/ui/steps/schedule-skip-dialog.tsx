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
                    className="fixed top-1/2 left-1/2 z-[1101] max-h-[90dvh] w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[20px] bg-white p-6 font-apple [overflow-wrap:anywhere] sm:p-7"
                    onOpenAutoFocus={(event) => {
                        event.preventDefault();
                        uploadButtonRef.current?.focus();
                    }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-9 shrink-0 text-[#B85C00]">
                            <path
                                fill="currentColor"
                                d="M10.268 3.5c.77-1.333 2.694-1.333 3.464 0l8.66 15c.77 1.333-.192 3-1.732 3H3.34c-1.54 0-2.502-1.667-1.732-3l8.66-15Z"
                            />
                            <rect x="11" y="8" width="2" height="6" rx="1" fill="white" />
                            <circle cx="12" cy="17" r="1" fill="white" />
                        </svg>
                        <Dialog.Close asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t('shared.confirmActionDialog.close')}
                                className="-mt-1 -mr-1 size-11 shrink-0 cursor-pointer rounded-full text-gray-3 focus-visible:bg-gray-5 focus-visible:text-sub-1 focus-visible:ring-0"
                            >
                                <X aria-hidden="true" />
                            </Button>
                        </Dialog.Close>
                    </div>
                    <Dialog.Title className="mt-4 text-[22px] leading-[1.4] font-bold tracking-[-0.03em] break-keep text-sub-1">
                        {t('page.onboardingWardCreate.scheduleEntry.skipTitle')}
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-[15px] leading-6 break-keep text-sub-2">
                        {t('page.onboardingWardCreate.scheduleEntry.skipDescription')}
                    </Dialog.Description>
                    <div className="mt-6 grid grid-cols-2 gap-2">
                        <Dialog.Close asChild>
                            <Button
                                variant="soft"
                                className="h-auto min-h-11 cursor-pointer rounded-xl px-3 py-2 leading-5 break-keep whitespace-normal focus-visible:bg-gray-5 focus-visible:text-sub-1 focus-visible:ring-0"
                                onClick={onSkip}
                            >
                                {t('page.onboardingWardCreate.scheduleEntry.skipConfirm')}
                            </Button>
                        </Dialog.Close>
                        <Dialog.Close asChild>
                            <Button
                                ref={uploadButtonRef}
                                variant="brand"
                                className="h-auto min-h-11 cursor-pointer rounded-xl px-3 py-2 leading-5 font-semibold break-keep whitespace-normal focus-visible:bg-main-1-hover focus-visible:font-bold focus-visible:ring-0"
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
