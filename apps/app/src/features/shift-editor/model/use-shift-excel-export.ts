import {useCallback, useState} from 'react';
import toast from 'react-hot-toast';
import {type TShift} from '@/entities/shift';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {shiftToExcel} from './shift-to-excel';

type TUseShiftExcelExportOptions = {
    month: number;
    shift: TShift | null;
    disabled?: boolean;
};

export function useShiftExcelExport({month, shift, disabled = false}: TUseShiftExcelExportOptions) {
    const {t} = useTypedTranslation();
    const [isExporting, setIsExporting] = useState(false);
    const exportExcel = useCallback(async () => {
        if (disabled || isExporting || !shift) return;

        setIsExporting(true);

        try {
            await shiftToExcel(month, shift);
            toast.success(t('feature.shiftEditor.export.excel.success'));
        } catch (error) {
            console.error(error);
            toast.error(t('feature.shiftEditor.export.excel.failure'));
        } finally {
            setIsExporting(false);
        }
    }, [disabled, isExporting, month, shift, t]);

    return {isExporting, exportExcel};
}
