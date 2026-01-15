import * as React from 'react';
import {Button as ShadcnButton} from '@/shared/ui/primitives/button';
import {cn} from '@/shared/util/style';

type Props = React.ComponentProps<typeof ShadcnButton>;

function Button({children, className, variant = 'default', ...props}: Props) {
    return (
        <ShadcnButton
            variant={variant}
            className={cn(
                'rounded-[50px] border-[.125rem] font-apple text-[2.25rem] font-semibold disabled:bg-main-3',
                variant === 'outline'
                    ? 'border-main-1 bg-transparent text-main-1 transition-all hover:bg-main-4'
                    : 'bg-main-1 text-white hover:bg-main-2',
                className,
            )}
            {...props}
        >
            {children}
        </ShadcnButton>
    );
}

export default Button;
