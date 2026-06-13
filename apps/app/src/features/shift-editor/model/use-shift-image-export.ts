import {useCallback, useState, type RefObject} from 'react';
import toast from 'react-hot-toast';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {shiftToImage} from './shift-to-image';

type TUseShiftImageExportOptions = {
    targetRef: RefObject<HTMLElement | null>;
    year: number;
    month: number;
    teamName?: string | null;
    hospitalName?: string | null;
    wardName?: string | null;
    disabled?: boolean;
};

function waitForNextPaint() {
    return new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => resolve());
        });
    });
}

export function useShiftImageExport({
    targetRef,
    year,
    month,
    teamName,
    hospitalName,
    wardName,
    disabled = false,
}: TUseShiftImageExportOptions) {
    const {t} = useTypedTranslation();
    const [isExporting, setIsExporting] = useState(false);
    const downloadImage = useCallback(async () => {
        if (disabled || isExporting) return;

        const target = targetRef.current;

        if (!target) {
            toast.error(t('feature.shiftEditor.export.image.targetMissing'));

            return;
        }

        setIsExporting(true);

        try {
            await waitForNextPaint();
            await shiftToImage({element: target, year, month, teamName, hospitalName, wardName});
            toast.success(t('feature.shiftEditor.export.image.success'));
        } catch (error) {
            console.error(error);
            toast.error(t('feature.shiftEditor.export.image.failure'));
        } finally {
            setIsExporting(false);
        }
    }, [disabled, hospitalName, isExporting, month, targetRef, teamName, t, wardName, year]);

    return {isExporting, downloadImage};
}
