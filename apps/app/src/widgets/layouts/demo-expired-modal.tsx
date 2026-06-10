import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import Button from '@/shared/ui/form-controls/Button';

interface IDemoExpiredModalProps {
    open: boolean;
    onPrimaryAction: () => void;
    onSecondaryAction: () => void;
}

export function DemoExpiredModal({open, onPrimaryAction, onSecondaryAction}: IDemoExpiredModalProps) {
    const {t} = useTypedTranslation();

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#121726]/58 px-6 py-10 backdrop-blur-[2px]">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="demo-expired-modal-title"
                aria-describedby="demo-expired-modal-description"
                className="w-full max-w-[34rem] rounded-[28px] border border-main-3/30 bg-white px-8 py-9 shadow-[0_24px_80px_rgba(18,23,38,0.18)]"
            >
                <div className="inline-flex rounded-full bg-main-light px-4 py-2 font-apple text-sm font-semibold text-main-1">
                    {t('feature.auth.demoSession.expiredModal.badge')}
                </div>
                <h2 id="demo-expired-modal-title" className="mt-5 font-apple text-[2rem] font-semibold tracking-[-0.02em] text-sub-1">
                    {t('feature.auth.demoSession.expiredModal.title')}
                </h2>
                <p id="demo-expired-modal-description" className="mt-3 font-apple text-base leading-7 text-gray-3">
                    {t('feature.auth.demoSession.expiredModal.description')}
                </p>
                <div className="mt-6 rounded-[20px] border border-gray-6 bg-[#F8F9FC] px-5 py-4">
                    <p className="font-apple text-sm font-semibold text-sub-2.5">{t('feature.auth.demoSession.expiredModal.nextStepTitle')}</p>
                    <p className="mt-2 font-apple text-sm leading-6 text-gray-3">
                        {t('feature.auth.demoSession.expiredModal.nextStepDescription')}
                    </p>
                </div>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <Button type="button" size="md" className="h-13 flex-1 rounded-[16px] text-lg" onClick={onPrimaryAction}>
                        {t('feature.auth.demoSession.expiredModal.primaryAction')}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="md"
                        className="h-13 flex-1 rounded-[16px] text-lg"
                        onClick={onSecondaryAction}
                    >
                        {t('feature.auth.state.logout')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
