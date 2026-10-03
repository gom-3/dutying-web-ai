import type {TAutofillResponse} from '@dutying/api/ward';
import type {TQualityMeasurement, TFailureSuggestion} from '@dutying/api/ward';
export type {TFailureSuggestion} from '@dutying/api/ward';

const names: Record<string, string> = {
    offTargetDeviation: '휴무 목표 차이',
    nightDeviation: '야간 균형 차이',
    fragmentationRate: '근무·휴무 분절률',
    minimumRecoveryHours: '최소 회복 시간',
    preferenceSatisfactionRate: '신청근무 충족률',
    changedCells: '변경한 칸',
};
const states: Record<string, string> = {
    KNOWN: '비교 가능',
    PARTIAL: '일부 비교 가능',
    UNKNOWN: '판단 자료 부족',
    BLOCKED: '수락되지 않은 후보',
};
const relations: Record<string, string> = {
    CANDIDATE_BETTER: '측정된 품질 개선',
    BASELINE_BETTER: '측정된 품질 악화',
    TRADEOFF: '개선과 손해가 함께 있음',
    TIE: '측정된 품질 동일',
    UNKNOWN: '비교 보류',
};

function value(v: TQualityMeasurement) {
    return v.state === 'KNOWN' && v.value !== null ? String(Math.round(v.value * 1000) / 1000) : '평가 안 됨';
}

export function ConversationEvidence({
    result,
    nurseName,
    suggestionsCurrent,
    disabled,
    onSelect,
}: {
    result: TAutofillResponse;
    nurseName: (id: string) => string;
    suggestionsCurrent: boolean;
    disabled: boolean;
    onSelect: (suggestion: TFailureSuggestion) => void;
}) {
    const quality = result.engineResult?.qualitySidebar;
    const suggestions = result.failure?.suggestions ?? [];

    return (
        <>
            {quality?.contractVersion === 'quality-sidebar-v1' && (
                <details className="mt-2 rounded border p-2">
                    <summary>품질 전후 변화 · {states[quality.comparisonState] ?? '판단 자료 부족'}</summary>
                    <p>{relations[quality.observedRelation] ?? '비교 보류'}</p>
                    {quality.harm.map((h) => (
                        <p key={h.metricId}>
                            {names[h.metricId] ?? h.metricId}: 비교 {h.comparableNurseCount}명 · 악화 {h.worsenedNurseCount}명 · 최대 손해{' '}
                            {h.maxWorsening ?? '평가 안 됨'} · 평가 안 됨 {h.unknownNurseIds.length}명
                        </p>
                    ))}
                    <p className="text-xs">품질 비교는 승인 판단을 대신하지 않습니다. 서로 다른 지표를 합산하지 않습니다.</p>
                    <details>
                        <summary>개인별 전후 수치</summary>
                        {quality.byNurse.map((n) => (
                            <div key={n.shiftNurseId}>
                                <p className="font-semibold">{nurseName(n.shiftNurseId)}</p>
                                {n.metrics.map((m) => (
                                    <p key={m.metricId}>
                                        {names[m.metricId] ?? m.metricId}: {value(m.before)} → {value(m.after)} ({m.unit}) ·{' '}
                                        {m.change === 'WORSENED'
                                            ? '악화'
                                            : m.change === 'IMPROVED'
                                              ? '개선'
                                              : m.change === 'UNCHANGED'
                                                ? '동일'
                                                : '평가 안 됨'}
                                    </p>
                                ))}
                            </div>
                        ))}
                    </details>
                    {quality.unknownReasons.length > 0 && <p className="text-xs">자료 부족: {quality.unknownReasons.join(', ')}</p>}
                </details>
            )}
            {suggestions.map((s) => (
                <div key={s.suggestionId} className="mt-2 rounded border p-2">
                    {s.changes.map((c, i) => (
                        <p key={i}>
                            {c.reason ?? '조건 변경 후보'} · {String(c.oldValue ?? '현재 조건')} → {String(c.proposedValue ?? '제안 조건')}
                        </p>
                    ))}
                    <p>
                        영향 {s.impact?.affectedNurseCount ?? '평가 안 됨'}명 · 최대 개인 손해{' '}
                        {s.impact?.maxIndividualDeterioration ?? '평가 안 됨'}
                    </p>
                    {Object.entries(s.impact?.individualDeterioration ?? {})
                        .filter(([, harm]) => harm.total > 0)
                        .map(([id, h]) => (
                            <p key={id}>
                                {nurseName(id)}: 휴무 감소 {h.offDaysLost}, 야간 증가 {h.nightDaysAdded}, 미충족 신청 증가{' '}
                                {h.newUnmetPreferences}
                            </p>
                        ))}
                    <p className="text-xs">
                        {s.verificationStatus === 'VERIFIED_FEASIBLE' ? '필수 조건 재검증을 통과한 대안' : '아직 검증되지 않은 후보'} · 선택
                        후 변경 내용을 확인하고 실행합니다.
                    </p>
                    <button
                        className="mt-1 rounded border px-2 py-1"
                        disabled={
                            disabled ||
                            !suggestionsCurrent ||
                            !s.applyEnabled ||
                            s.verificationStatus !== 'VERIFIED_FEASIBLE' ||
                            Date.parse(s.expiresAt) <= Date.now()
                        }
                        onClick={() => onSelect(s)}
                    >
                        후보 선택
                    </button>
                    {!suggestionsCurrent && <p>표 또는 조건이 바뀌어 제안이 만료되었습니다.</p>}
                </div>
            ))}
        </>
    );
}
