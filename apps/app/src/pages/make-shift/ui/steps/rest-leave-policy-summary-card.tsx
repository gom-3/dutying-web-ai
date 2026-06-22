import {Minus, Plus} from 'lucide-react';
import {useMemo} from 'react';
import {calculateBaseRestTarget, getApproximateWeekCount, useRestLeavePolicy} from '@/pages/ward-settings/model/rest-leave-policy';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {useRestTargetAdjustment} from '../../model/rest-target-adjustment';

type TRestLeavePolicySummaryCardProps = {
    wardId: number | null;
    shiftTeamId: number | null;
    year: number;
    month: number;
};

function formatAdjustmentLabel(adjustmentDays: number, t: ReturnType<typeof useTypedTranslation>['t']) {
    if (adjustmentDays === 0) return t('page.makeShift.workers.restPolicy.adjustmentNone');

    return adjustmentDays > 0
        ? t('page.makeShift.workers.restPolicy.adjustmentPlus', {count: adjustmentDays})
        : t('page.makeShift.workers.restPolicy.adjustmentMinus', {count: Math.abs(adjustmentDays)});
}

export function RestLeavePolicySummaryCard({wardId, shiftTeamId, year, month}: TRestLeavePolicySummaryCardProps) {
    const {t} = useTypedTranslation();
    const {policy} = useRestLeavePolicy(wardId);
    const {adjustmentDays, setAdjustmentDays} = useRestTargetAdjustment({wardId, shiftTeamId, year, month});
    const weekCount = useMemo(() => getApproximateWeekCount(year, month), [month, year]);
    const baseTarget = useMemo(() => calculateBaseRestTarget(policy, year, month), [month, policy, year]);
    const adjustedTarget = Math.max(0, baseTarget + adjustmentDays);
    const baseTargetLabel =
        policy.targetMode === 'weekly'
            ? t('page.makeShift.workers.restPolicy.weeklyTarget', {
                  days: policy.weeklyOffDays,
                  weeks: weekCount,
                  count: baseTarget,
              })
            : t('page.makeShift.workers.restPolicy.fixedTarget', {count: baseTarget});
    const adjustmentLabel = formatAdjustmentLabel(adjustmentDays, t);
    const canDecrease = adjustmentDays > -baseTarget;
    const canIncrease = adjustmentDays < 31;
    const patchAdjustment = (nextAdjustmentDays: number) => {
        setAdjustmentDays(Math.max(-baseTarget, Math.min(31, nextAdjustmentDays)));
    };

    if (!wardId || !policy.enabled) return null;

    return (
        <div className="group relative inline-flex shrink-0">
            <div className="inline-flex h-8 shrink-0 items-center overflow-hidden rounded-full bg-white font-apple text-[12px] font-semibold text-sub-2 shadow-[inset_0_0_0_1px_rgba(76,82,118,0.06)]">
                <span className="flex h-full items-center px-2.5">
                    <span className="whitespace-nowrap text-gray-3">{t('page.makeShift.workers.restPolicy.targetLabel')}</span>
                </span>
                <span className="h-4 w-px bg-gray-6" aria-hidden="true" />
                <span className="flex h-full items-center px-1">
                    <button
                        type="button"
                        disabled={!canDecrease}
                        aria-label={t('page.makeShift.workers.restPolicy.decreaseTarget')}
                        className="grid size-7 place-items-center rounded-full text-gray-3 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:outline-2 focus-visible:outline-main-1 disabled:text-gray-4 disabled:opacity-40"
                        onClick={() => patchAdjustment(adjustmentDays - 1)}
                    >
                        <Minus aria-hidden className="size-3.5" />
                    </button>
                    <span className="flex min-w-8 items-center justify-center text-sub-1 tabular-nums">
                        {adjustedTarget}
                        {t('page.makeShift.workers.restPolicy.dayUnit')}
                    </span>
                    <button
                        type="button"
                        disabled={!canIncrease}
                        aria-label={t('page.makeShift.workers.restPolicy.increaseTarget')}
                        className="grid size-7 place-items-center rounded-full text-gray-3 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:outline-2 focus-visible:outline-main-1 disabled:text-gray-4 disabled:opacity-40"
                        onClick={() => patchAdjustment(adjustmentDays + 1)}
                    >
                        <Plus aria-hidden className="size-3.5" />
                    </button>
                </span>
            </div>
            <div className="pointer-events-none absolute top-full left-1/2 z-30 mt-2 w-max max-w-[260px] -translate-x-1/2 rounded-[10px] bg-[#1C2331] px-3 py-2 text-left font-apple text-[12px] leading-5 text-white opacity-0 shadow-[0px_10px_24px_rgba(23,23,28,0.18)] transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
                <p className="font-semibold">
                    {t('page.makeShift.workers.restPolicy.targetLabel')} {adjustedTarget}
                    {t('page.makeShift.workers.restPolicy.dayUnit')}
                </p>
                <p className="mt-0.5 text-white/78">{baseTargetLabel}</p>
                <p className="text-white/78">{adjustmentLabel}</p>
            </div>
        </div>
    );
}
