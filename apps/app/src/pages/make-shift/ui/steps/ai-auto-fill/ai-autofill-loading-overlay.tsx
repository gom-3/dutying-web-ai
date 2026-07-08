import {LoaderCircle} from 'lucide-react';
import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

function getElapsedSeconds(startedAt: number | null) {
    if (startedAt === null) return 0;

    return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

export function AiAutofillLoadingOverlay({startedAt}: {startedAt: number | null}) {
    const {t} = useTypedTranslation();
    const [elapsedSeconds, setElapsedSeconds] = useState(() => getElapsedSeconds(startedAt));

    useEffect(() => {
        setElapsedSeconds(getElapsedSeconds(startedAt));

        if (startedAt === null) return undefined;

        const timerId = window.setInterval(() => {
            setElapsedSeconds(getElapsedSeconds(startedAt));
        }, 1000);

        return () => window.clearInterval(timerId);
    }, [startedAt]);

    const portalContainer = typeof document === 'undefined' ? null : (document.getElementById('modal-root') ?? document.body);

    if (portalContainer === null) return null;

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-autofill-loading-title"
            className="fixed inset-0 z-[100002] flex items-center justify-center bg-transparent px-4"
        >
            <div className="w-full max-w-[420px] rounded-[20px] bg-white px-7 py-8 text-center shadow-[0_22px_80px_rgba(45,32,92,0.24)]">
                <div className="mx-auto flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#F3F4F6] text-main-1">
                    <LoaderCircle className="h-[22px] w-[22px] animate-spin" aria-hidden />
                </div>
                <p id="ai-autofill-loading-title" className="mt-5 font-apple text-[24px] leading-[1.35] font-bold text-sub-1">
                    {t('page.makeShift.aiRefill.loadingOverlay.title')}
                </p>
                <p className="mx-auto mt-3 max-w-[300px] font-apple text-[15px] leading-[1.6] font-medium whitespace-pre-line text-gray-3">
                    {t('page.makeShift.aiRefill.loadingOverlay.description')}
                </p>
                <p className="mt-6 font-apple text-[13px] font-semibold text-main-1" aria-live="polite">
                    {t('page.makeShift.aiRefill.loadingOverlay.elapsed', {seconds: elapsedSeconds})}
                </p>
            </div>
        </div>,
        portalContainer,
    );
}
