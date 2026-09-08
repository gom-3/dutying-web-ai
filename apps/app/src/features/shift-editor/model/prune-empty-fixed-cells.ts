import type {TDutyDoc} from './types';

/**
 * 근무가 없는 칸의 고정 표시를 떼어 낸다.
 *
 * "고정인데 빈 칸" 은 지킬 근무가 없는 잠금이라 얻는 것이 없는 반면, 잃는 것은 크다.
 * 자동완성 엔진은 편집 가능한 빈 칸을 모두 채워야 하는데 고정 셀은 손댈 수 없어,
 * 그런 칸이 하나라도 있으면 `immutable_empty_cell` 로 **그 달 전체**를 반려한다
 * (2026-09-08 병동 610, 간호사 3명의 6칸 때문에 450칸이 통째로 죽었다).
 * 서버가 엔진 호출 직전에 같은 잠금을 떨어뜨리게 됐지만, 그것만으로는 화면이 낫지 않는다 —
 * `applyChangedCells` 가 고정 셀에 온 패치를 버리므로 그 칸은 계속 비어 있게 된다.
 *
 * 잠금은 값이 있을 때만 만들어지지만(`cmdSetFixed` 는 빈 칸을 고정하지 않는다),
 * 값과 잠금이 따로 들어오는 길이 여럿이라 어긋난 상태가 store 로 들어온다.
 * - 옛 스냅샷 버전 불러오기: 화면의 잠금을 유지한 채 값만 그 버전으로 바뀐다.
 * - 병동 워크스페이스: 근무유형이 비어 있는 수락 신청근무가 `fixed=true` 로 내려온다.
 * - 로컬 draft 복원 + 근무유형 rebase: 사라진 근무유형의 칸이 `null` 로 되살아난다.
 *
 * 그래서 개별 경로가 아니라 **doc 이 store 로 들어오는 길목**(`init`·`hydrate`)에서 한 번 정리한다.
 */
export function pruneEmptyFixedCells(doc: TDutyDoc): TDutyDoc {
    const keys = Object.keys(doc.fixedCells);

    if (keys.length === 0) return doc;

    const colIndexByDate = new Map(doc.columns.map((date, index) => [date, index]));
    const rowByWorkerId = new Map(doc.rows.map((row) => [row.workerId, row]));
    const nextFixedCells: TDutyDoc['fixedCells'] = {};

    let pruned = false;

    for (const key of keys) {
        const separator = key.lastIndexOf('|');
        const workerId = key.slice(0, separator);
        const date = key.slice(separator + 1);
        const row = rowByWorkerId.get(workerId);
        const colIndex = colIndexByDate.get(date);

        // 지금 doc 에 없는 행·날짜의 잠금은 건드리지 않는다. 값이 없다고 단정할 수 없고,
        // 행이 잠깐 비어 있는 사이에 사용자가 걸어 둔 고정을 영구히 지울 수 있다.
        // 이런 키는 어차피 doc.rows 를 도는 요청 변환에서 밖으로 나가지 않는다.
        if (!row || colIndex === undefined || (row.cells[colIndex] ?? null) !== null) {
            nextFixedCells[key] = true;
            continue;
        }

        pruned = true;
    }

    return pruned ? {...doc, fixedCells: nextFixedCells} : doc;
}
