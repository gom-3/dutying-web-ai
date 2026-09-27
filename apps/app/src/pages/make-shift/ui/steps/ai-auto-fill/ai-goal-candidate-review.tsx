import type {TScheduleGoalCandidate, TScheduleGoalResult, TSnapshotCellDTO} from '@dutying/api/ward';

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
export function AiGoalCandidateReview({candidate, result, changedCount, changedCells, stale, applyRecoveryPending, onApply, onDiscard}: TProps) {
    const requiredUnmet = result.required && result.goalStatus !== 'SATISFIED';
    const canApply = !stale && !requiredUnmet
        && (candidate.applicationStatus === 'CREATED' || (candidate.applicationStatus === 'APPLIED' && applyRecoveryPending));

    return (
        <section className="border-line mx-4 mb-3 flex flex-col gap-2 rounded-xl border bg-violet-50 p-3" aria-label="목표 조절 결과 검토">
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-14 font-semibold">목표 조절 결과 검토</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-12">{result.required ? '필수 목표' : '개선 목표'}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-12">{result.goalStatus}</span>
            </div>
            <p className="text-13">
                하루짜리 나이트 {result.beforeSingleNightRuns}건 → {result.afterSingleNightRuns}건 · O 편차 {result.actualOffDifference}일
                (허용 {result.maxOffDifference}일)
            </p>
            <p className="text-12 text-sub">
                변경 셀 {changedCount}칸 · 월 경계 미확정 {result.boundaryUnknownCount}건
            </p>
            {changedCells.length > 0 && (
                <div className="flex flex-wrap gap-1 text-12 text-sub" aria-label="변경 셀">
                    {changedCells.slice(0, 12).map((cell, index) => (
                        <span key={cell.cellKey ?? `${cell.shiftNurseId}:${cell.date}:${index}`} className="rounded bg-white px-1.5 py-0.5">
                            {cell.nurseId ?? cell.shiftNurseId} · {cell.date.slice(5)} · {cell.shiftCode ?? '-'}
                        </span>
                    ))}
                    {changedCells.length > 12 && <span className="rounded bg-white px-1.5 py-0.5">외 {changedCells.length - 12}칸</span>}
                </div>
            )}
            {requiredUnmet && <p className="text-12 text-red">필수 목표를 달성하지 못해 이 후보는 적용할 수 없습니다.</p>}
            {stale && <p className="text-12 text-red">표가 실행 뒤 변경되어 이 후보는 오래되었습니다. 다시 계산해 주세요.</p>}
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onDiscard} className="border-line rounded-full border px-3 py-1 text-13">
                    버리기
                </button>
                <button
                    type="button"
                    disabled={!canApply}
                    onClick={onApply}
                    className="rounded-full bg-primary px-3 py-1 text-13 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {applyRecoveryPending ? '적용 결과 복구' : '표에 적용'}
                </button>
            </div>
        </section>
    );
}
