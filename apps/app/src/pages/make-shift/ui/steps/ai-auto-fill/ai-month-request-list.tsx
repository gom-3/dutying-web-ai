import type {TScheduleMonthRequestRes} from '@dutying/api/ward';
import {cn} from '@dutying/utils/style';
import {useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TProps = {
    requests: TScheduleMonthRequestRes[];
    disabled: boolean;
    disablingRequestId: number | null;
    onDisable: (request: TScheduleMonthRequestRes) => void;
};

/**
 * 이 달에 걸린 요청 목록. 서버 상태이므로 "다시 생성"·새로고침 뒤에도 남는다.
 * ✕ 는 요청을 끄고(DISABLED) 곧바로 다시 조절한다 — 목록과 표가 어긋난 채로 두지 않는다.
 */
export default function AiMonthRequestList({requests, disabled, disablingRequestId, onDisable}: TProps) {
    const {t} = useTypedTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const active = requests.filter((request) => request.status === 'ACTIVE');

    return (
        <div className="ai-month-request-list px-4 pb-2" data-preserve-duty-selection="true">
            <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((current) => !current)}
                className="text-12 text-sub flex items-center gap-1 hover:underline"
            >
                <span>{isOpen ? '▾' : '▸'}</span>
                <span>{t('page.makeShift.aiRefill.adjust.requests.title', {count: active.length})}</span>
            </button>

            {isOpen && (
                <div className="mt-1 flex flex-col gap-1">
                    <p className="text-12 text-sub">{t('page.makeShift.aiRefill.adjust.requests.persistNote')}</p>

                    {active.length === 0 ? (
                        <p className="text-12 text-sub">{t('page.makeShift.aiRefill.adjust.requests.empty')}</p>
                    ) : (
                        <ul className="flex flex-col gap-1">
                            {active.map((request) => {
                                const isDisabling = disablingRequestId === request.id;

                                return (
                                    <li key={request.id} className="flex flex-wrap items-center gap-2">
                                        <span className="text-13">{request.displayLabel}</span>
                                        <span className="text-12 border-line text-sub rounded-full border px-2 py-0.5">
                                            {t(`page.makeShift.aiRefill.adjust.lifetime.${request.lifetime}`)}
                                        </span>
                                        {request.origin === 'CARRIED_OVER' && (
                                            <span className="text-12 text-sub">
                                                {t('page.makeShift.aiRefill.adjust.requests.carriedOver')}
                                            </span>
                                        )}
                                        {request.kind === 'RULE' && (
                                            <span className="text-12 text-sub">{t('page.makeShift.aiRefill.adjust.card.ruleNote')}</span>
                                        )}
                                        <button
                                            type="button"
                                            disabled={disabled || isDisabling}
                                            aria-label={t('page.makeShift.aiRefill.adjust.requests.remove', {label: request.displayLabel})}
                                            onClick={() => onDisable(request)}
                                            className={cn(
                                                'text-13 text-sub px-1 transition-colors hover:text-red',
                                                (disabled || isDisabling) && 'cursor-not-allowed opacity-50',
                                            )}
                                        >
                                            ✕
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
