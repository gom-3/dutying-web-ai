import {SlidersHorizontal} from 'lucide-react';
import {useEffect, useId, useRef, useState, type ReactNode} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {dropdownItemClassName, dropdownSurfaceClassName} from '@/shared/ui/dropdown-styles';
import type {useScheduleDisplay} from '../../../model/use-schedule-display';

export function ScheduleDisplayMenu({display, settings}: {display: ReturnType<typeof useScheduleDisplay>; settings?: ReactNode}) {
    const {t} = useTypedTranslation();
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const id = useId();

    useEffect(() => {
        if (!open) return;

        menu.current?.querySelector<HTMLButtonElement>('button')?.focus();

        const outside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        };

        document.addEventListener('pointerdown', outside);

        return () => document.removeEventListener('pointerdown', outside);
    }, [open]);

    return (
        <div
            ref={root}
            className="relative shrink-0"
            data-preserve-duty-selection="true"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
            }}
        >
            <button
                ref={trigger}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? id : undefined}
                aria-label={t('annualLeave.display.title')}
                title={t('annualLeave.display.title')}
                onClick={() => setOpen(!open)}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
                className="flex size-11 items-center justify-center rounded-xl bg-gray-7 text-gray-3 hover:text-sub-1 focus-visible:bg-main-4 focus-visible:text-main-1 focus-visible:outline-none"
            >
                <SlidersHorizontal size={18} aria-hidden="true" />
            </button>
            {open && (
                <div
                    ref={menu}
                    id={id}
                    role="menu"
                    aria-label={t('annualLeave.display.title')}
                    className={`${dropdownSurfaceClassName} absolute top-full right-0 mt-2 w-64`}
                    onKeyDown={(event) => {
                        // Keep calendar shortcuts from consuming menu keystrokes.
                        event.stopPropagation();

                        if (event.key === 'Escape') {
                            event.preventDefault();
                            setOpen(false);
                            trigger.current?.focus();
                        }

                        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                            event.preventDefault();

                            const buttons = Array.from(
                                menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]') ?? [],
                            );
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
                    <p className="px-3 pt-2 pb-1 text-xs font-medium text-gray-3">{t('annualLeave.display.title')}</p>
                    {(['rest', 'annualLeave'] as const).map((field) => (
                        <div key={field} role="none">
                            <button
                                type="button"
                                role="menuitemcheckbox"
                                aria-checked={display.value[field]}
                                className={`${dropdownItemClassName} min-h-11 justify-between gap-6 focus-visible:bg-main-4 focus-visible:text-main-1 focus-visible:outline-none`}
                                onClick={() => display.change(field, !display.value[field])}
                            >
                                <span>{t(`annualLeave.display.${field}`)}</span>
                                <span
                                    aria-hidden="true"
                                    className={`flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 ${display.value[field] ? 'bg-main-1' : 'bg-gray-5'}`}
                                >
                                    <span className={`size-4 rounded-full bg-white ${display.value[field] ? 'translate-x-4' : ''}`} />
                                </span>
                            </button>
                            {field === 'rest' && settings ? <div className="px-2 pb-1">{settings}</div> : null}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
