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
            variant={variant === 'solid' ? 'brand' : variant === 'secondary' ? 'soft' : 'link'}
            size={variant === 'link' ? undefined : 'pill'}
            className={cn(variant === 'link' && 'px-0 text-gray-3 underline underline-offset-2 hover:bg-transparent', className)}
            {...props}
        >
            {children}
        </Button>
    );
}

export default WizardButton;
