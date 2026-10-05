import {Check} from 'lucide-react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TCarryOverOption} from '../../../model/ai-carry-over';
import {AssistantMessage, UserMessage} from './ai-adjust-review-conversation';

type TProps = {
    options: TCarryOverOption[];
    selectedIds: number[];
    isLoading: boolean;
    loadFailed: boolean;
    isApplying: boolean;
    error: string | null;
    onToggle: (id: number) => void;
    onConfirm: () => void;
    onRetry: () => void;
};

/** A draft user reply. Only the confirmation commits it to the conversation. */
export default function AiCarryOverCard({
    options,
    selectedIds,
    isLoading,
    loadFailed,
    isApplying,
    error,
    onToggle,
    onConfirm,
    onRetry,
}: TProps) {
    const {t} = useTypedTranslation();
    const actionClass =
        'min-h-11 rounded-xl px-4 py-3 text-[13.5px] font-medium text-main-1 hover:bg-main-1 hover:text-white focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none disabled:opacity-40';

    if (isLoading)
        return (
            <AssistantMessage>
                <span role="status" aria-label={t('aiAdjust.carryOver.loading')} className="flex min-h-7 items-center gap-1">
                    {[0, 1, 2].map((dot) => (
                        <span key={dot} aria-hidden="true" className="ai-adjust-review-dot size-[5px] rounded-full bg-main-1" />
                    ))}
                </span>
            </AssistantMessage>
        );

    if (!loadFailed && !options.some((option) => !option.unavailable)) return null;

    return (
        <section aria-label={t('aiAdjust.carryOver.title')} className="flex min-w-0 flex-col gap-4">
            {loadFailed ? (
                <AssistantMessage>
                    <p role="alert">{t('aiAdjust.carryOver.loadFailed')}</p>
                    <button type="button" className={actionClass} onClick={onRetry}>
                        {t('aiAdjust.failure.retry')}
                    </button>
                </AssistantMessage>
            ) : null}
            <UserMessage>
                {!loadFailed && (
                    <>
                        <p className="mb-2 font-medium">{t('aiAdjust.carryOver.thisMonth')}</p>
                        <div role="group" aria-label={t('aiAdjust.carryOver.title')} className="flex min-w-0 flex-col gap-1">
                            {options.map(({request, unavailable}) => (
                                <label
                                    key={request.id}
                                    className={`relative flex min-h-11 items-start gap-2 rounded-lg px-2 py-2 text-[13.5px] leading-6 [overflow-wrap:anywhere] break-keep ${unavailable || isApplying ? 'cursor-default' : 'cursor-pointer hover:bg-white/60'} focus-within:bg-main-1 focus-within:text-white`}
                                >
                                    <input
                                        type="checkbox"
                                        className="peer sr-only"
                                        checked={!unavailable && selectedIds.includes(request.id)}
                                        disabled={isApplying || Boolean(unavailable)}
                                        aria-label={request.displayLabel}
                                        aria-describedby={unavailable ? `carry-over-reason-${request.id}` : undefined}
                                        onChange={() => onToggle(request.id)}
                                    />
                                    <span
                                        aria-hidden="true"
                                        className="mt-1 grid size-4 shrink-0 place-items-center rounded-[4px] bg-white text-transparent peer-checked:bg-main-1 peer-checked:text-white peer-focus-visible:bg-white peer-focus-visible:text-main-1 peer-disabled:opacity-40"
                                    >
                                        <Check
                                            className={`size-3 ${!unavailable && selectedIds.includes(request.id) ? '' : 'invisible'}`}
                                            strokeWidth={3}
                                        />
                                    </span>
                                    <span className="min-w-0">
                                        <span className={unavailable ? 'text-[#6B7684]' : ''}>{request.displayLabel}</span>
                                        {unavailable && (
                                            <span
                                                id={`carry-over-reason-${request.id}`}
                                                className="mt-1 block text-[12px] leading-5 text-[#6B7684]"
                                            >
                                                {t(`aiAdjust.carryOver.unavailable.${unavailable}`)}
                                            </span>
                                        )}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </>
                )}
                <button type="button" disabled={isApplying} className={`${actionClass} mt-2 w-full bg-white text-left`} onClick={onConfirm}>
                    {t(
                        isApplying
                            ? 'aiAdjust.carryOver.saving'
                            : selectedIds.length && !loadFailed
                              ? 'aiAdjust.carryOver.confirm'
                              : 'aiAdjust.carryOver.skip',
                    )}
                </button>
            </UserMessage>
            {error && (
                <AssistantMessage>
                    <p role="alert">{error}</p>
                </AssistantMessage>
            )}
        </section>
    );
}
