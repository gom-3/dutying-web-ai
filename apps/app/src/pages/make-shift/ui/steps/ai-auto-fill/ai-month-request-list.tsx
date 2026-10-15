import type {TScheduleMonthRequestRes} from '@dutying/api/ward';
import {cn} from '@dutying/utils/style';
import {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TProps = {
    requests: TScheduleMonthRequestRes[];
    disabled: boolean;
    disablingRequestId: number | null;
    onDisable: (request: TScheduleMonthRequestRes) => void;
    isLoading?: boolean;
    isError?: boolean;
    onRetry?: () => void;
};

/**
 * 이 달에 걸린 요청 목록. 서버 상태이므로 "다시 생성"·새로고침 뒤에도 남는다.
 * 해제는 요청만 끈다(DISABLED). 현재 근무표는 바꾸지 않는다.
 */
export default function AiMonthRequestList({
    requests,
    disabled,
    disablingRequestId,
    onDisable,
    isLoading = false,
    isError = false,
    onRetry,
}: TProps) {
    const {t} = useTypedTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const listId = useId();
    const container = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const [availableHeight, setAvailableHeight] = useState(320);
    const active = requests.filter((request) => request.status === 'ACTIVE');

    useLayoutEffect(() => {
        if (!isOpen) return;

        const measure = () => {
            const top = container.current?.getBoundingClientRect().top ?? 0;
            const headerBottom =
                container.current?.closest('[role="dialog"]')?.querySelector('header')?.getBoundingClientRect().bottom ?? 0;

            setAvailableHeight(Math.max(0, Math.min(320, top - headerBottom - 12)));
        };

        measure();
        window.addEventListener('resize', measure);

        return () => window.removeEventListener('resize', measure);
    }, [isOpen]);
    useEffect(() => {
        if (!active.length) setIsOpen(false);
    }, [active.length]);
    useEffect(() => {
        if (!isOpen) return;

        const dismissOutside = (event: Event) => {
            if (event.target instanceof Node && !container.current?.contains(event.target)) setIsOpen(false);
        };

        document.addEventListener('pointerdown', dismissOutside);
        document.addEventListener('focusin', dismissOutside);

        return () => {
            document.removeEventListener('pointerdown', dismissOutside);
            document.removeEventListener('focusin', dismissOutside);
        };
    }, [isOpen]);

    if (!active.length && !isError) {
        if (!isLoading) return null;

        return (
            <div
                className="ai-month-request-list flex min-h-11 items-center gap-2 rounded-t-[14px] bg-[#F2F4F6] px-4 py-2"
                data-preserve-duty-selection="true"
                role="status"
            >
                <SavedRequestIcon active={false} />
                <p className="text-[14px] leading-5 font-medium text-[#475467]">{t('aiAdjust.savedRequests.loading')}</p>
            </div>
        );
    }

    return (
        <div
            ref={container}
            className="ai-month-request-list relative rounded-t-[14px] bg-[#F2F4F6]"
            data-preserve-duty-selection="true"
            onKeyDown={(event) => {
                if (event.key !== 'Escape' || !isOpen) return;

                event.preventDefault();
                event.stopPropagation();
                setIsOpen(false);
                trigger.current?.focus();
            }}
        >
            {active.length > 0 && (
                <button
                    ref={trigger}
                    type="button"
                    aria-label={t('aiAdjust.savedRequests.titleCount', {count: active.length})}
                    aria-expanded={isOpen}
                    aria-controls={listId}
                    onClick={() => setIsOpen((current) => !current)}
                    className="group flex min-h-11 w-full items-center gap-2 rounded-t-[14px] px-4 py-2 text-left text-[#333D4B] hover:bg-[#EEF0F3] focus-visible:bg-main-light focus-visible:text-main-1 focus-visible:outline-none"
                >
                    <SavedRequestIcon active />
                    <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-[14px] leading-5 font-medium">
                            {t('aiAdjust.savedRequests.title')}
                            <span className="text-main-1 tabular-nums">{active.length}</span>
                        </span>
                    </span>
                    <svg
                        viewBox="0 0 20 20"
                        className={cn('size-5 shrink-0 text-[#475467]', !isOpen && 'rotate-180')}
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path d="m5 7 5 5 5-5 1.4 1.4-6.4 6.4-6.4-6.4L5 7Z" />
                    </svg>
                </button>
            )}

            {isError && (
                <div className="flex items-center gap-2 px-4 py-3">
                    <p role="alert" className="flex-1 text-[14px] leading-5 text-[#475467]">
                        {t('aiAdjust.savedRequests.error')}
                    </p>
                    <button
                        type="button"
                        onClick={onRetry}
                        disabled={isLoading || !onRetry}
                        className="min-h-11 shrink-0 rounded-lg px-3 text-[14px] font-semibold text-main-1 hover:bg-main-light focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40"
                    >
                        {t('aiAdjust.savedRequests.retry')}
                    </button>
                </div>
            )}

            {active.length > 0 && (
                <div
                    id={listId}
                    role="region"
                    aria-label={t('aiAdjust.savedRequests.title')}
                    hidden={!isOpen}
                    style={{maxHeight: availableHeight}}
                    className="absolute inset-x-0 bottom-full z-20 overflow-y-auto overscroll-contain rounded-t-[14px] bg-white"
                >
                    {isOpen && (
                        <>
                            <ul className="flex flex-col gap-1">
                                {active.map((request) => {
                                    const isDisabling = disablingRequestId === request.id;

                                    return (
                                        <li key={request.id} className="flex items-center gap-2 py-1 pr-1 pl-4">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[14px] leading-5 font-medium break-words text-[#333D4B]">
                                                    {request.displayLabel}
                                                </p>
                                                <p className="mt-0.5 flex flex-wrap gap-x-1 text-[14px] leading-[18px] text-[#475467]">
                                                    <span>{t(`aiAdjust.savedRequests.lifetime.${request.lifetime}`)}</span>
                                                    {request.origin === 'CARRIED_OVER' && (
                                                        <span>· {t('page.makeShift.aiRefill.adjust.requests.carriedOver')}</span>
                                                    )}
                                                </p>
                                                {request.kind === 'RULE' && (
                                                    <p className="mt-2 text-[14px] leading-[18px] text-[#475467]">
                                                        {t('page.makeShift.aiRefill.adjust.card.ruleNote')}
                                                    </p>
                                                )}
                                                {request.conditionStatus && request.conditionStatus !== 'ACTIVE' && (
                                                    <p className="mt-2 flex items-center gap-1.5 text-[14px] leading-[18px] text-[#9A5B13]">
                                                        <span className="size-1.5 shrink-0 rounded-full bg-[#C7852D]" aria-hidden="true" />
                                                        {t(`page.makeShift.aiRefill.adjust.conditionStatus.${request.conditionStatus}`)}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                disabled={disabled || disablingRequestId !== null || isError || isLoading}
                                                aria-label={t('aiAdjust.savedRequests.removeLabel', {
                                                    label: request.displayLabel,
                                                })}
                                                aria-busy={isDisabling}
                                                onClick={() => onDisable(request)}
                                                className="min-h-11 min-w-11 shrink-0 rounded-lg px-2 text-[14px] font-medium text-[#475467] hover:bg-[#FFF0F0] hover:text-[#B93B3B] focus-visible:bg-[#FFF0F0] focus-visible:text-[#B93B3B] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                {t(isDisabling ? 'aiAdjust.savedRequests.removing' : 'aiAdjust.savedRequests.remove')}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function SavedRequestIcon({active}: {active: boolean}) {
    return (
        <span
            className={cn(
                'grid size-6 shrink-0 place-items-center rounded-md',
                active ? 'bg-main-light text-main-1' : 'bg-[#ECEFF3] text-[#8B95A1]',
            )}
            aria-hidden="true"
        >
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor">
                <path d="M7 3h10a2 2 0 0 1 2 2v15a1 1 0 0 1-1.5.86L12 17.57l-5.5 3.29A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2Z" />
            </svg>
        </span>
    );
}
