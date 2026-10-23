import type {TScheduleGoalCandidate, TScheduleGoalResult, TSnapshotCellDTO} from '@dutying/api/ward';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TProps = {
    candidate: TScheduleGoalCandidate;
    result: TScheduleGoalResult;
    changedCount: number;
    changedCells: TSnapshotCellDTO[];
    stale: boolean;
    /** 네트워크 응답만 유실된 apply 요청은 같은 eventId로 회복할 수 있다. */
    applyRecoveryPending: boolean;
    onApply: () => void;
    onDiscard: () => void;
};

/**
 * 목표 조절은 수치와 변경 범위를 먼저 보고 표에 반영한다. 일반 조절처럼 응답을 받는 즉시
 * 덮어쓰면, "개선" 결과를 성공으로 오해하거나 사람이 방금 고친 표에 오래된 후보를 적용할 수 있다.
 */
export function AiGoalCandidateReview({
    candidate,
    result,
    changedCount,
    changedCells,
    stale,
    applyRecoveryPending,
    onApply,
    onDiscard,
}: TProps) {
    const {t} = useTypedTranslation();
    const requiredUnmet = result.required && result.goalStatus !== 'SATISFIED';
    const canApply =
        !stale &&
        !requiredUnmet &&
        (candidate.applicationStatus === 'CREATED' || (candidate.applicationStatus === 'APPLIED' && applyRecoveryPending));

    return (
        <section
            className="border-line mx-4 mb-3 flex flex-col gap-2 rounded-xl border bg-violet-50 p-3"
            aria-label={t('aiAutofillUi.goalReview.title')}
        >
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-14 font-semibold">{t('aiAutofillUi.goalReview.title')}</h3>
                <span className="text-12 rounded-full bg-white px-2 py-0.5">
                    {result.required ? t('aiAutofillUi.goalReview.requiredGoal') : t('aiAutofillUi.goalReview.improvementGoal')}
                </span>
                <span className="text-12 rounded-full bg-white px-2 py-0.5">
                    {t(`aiAutofillUi.goalReview.status.${result.goalStatus}`)}
                </span>
            </div>
            <p className="text-13">
                {t('aiAutofillUi.goalReview.metrics', {
                    before: result.beforeSingleNightRuns,
                    after: result.afterSingleNightRuns,
                    difference: result.actualOffDifference,
                    allowed: result.maxOffDifference,
                })}
            </p>
            <p className="text-12 text-sub">
                {t('aiAutofillUi.goalReview.changes', {count: changedCount, unknown: result.boundaryUnknownCount})}
            </p>
            {changedCells.length > 0 && (
                <div className="text-12 text-sub flex flex-wrap gap-1" aria-label={t('aiAutofillUi.goalReview.changedCells')}>
                    {changedCells.slice(0, 12).map((cell, index) => (
                        <span key={cell.cellKey ?? `${cell.shiftNurseId}:${cell.date}:${index}`} className="rounded bg-white px-1.5 py-0.5">
                            {cell.nurseId ?? cell.shiftNurseId} · {cell.date.slice(5)} · {cell.shiftCode ?? '-'}
                        </span>
                    ))}
                    {changedCells.length > 12 && (
                        <span className="rounded bg-white px-1.5 py-0.5">
                            {t('aiAutofillUi.goalReview.moreCells', {count: changedCells.length - 12})}
                        </span>
                    )}
                </div>
            )}
            {requiredUnmet && <p className="text-12 text-red">{t('aiAutofillUi.goalReview.requiredUnmet')}</p>}
            {stale && <p className="text-12 text-red">{t('aiAutofillUi.goalReview.stale')}</p>}
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onDiscard} className="border-line text-13 rounded-full border px-3 py-1">
                    {t('aiAutofillUi.goalReview.discard')}
                </button>
                <button
                    type="button"
                    disabled={!canApply}
                    onClick={onApply}
                    className="text-13 rounded-full bg-primary px-3 py-1 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {applyRecoveryPending ? t('aiAutofillUi.goalReview.recoverApply') : t('aiAutofillUi.goalReview.apply')}
                </button>
            </div>
        </section>
    );
}
