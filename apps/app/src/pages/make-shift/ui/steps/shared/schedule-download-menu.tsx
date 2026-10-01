import {Download} from 'lucide-react';
import {useEffect, useId, useRef, useState} from 'react';
import excelIcon from '@/shared/assets/images/excel.png';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {dropdownItemClassName, dropdownSurfaceClassName} from '@/shared/ui/dropdown-styles';
import Button from '@/shared/ui/form-controls/Button';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/shared/ui/primitives/tooltip';

type TScheduleDownloadMenuProps = {
    disabled: boolean;
    isExporting: boolean;
    label: string;
    onDownloadImage: () => void;
    onDownloadExcel: () => void;
};

export function ScheduleDownloadMenu({disabled, isExporting, label, onDownloadImage, onDownloadExcel}: TScheduleDownloadMenuProps) {
    const {t} = useTypedTranslation();
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const id = useId();
    const menuOpen = open && !disabled;

    useEffect(() => {
        if (!menuOpen) return;

        menu.current?.querySelector<HTMLButtonElement>('button')?.focus();

        const outside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        };

        document.addEventListener('pointerdown', outside);

        return () => document.removeEventListener('pointerdown', outside);
    }, [menuOpen]);

    const download = (action: () => void) => {
        if (disabled) return;

        setOpen(false);
        trigger.current?.focus();
        action();
    };

    return (
        <div
            ref={root}
            className="relative shrink-0"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
            }}
        >
            <TooltipProvider delayDuration={120}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            ref={trigger}
                            variant="secondary"
                            size="md"
                            type="button"
                            aria-label={label}
                            title={label}
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            aria-controls={menuOpen ? id : undefined}
                            aria-busy={isExporting || undefined}
                            className="size-10 cursor-pointer rounded-[12px] border border-gray-6 bg-white p-0 text-gray-3 shadow-none hover:bg-gray-7 hover:text-sub-1 focus-visible:ring-1 focus-visible:ring-main-1 focus-visible:ring-offset-0 disabled:bg-gray-7 disabled:text-gray-4"
                            onClick={() => setOpen(!open)}
                            onKeyDown={(event) => {
                                if (event.key === 'ArrowDown') {
                                    event.preventDefault();
                                    setOpen(true);
                                }
                            }}
                            disabled={disabled}
                        >
                            <Download className={`size-5 ${isExporting ? 'animate-pulse' : ''}`} strokeWidth={1.8} aria-hidden="true" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="rounded-full bg-[#1C2331] px-3 py-1.5 text-[12px] font-semibold text-white">
                        {label}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            {menuOpen && (
                <div
                    ref={menu}
                    id={id}
                    role="menu"
                    aria-label={label}
                    className={`${dropdownSurfaceClassName} absolute top-full right-0 mt-2 min-w-48`}
                    onKeyDown={(event) => {
                        event.stopPropagation();

                        if (event.key === 'Escape') {
                            event.preventDefault();
                            setOpen(false);
                            trigger.current?.focus();
                        }

                        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                            event.preventDefault();

                            const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
                            const current = items.indexOf(document.activeElement as HTMLButtonElement);
                            const next =
                                event.key === 'Home'
                                    ? 0
                                    : event.key === 'End'
                                      ? items.length - 1
                                      : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;

                            items[next]?.focus();
                        }
                    }}
                >
                    <button
                        type="button"
                        role="menuitem"
                        className={`${dropdownItemClassName} justify-start gap-2.5 text-left text-sub-1`}
                        onClick={() => download(onDownloadImage)}
                    >
                        <span className="flex size-8 shrink-0 items-center justify-center" aria-hidden="true">
                            <svg viewBox="0 0 24 24" className="size-6" focusable="false">
                                <rect x="1" y="3" width="22" height="18" rx="3" fill="#DCEBFF" />
                                <circle cx="17" cy="8" r="2" fill="#F5B544" />
                                <path d="m11 21 7-9 5 6v0a3 3 0 0 1-3 3Z" fill="#73A9EF" />
                                <path d="M4 21a3 3 0 0 1-3-3v-1l6-7 10 11Z" fill="#3979CF" />
                            </svg>
                        </span>
                        <span className="flex-1">{t('page.makeShift.confirmedShifts.imageAction')}</span>
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        className={`${dropdownItemClassName} justify-start gap-2.5 text-left text-sub-1`}
                        onClick={() => download(onDownloadExcel)}
                    >
                        <span className="flex size-8 shrink-0 items-center justify-center" aria-hidden="true">
                            <img src={excelIcon} alt="" className="size-8 object-contain" />
                        </span>
                        <span className="flex-1">{t('page.makeShift.confirmedShifts.excelAction')}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
