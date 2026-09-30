import {cn} from '@dutying/utils/style';
import {MoreHorizontal} from 'lucide-react';
import {useEffect, useId, useRef, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {dropdownItemClassName, dropdownSurfaceClassName} from '@/shared/ui/dropdown-styles';

export function AnnualLeaveActionsMenu({
    items,
}: {
    items: {label: string; disabled?: boolean; onSelect: () => void; onDisabledSelect?: () => void}[];
}) {
    const {t} = useTypedTranslation();
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const id = useId();

    useEffect(() => {
        if (!open) return;

        menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();

        const outside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        };

        document.addEventListener('pointerdown', outside);

        return () => document.removeEventListener('pointerdown', outside);
    }, [open]);

    return (
        <div
            ref={root}
            className="relative"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
            }}
        >
            <button
                ref={trigger}
                type="button"
                aria-label={t('annualLeave.bulkGrant.menu')}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? id : undefined}
                onClick={() => setOpen(!open)}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
                className="flex size-11 items-center justify-center rounded-xl bg-transparent text-gray-3 transition-colors hover:text-sub-1 focus-visible:bg-main-4 focus-visible:text-main-1 focus-visible:outline-none motion-reduce:transition-none"
            >
                <MoreHorizontal aria-hidden="true" size={22} />
            </button>
            {open && (
                <div
                    ref={menu}
                    id={id}
                    role="menu"
                    aria-label={t('annualLeave.bulkGrant.menu')}
                    className={cn(
                        dropdownSurfaceClassName,
                        'absolute top-full right-0 mt-2 w-60 max-w-[calc(100vw-32px)] slide-in-from-top-1',
                    )}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            setOpen(false);
                            trigger.current?.focus();
                        }

                        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                            event.preventDefault();

                            const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
                            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                            const next =
                                event.key === 'Home'
                                    ? 0
                                    : event.key === 'End'
                                      ? buttons.length - 1
                                      : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;

                            buttons[next]?.focus();
                        }
                    }}
                >
                    {items.map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            disabled={item.disabled && !item.onDisabledSelect}
                            aria-disabled={item.disabled ?? undefined}
                            onClick={() => {
                                setOpen(false);

                                if (item.disabled) {
                                    trigger.current?.focus();
                                    item.onDisabledSelect?.();

                                    return;
                                }

                                item.onSelect();
                            }}
                            className={cn(
                                dropdownItemClassName,
                                'min-h-11 text-left text-sub-1 focus-visible:bg-gray-7 focus-visible:outline-none disabled:cursor-not-allowed disabled:hover:bg-transparent aria-disabled:text-gray-3 aria-disabled:opacity-50',
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
