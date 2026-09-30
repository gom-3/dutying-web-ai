import * as Dialog from '@radix-ui/react-dialog';
import {History, SlidersHorizontal, X} from 'lucide-react';
import {type ReactNode, useRef, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/shared/ui/primitives/tooltip';

export const annualInputClass = 'w-full rounded-xl bg-gray-7 px-3 py-2.5 text-sm text-sub-1 disabled:opacity-50';
export const annualButtonClass = 'rounded-xl bg-main-1 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';
export const annualSecondaryClass = 'rounded-xl bg-gray-7 px-4 py-2.5 text-sm font-medium text-sub-2 disabled:opacity-50';

// Review reminders are no longer shown; retain only calculation-related checks.
export function AnnualLeaveCalculationNotes({checks}: {checks: string[]}) {
    const {t} = useTypedTranslation();
    const [pinned, setPinned] = useState(false);
    const [hovered, setHovered] = useState(false);
    const calculationChecks = checks.filter((check) => !['VALIDITY_UNKNOWN', 'REVIEW_REQUIRED', 'PARTIAL_WORK'].includes(check));
    const open = pinned || hovered;
    const close = () => {
        setPinned(false);
        setHovered(false);
    };

    if (!calculationChecks.length) return null;

    return (
        <TooltipProvider delayDuration={150}>
            <Tooltip
                open={open}
                onOpenChange={(next) => {
                    if (!pinned) setHovered(next);
                }}
            >
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        aria-label={t('annualLeave.calculationInfo')}
                        aria-expanded={open}
                        className="ml-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full align-middle text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-950 focus-visible:bg-amber-100 focus-visible:text-amber-950 focus-visible:outline-none [@media(pointer:coarse)]:size-11"
                        onClick={() => {
                            setPinned((previous) => !previous);
                            setHovered(false);
                        }}
                        onBlur={close}
                    >
                        <span
                            aria-hidden="true"
                            className="inline-flex size-4 items-center justify-center rounded-full bg-amber-100 font-serif text-xs leading-none font-bold"
                        >
                            i
                        </span>
                    </button>
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    sideOffset={6}
                    collisionPadding={12}
                    className="z-[1190] max-w-[min(280px,calc(100vw-24px))] rounded-lg bg-sub-1 px-3 py-2.5 text-left font-apple text-xs leading-5 font-normal text-pretty [overflow-wrap:anywhere] break-keep whitespace-pre-line text-white motion-reduce:animate-none"
                    onEscapeKeyDown={close}
                    onPointerDownOutside={close}
                >
                    <ul className="space-y-2">
                        {calculationChecks.map((check) => (
                            <li key={check}>
                                {t(check === 'MISSING_SCHEDULE' ? 'annualLeave.missingScheduleHint' : `annualLeave.checks.${check}`)}
                            </li>
                        ))}
                    </ul>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export function AnnualLeaveField({label, children, hint}: {label: string; children: ReactNode; hint?: string}) {
    return (
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-sub-2">
            <span>{label}</span>
            {children}
            {hint && <span className="text-xs leading-5 font-normal text-gray-3">{hint}</span>}
        </label>
    );
}

export function AnnualLeavePersonActions({name, onEdit, onHistory}: {name: string; onEdit?: () => void; onHistory: () => void}) {
    const {t} = useTypedTranslation();

    return (
        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
            {onEdit && (
                <button
                    type="button"
                    aria-label={`${name} ${t('annualLeave.edit')}`}
                    title={t('annualLeave.edit')}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-gray-3 transition-colors hover:text-main-1 focus-visible:bg-main-4 focus-visible:text-main-1 focus-visible:outline-none [@media(pointer:coarse)]:size-11"
                    onClick={onEdit}
                >
                    <SlidersHorizontal aria-hidden="true" className="size-4" />
                </button>
            )}
            <button
                type="button"
                aria-label={`${name} ${t('annualLeave.history')}`}
                title={t('annualLeave.history')}
                className="inline-flex size-8 items-center justify-center rounded-lg text-gray-3 transition-colors hover:text-main-1 focus-visible:bg-main-4 focus-visible:text-main-1 focus-visible:outline-none [@media(pointer:coarse)]:size-11"
                onClick={onHistory}
            >
                <History aria-hidden="true" className="size-4" />
            </button>
        </div>
    );
}

export function AnnualLeaveDialog({
    title,
    children,
    onClose,
    busy = false,
    navigation,
    scrollKey,
    compact = false,
}: {
    title: string;
    children: ReactNode;
    onClose: () => void;
    busy?: boolean;
    navigation?: ReactNode;
    scrollKey?: string;
    compact?: boolean;
}) {
    const {t} = useTypedTranslation();

    return (
        <Dialog.Root
            open
            onOpenChange={(open) => {
                if (!open && !busy) onClose();
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[1200] bg-black/30" />
                <Dialog.Content
                    aria-describedby={undefined}
                    className={`fixed top-1/2 left-1/2 z-[1201] flex max-h-[90dvh] ${compact ? 'w-[min(480px,94vw)]' : 'w-[min(720px,94vw)]'} -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white font-apple`}
                    onInteractOutside={(event) => event.preventDefault()}
                    onEscapeKeyDown={(event) => {
                        const hasOpenDropdown =
                            event.target instanceof Element && event.target.closest('[role="dialog"]')?.querySelector('[role="listbox"]');

                        if (busy || hasOpenDropdown) event.preventDefault();
                    }}
                >
                    <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
                        <Dialog.Title className="text-xl font-semibold text-sub-1">{title}</Dialog.Title>
                        <Dialog.Close
                            disabled={busy}
                            aria-label={t('annualLeave.close')}
                            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-3 hover:bg-gray-7 focus-visible:bg-gray-6 focus-visible:outline-none"
                        >
                            <X size={20} />
                        </Dialog.Close>
                    </div>
                    {navigation && <div className="shrink-0 px-4 pb-4 sm:px-6">{navigation}</div>}
                    <div key={scrollKey} className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-5 sm:px-6 sm:pb-6">
                        {children}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

/** Keep a request ID across uncertain retries, but never reuse it for changed input. */
export function useAnnualLeaveRequestId() {
    const previous = useRef<{payload: string; id: string} | null>(null);

    return (payload: unknown) => {
        const serialized = JSON.stringify(payload, (key, value) => (key === 'version' ? undefined : value));

        if (previous.current?.payload !== serialized) previous.current = {payload: serialized, id: crypto.randomUUID()};

        return previous.current.id;
    };
}
