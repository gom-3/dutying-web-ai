import {SlidersHorizontal} from 'lucide-react';
import {useEffect, useId, useRef, useState, type ReactNode} from 'react';
import toast from 'react-hot-toast';
import i18n from '@/i18n';
import {withDefaultHolidayCountry, type useRestLeavePolicy} from '@/pages/ward-settings/model/rest-leave-policy';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {dropdownItemClassName, dropdownSurfaceClassName} from '@/shared/ui/dropdown-styles';
import type {useScheduleDisplay} from '../../../model/use-schedule-display';

export function ScheduleDisplayMenu({
    display,
    restPolicy,
    settings,
}: {
    display: ReturnType<typeof useScheduleDisplay>;
    restPolicy: Pick<
        ReturnType<typeof useRestLeavePolicy>,
        'policy' | 'version' | 'isReady' | 'isLoading' | 'isSaving' | 'setPolicy' | 'refetch'
    >;
    settings?: ReactNode;
}) {
    const {t} = useTypedTranslation();
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const restSavePending = useRef(false);
    const id = useId();
    const restDescriptionId = `${id}-rest-description`;
    const restDisabled = !restPolicy.isReady || restPolicy.isSaving;
    const restDescription = t(
        restPolicy.isSaving
            ? 'annualLeave.display.restSaving'
            : restPolicy.isLoading
              ? 'annualLeave.display.restLoading'
              : restPolicy.isReady
                ? 'annualLeave.display.restShared'
                : 'annualLeave.display.restUnavailable',
    );
    const toggleRestPolicy = async () => {
        if (restDisabled || restSavePending.current) return;

        const next = {...restPolicy.policy, enabled: !restPolicy.policy.enabled};
        const policy = next.enabled ? withDefaultHolidayCountry(next, i18n.resolvedLanguage ?? i18n.language) : next;

        restSavePending.current = true;

        try {
            await restPolicy.setPolicy(policy, restPolicy.version);
        } catch {
            toast.error(t('annualLeave.display.restSaveFailed'));
            await restPolicy.refetch();
        } finally {
            restSavePending.current = false;
        }
    };

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
                    {(['rest', 'annualLeave'] as const).map((field) => {
                        const label = t(`annualLeave.display.${field}`);
                        const isRest = field === 'rest';
                        const checked = isRest ? restPolicy.policy.enabled : display.showAnnualLeave;
                        const disabled = isRest && restDisabled;

                        return (
                            <div key={field} role="none">
                                <button
                                    type="button"
                                    role="menuitemcheckbox"
                                    aria-label={label}
                                    aria-checked={checked}
                                    aria-disabled={disabled || undefined}
                                    aria-describedby={isRest ? restDescriptionId : undefined}
                                    className={`${dropdownItemClassName} min-h-11 justify-between gap-3 focus-visible:bg-main-4 focus-visible:text-main-1 focus-visible:outline-none aria-disabled:cursor-default aria-disabled:hover:bg-transparent aria-disabled:focus-visible:bg-main-4`}
                                    onClick={isRest ? () => void toggleRestPolicy() : () => display.setShowAnnualLeave(!checked)}
                                >
                                    <span className="min-w-0">
                                        <span className="block">{label}</span>
                                        {isRest && (
                                            <span
                                                id={restDescriptionId}
                                                className="mt-0.5 block text-xs leading-4 whitespace-normal text-gray-3"
                                            >
                                                {restDescription}
                                            </span>
                                        )}
                                    </span>
                                    <span
                                        aria-hidden="true"
                                        className={`flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 ${checked ? 'bg-main-1' : 'bg-gray-5'} ${disabled ? 'opacity-60' : ''}`}
                                    >
                                        <span className={`size-4 rounded-full bg-white ${checked ? 'translate-x-4' : ''}`} />
                                    </span>
                                </button>
                                {isRest && checked && settings ? <div className="px-2 pb-1">{settings}</div> : null}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
