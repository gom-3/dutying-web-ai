import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {AiExecutionIconButton} from './ai-execution-icon-button';

export function AiExecutionCancelButton({
    onCancel,
    disabled = false,
    showLabel = false,
}: {
    onCancel: () => void;
    disabled?: boolean;
    showLabel?: boolean;
}) {
    const {t} = useTypedTranslation();

    if (showLabel)
        return (
            <button
                type="button"
                disabled={disabled}
                onClick={onCancel}
                className="forced-colors:focus-visible:outline-auto inline-flex min-h-[44px] max-w-full items-center gap-1.5 px-1 text-[13px] leading-5 font-medium text-[#B42318] transition-colors hover:text-[#8F1D16] focus-visible:text-[#8F1D16] focus-visible:underline focus-visible:underline-offset-4 focus-visible:outline-none disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none"
            >
                <span aria-hidden className="size-[9px] shrink-0 rounded-[2px] bg-current" />
                <span className="min-w-0 break-keep">{t('aiAutofillUi.conversationOperationStatus.cancelCalculation')}</span>
            </button>
        );

    return (
        <AiExecutionIconButton
            label={t('aiAutofillUi.conversationOperationStatus.cancelBackground')}
            tone="cancel"
            onClick={onCancel}
            disabled={disabled}
        >
            <span aria-hidden="true" className="size-3 rounded-[3px] bg-current" />
        </AiExecutionIconButton>
    );
}
