import * as Dialog from '@radix-ui/react-dialog';
import {useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

export function AiAdjustIntro({open, owner}: {open: boolean; owner: string | null}) {
    const {t} = useTypedTranslation();
    const storageKey = `dutying.ai-adjust-intro:v1:${owner ?? 'guest'}`;
    const [dismissedKey, setDismissedKey] = useState<string | null>(null);

    let acknowledged = false;

    try {
        acknowledged = localStorage.getItem(storageKey) === 'seen';
    } catch {
        // Keep the guide usable when browser storage is unavailable.
    }

    const dismiss = () => {
        setDismissedKey(storageKey);

        try {
            localStorage.setItem(storageKey, 'seen');
        } catch {
            // The acknowledgement still applies for this mounted screen.
        }
    };

    return (
        <Dialog.Root open={open && !acknowledged && dismissedKey !== storageKey} onOpenChange={(next) => !next && dismiss()}>
            <Dialog.Portal container={document.getElementById('modal-root') ?? document.body}>
                <Dialog.Overlay className="fixed inset-0 z-[1500] bg-black/50" />
                <Dialog.Content className="fixed top-1/2 left-1/2 z-[1501] w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] bg-white p-6 shadow-xl">
                    <Dialog.Title className="text-xl font-semibold text-sub-1">{t('aiAutofillUi.adjustIntro.title')}</Dialog.Title>
                    <Dialog.Description className="mt-3 text-sm leading-6 whitespace-pre-line text-gray-3">
                        {t('aiAutofillUi.adjustIntro.description')}
                    </Dialog.Description>
                    <button
                        type="button"
                        onClick={dismiss}
                        className="mt-6 min-h-11 w-full rounded-xl bg-main-1 px-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main-1"
                    >
                        {t('aiAutofillUi.adjustIntro.confirm')}
                    </button>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
