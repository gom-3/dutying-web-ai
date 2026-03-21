import {type ButtonHTMLAttributes} from 'react';
import {Button} from '@/shared/ui/primitives/button';
import {cn} from '@/shared/util/style';

type TVariant = 'solid' | 'secondary' | 'link';

interface IWizardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: TVariant;
}

function WizardButton({children, variant = 'solid', className, ...props}: IWizardButtonProps) {
    return (
        <Button
            type="button"
            className={cn(
                'h-[42px] rounded-[10px] px-5 font-apple text-[20px] font-semibold',
                variant === 'solid' && 'bg-main-1 text-white hover:bg-main-2',
                variant === 'secondary' && 'bg-gray-6 text-gray-3 hover:bg-gray-5',
                variant === 'link' && 'px-0 text-gray-3 underline underline-offset-2 hover:bg-transparent',
                className,
            )}
            {...props}
        >
            {children}
        </Button>
    );
}

export default WizardButton;
