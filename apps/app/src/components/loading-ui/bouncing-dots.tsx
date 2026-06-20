import {cn} from '@dutying/utils/style';

type TBouncingDotsProps = React.ComponentProps<'span'> & {
    dots?: number;
};

type TBouncingDotsSlotProps = TBouncingDotsProps & {
    active: boolean;
    inactiveClassName?: string;
};

function BouncingDots({className, dots = 3, role = 'status', 'aria-label': ariaLabel, ...props}: TBouncingDotsProps) {
    return (
        <span
            role={role}
            aria-label={role === 'status' ? (ariaLabel ?? 'Loading') : ariaLabel}
            translate="no"
            className={cn('inline-flex items-center gap-[12%]', className)}
            {...props}
        >
            {Array.from({length: dots}, (_, index) => (
                <span
                    key={index}
                    aria-hidden="true"
                    className="inline-block aspect-square grow rounded-full bg-current"
                    style={{
                        animation: 'loading-ui-bouncing-dots var(--duration, 1.4s) ease-in-out infinite',
                        animationDelay: `calc(var(--delay, 0.2s) * ${index})`,
                    }}
                />
            ))}
        </span>
    );
}

function BouncingDotsSlot({active, className, inactiveClassName = 'hidden', ...props}: TBouncingDotsSlotProps) {
    return (
        <BouncingDots
            aria-hidden={!active}
            role={active ? 'status' : 'presentation'}
            className={cn(active ? '' : inactiveClassName, className)}
            {...props}
        />
    );
}

export {BouncingDots, BouncingDotsSlot};
