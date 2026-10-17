import {cn} from '@dutying/utils/style';
import {useId, useState, type ComponentProps} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {RequestCapacitySettings} from './request-capacity-settings';
import {RequestReceptionContent} from './request-reception-content';

export function RequestReceptionSettings({className, ...props}: ComponentProps<typeof RequestReceptionContent> & {className?: string}) {
    const {t} = useTypedTranslation();
    const id = useId();
    const [tab, setTab] = useState<'period' | 'capacity'>('period');
    const tabs = ['period', 'capacity'] as const;

    return (
        <div className={cn('w-full max-w-[760px]', className)}>
            <div role="tablist" aria-label={t('requestCapacity.settingsTabs')} className="flex flex-wrap gap-6">
                {tabs.map((value, index) => (
                    <button
                        key={value}
                        id={`${id}-${value}-tab`}
                        role="tab"
                        type="button"
                        aria-selected={tab === value}
                        aria-controls={`${id}-${value}-panel`}
                        tabIndex={tab === value ? 0 : -1}
                        onClick={() => setTab(value)}
                        onKeyDown={(event) => {
                            const target =
                                event.key === 'ArrowRight'
                                    ? 1 - index
                                    : event.key === 'ArrowLeft'
                                      ? 1 - index
                                      : event.key === 'Home'
                                        ? 0
                                        : event.key === 'End'
                                          ? 1
                                          : null;

                            if (target === null) return;

                            event.preventDefault();
                            setTab(tabs[target]);
                            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target]?.focus();
                        }}
                        className={`relative min-h-12 rounded-t-md px-1 pb-3 text-base font-bold focus-visible:bg-[#EAE4FF] focus-visible:text-[#422395] focus-visible:outline-none forced-colors:focus-visible:outline forced-colors:focus-visible:outline-2 ${tab === value ? 'text-[#5532C8] forced-colors:underline' : 'text-[#626573] hover:text-[#242633]'}`}
                    >
                        {t(value === 'period' ? 'requestCapacity.periodTab' : 'requestCapacity.capacityTab')}
                        {tab === value ? (
                            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 rounded-t bg-[#6242D9]" />
                        ) : null}
                    </button>
                ))}
            </div>
            <div id={`${id}-period-panel`} role="tabpanel" aria-labelledby={`${id}-period-tab`} hidden={tab !== 'period'} className="mt-6">
                <RequestReceptionContent {...props} />
            </div>
            <div id={`${id}-capacity-panel`} role="tabpanel" aria-labelledby={`${id}-capacity-tab`} hidden={tab !== 'capacity'}>
                <RequestCapacitySettings />
            </div>
        </div>
    );
}
