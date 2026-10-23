import type {TAutofillResponse, TScheduleAdjustmentNotice, TScheduleGoalResult, TScheduleRequestRuleResult} from '@dutying/api/ward';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TProps = {
    /** 직전 조절이 옮긴 칸 수. 조절을 아직 안 했으면 null. */
    changedCount: number | null;
    /** 실패는 토스트로만 끝내지 않는다. 다음 행동을 판단할 수 있도록 표 위에 남긴다. */
    failure?: string | null;
    onReviewFailure?: () => void;
    ruleResults: TScheduleRequestRuleResult[];
    notices?: TScheduleAdjustmentNotice[];
    goalResult?: TScheduleGoalResult | null;
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
export default function AiAdjustResultNote({
    changedCount,
    failure,
    onReviewFailure,
    ruleResults,
    notices = [],
    goalResult,
    offGoal,
    isStrongest,
    disabled,
    onAdjustHarder,
}: TProps) {
    const {t} = useTypedTranslation();
    const unmet = ruleResults.find((entry) => (entry.violationCount ?? 0) > 0);
    const offGoalUnmet = offGoal && offGoal.goalStatus !== 'SATISFIED';
    const offGoalLabel =
        offGoal?.operation === 'SET_TARGET'
            ? t('aiAutofillUi.resultNote.offTargetDifference', {targetOff: offGoal.targetOff ?? 0, deviation: offGoal.totalDeviation ?? 0})
            : offGoal?.operation === 'INCREASE_TO_BASELINE'
              ? t('aiAutofillUi.resultNote.offBaselineDeficit', {deficit: offGoal.totalDeficit ?? 0})
              : t('aiAutofillUi.resultNote.offMinimumDeficit', {minimumOff: offGoal?.minimumOff ?? 0, deficit: offGoal?.totalDeficit ?? 0});

    if (changedCount === null && !failure && !unmet && !goalResult && !offGoal && notices.length === 0) return null;

    return (
        <div className="ai-adjust-result-note text-12 text-sub flex flex-wrap items-center gap-2 px-4" role={failure ? 'alert' : 'status'}>
            {failure ? (
                <>
                    <span>{t('aiAdjust.executionFailure.summary')}</span>
                    {onReviewFailure && (
                        <button
                            type="button"
                            className="min-h-11 rounded-lg px-3 text-main-1 hover:bg-main-light focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none"
                            onClick={onReviewFailure}
                        >
                            {t('aiAdjust.executionFailure.openChat')}
                        </button>
                    )}
                </>
            ) : offGoalUnmet ? (
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
            ) : goalResult ? (
                <span>
                    {t('aiAutofillUi.resultNote.goalSummary', {
                        before: goalResult.beforeSingleNightRuns,
                        after: goalResult.afterSingleNightRuns,
                        difference: goalResult.actualOffDifference,
                        unknown: goalResult.boundaryUnknownCount,
                    })}
                </span>
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
