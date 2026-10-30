import {Square} from 'lucide-react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Button} from '@/shared/ui/primitives/button';

export function AiExecutionCancelButton({onCancel, disabled = false}: {onCancel: () => void; disabled?: boolean}) {
    const {t} = useTypedTranslation();

    return (
        <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={disabled}
            className="h-11 min-h-11 rounded-xl border-gray-4 bg-white px-4 font-apple text-sm font-medium text-sub-1 hover:border-gray-3 hover:bg-gray-6 focus-visible:ring-2 focus-visible:ring-main-1 focus-visible:ring-offset-2 active:bg-gray-5"
        >
            <Square aria-hidden="true" className="fill-current" strokeWidth={0} />
            {t('aiAutofillUi.conversationOperationStatus.cancelBackground')}
        </Button>
    );
}
