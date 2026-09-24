import type {TAutofillResponse, TScheduleAdjustmentNotice, TScheduleRequestRuleResult} from '@dutying/api/ward';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TProps = {
    /** 직전 조절이 옮긴 칸 수. 조절을 아직 안 했으면 null. */
    changedCount: number | null;
    ruleResults: TScheduleRequestRuleResult[];
    notices?: TScheduleAdjustmentNotice[];
    offGoal?: NonNullable<TAutofillResponse['engineResult']>['offGoal'];
    /** 이미 가장 센 강도로 돌렸는지. 그러면 "더 세게" 버튼을 주지 않는다. */
    isStrongest: boolean;
    disabled: boolean;
    onAdjustHarder: () => void;
};

/**
 * 조절 직후의 결과 한 줄. 토스트가 아니라 패널에 남긴다 — 토스트는 사라지고,
 * 사용자는 "내가 부탁한 것이 지켜졌나"를 표를 보는 내내 다시 확인하고 싶어 한다.
 *
 * 잔여 위반이 있으면 그것이 먼저다. "12칸 바꿨어요"보다 "'D 최대 4연속'이 2곳 남았어요"가
 * 다음에 할 일을 정한다. 여러 줄을 쌓지 않고 가장 먼저 안 지켜진 것 하나만 보여 준다.
 */
export default function AiAdjustResultNote({changedCount, ruleResults, notices = [], offGoal, isStrongest, disabled, onAdjustHarder}: TProps) {
    const {t} = useTypedTranslation();
    const unmet = ruleResults.find((entry) => (entry.violationCount ?? 0) > 0);

    if (changedCount === null && !unmet && !offGoal && notices.length === 0) return null;

    const offGoalUnmet = offGoal && offGoal.goalStatus !== 'SATISFIED';
    const offGoalLabel = offGoal?.operation === 'SET_TARGET'
        ? `${offGoal.targetOff}일 목표에서 총 ${offGoal.totalDeviation ?? 0}일 차이가 남았어요.`
        : offGoal?.operation === 'INCREASE_TO_BASELINE'
          ? `기준 오프까지 총 ${offGoal.totalDeficit ?? 0}일이 아직 부족해요.`
          : `최소 ${offGoal?.minimumOff}일 오프 목표 중 ${offGoal?.totalDeficit ?? 0}일이 아직 부족해요.`;

    return (
        <div className="ai-adjust-result-note text-12 text-sub flex flex-wrap items-center gap-2 px-4" role="status">
            {offGoalUnmet ? (
                <span>{offGoalLabel}</span>
            ) : unmet ? (
                <>
                    <span>
                        {t(unmet.downgraded ? 'page.makeShift.aiRefill.adjust.downgraded' : 'page.makeShift.aiRefill.adjust.remaining', {
                            label: unmet.displayLabel ?? '',
                            count: unmet.violationCount,
                        })}
                    </span>
                    {!isStrongest && (
                        <button type="button" disabled={disabled} onClick={onAdjustHarder} className="font-semibold text-primary underline">
                            {t('page.makeShift.aiRefill.adjust.remainingAction')}
                        </button>
                    )}
                </>
            ) : notices.length > 0 ? (
                <span>{notices[0].message}</span>
            ) : (
                <span>
                    {changedCount === 0
                        ? t('page.makeShift.aiRefill.adjust.noChange')
                        : t('page.makeShift.aiRefill.adjust.applied', {count: changedCount ?? 0})}
                </span>
            )}
        </div>
    );
}
