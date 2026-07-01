import {Minus, Plus, Settings} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {calculateBaseRestTarget, getApproximateWeekCount, useRestLeavePolicy} from '@/pages/ward-settings/model/rest-leave-policy';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {useRestTargetAdjustment} from '../../model/rest-target-adjustment';

type TRestLeavePolicySummaryCardProps = {
    wardId: number | null;
    shiftTeamId: number | null;
    year: number;
    month: number;
};

type TRestLeavePolicySummaryState = ReturnType<typeof useRestLeavePolicySummary>;

function getTargetLabel(month: number, t: ReturnType<typeof useTypedTranslation>['t']) {
    return `${month}월 ${t('page.makeShift.workers.restPolicy.targetLabel')}`;
}

function formatAdjustmentLabel(adjustmentDays: number, t: ReturnType<typeof useTypedTranslation>['t']) {
    if (adjustmentDays === 0) return t('page.makeShift.workers.restPolicy.adjustmentNone');

    return adjustmentDays > 0
        ? t('page.makeShift.workers.restPolicy.adjustmentPlus', {count: adjustmentDays})
        : t('page.makeShift.workers.restPolicy.adjustmentMinus', {count: Math.abs(adjustmentDays)});
}

function useRestLeavePolicySummary({wardId, shiftTeamId, year, month}: TRestLeavePolicySummaryCardProps) {
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

    return {
        t,
        enabled: Boolean(wardId && policy.enabled),
        targetLabel: getTargetLabel(month, t),
        adjustedTarget,
        baseTarget,
        baseTargetLabel,
        adjustmentDays,
        adjustmentLabel,
        canDecrease,
        canIncrease,
        patchAdjustment,
    };
}

function RestTargetAdjustmentControl({summary}: {summary: TRestLeavePolicySummaryState}) {
    return (
        <div className="inline-flex h-8 shrink-0 items-center overflow-hidden rounded-full bg-white font-apple text-[12px] font-semibold text-sub-2">
            <span className="flex h-full items-center px-2.5">
                <span className="whitespace-nowrap text-gray-3">{summary.targetLabel}</span>
            </span>
            <span className="h-4 w-px bg-gray-6" aria-hidden="true" />
            <span className="flex h-full items-center px-1">
                <button
                    type="button"
                    disabled={!summary.canDecrease}
                    aria-label={summary.t('page.makeShift.workers.restPolicy.decreaseTarget')}
                    className="grid size-7 place-items-center rounded-full text-gray-3 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:outline-2 focus-visible:outline-main-1 disabled:text-gray-4 disabled:opacity-40"
                    onClick={() => summary.patchAdjustment(summary.adjustmentDays - 1)}
                >
                    <Minus aria-hidden className="size-3.5" />
                </button>
                <span className="flex min-w-8 items-center justify-center text-sub-1 tabular-nums">
                    {summary.adjustedTarget}
                    {summary.t('page.makeShift.workers.restPolicy.dayUnit')}
                </span>
                <button
                    type="button"
                    disabled={!summary.canIncrease}
                    aria-label={summary.t('page.makeShift.workers.restPolicy.increaseTarget')}
                    className="grid size-7 place-items-center rounded-full text-gray-3 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:outline-2 focus-visible:outline-main-1 disabled:text-gray-4 disabled:opacity-40"
                    onClick={() => summary.patchAdjustment(summary.adjustmentDays + 1)}
                >
                    <Plus aria-hidden className="size-3.5" />
                </button>
            </span>
        </div>
    );
}

function RestTargetSummaryText({summary, tone = 'dark'}: {summary: TRestLeavePolicySummaryState; tone?: 'dark' | 'light'}) {
    const detailClassName = tone === 'light' ? 'text-white/78' : 'text-gray-3';

    return (
        <div className="font-apple text-[12px] leading-5">
            <p className="font-semibold">
                {summary.targetLabel} {summary.adjustedTarget}
                {summary.t('page.makeShift.workers.restPolicy.dayUnit')}
            </p>
            <p className={`mt-0.5 ${detailClassName}`}>{summary.baseTargetLabel}</p>
            <p className={detailClassName}>{summary.adjustmentLabel}</p>
        </div>
    );
}

export function RestLeavePolicySummaryCard(props: TRestLeavePolicySummaryCardProps) {
    const summary = useRestLeavePolicySummary(props);

    if (!summary.enabled) return null;

    return (
        <div className="group relative inline-flex shrink-0">
            <RestTargetAdjustmentControl summary={summary} />
            <div className="pointer-events-none absolute top-full left-1/2 z-30 mt-2 w-max max-w-[260px] -translate-x-1/2 rounded-[10px] bg-[#1C2331] px-3 py-2 text-left font-apple text-[12px] leading-5 text-white opacity-0 shadow-[0px_10px_24px_rgba(23,23,28,0.18)] transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
                <RestTargetSummaryText summary={summary} tone="light" />
            </div>
        </div>
    );
}

export function RestLeavePolicySummaryButton(props: TRestLeavePolicySummaryCardProps) {
    const summary = useRestLeavePolicySummary(props);
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open || typeof document === 'undefined') return;

        const handlePointerDown = (event: PointerEvent) => {
            if (rootRef.current?.contains(event.target as Node)) return;

            setOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);

        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [open]);

    if (!summary.enabled) return null;

    const title = `${summary.targetLabel} ${summary.adjustedTarget}${summary.t(
        'page.makeShift.workers.restPolicy.dayUnit',
    )} · ${summary.adjustmentLabel}`;

    return (
        <div ref={rootRef} className="relative inline-flex shrink-0">
            <button
                type="button"
                title={title}
                aria-label={title}
                aria-expanded={open}
                className="grid size-5 shrink-0 place-items-center rounded-full text-gray-3 transition-colors hover:bg-gray-7 hover:text-sub-1 focus-visible:ring-2 focus-visible:ring-main-2 focus-visible:ring-offset-1 focus-visible:outline-none"
                onClick={() => setOpen((prev) => !prev)}
            >
                <Settings className="size-3.5" aria-hidden="true" />
            </button>
            {open ? (
                <div className="absolute top-full right-0 z-50 mt-2 rounded-[14px] bg-white p-2 shadow-[0_18px_48px_rgba(18,23,38,0.16)] ring-1 ring-gray-6">
                    <RestTargetAdjustmentControl summary={summary} />
                </div>
            ) : null}
        </div>
    );
}
