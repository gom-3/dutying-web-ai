import * as React from 'react';
import {Button as ShadcnButton} from '@/shared/ui/primitives/button';
import {cn} from '@/shared/util/style';

type TButtonProps = React.ComponentProps<typeof ShadcnButton>;

function Button({children, className, variant = 'default', ...props}: TButtonProps) {
    return (
        <ShadcnButton
            variant={variant === 'outline' ? 'brandOutline' : 'brand'}
            size="hero"
            className={cn('disabled:bg-main-3', className)}
            {...props}
        >
            {children}
        </ShadcnButton>
    );
}

export default Button;
