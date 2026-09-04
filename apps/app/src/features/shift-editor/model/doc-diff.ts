import type {TCellPos, TDutyDoc} from './types';

/** doc 내부 셀 키. `${workerId}|${date}` 이며 서버로 보내는 `${shiftNurseId}:${date}` 와 다르다. */
export function getDocCellKey(doc: TDutyDoc, row: number, col: number): string | null {
    if (col < 0) return null;

    const workerId = doc.rows[row]?.workerId;
    const date = doc.columns[col];

    if (!workerId || !date) return null;

    return `${workerId}|${date}`;
}

/**
 * 기준 시점 이후 사람이 바꾼 칸.
 *
 * 고정·신청 셀과 빈 칸은 제외한다 — 전자는 애초에 사람 의도가 이미 확정된 자리이고, 후자는
 * "지웠다"가 "다르게 채웠다"와 같은 신호가 아니기 때문이다.
 *
 * 두 곳에서 쓴다. 재생성 전 "고정할까요?" 판단과, 조절 결과의 "N칸이 바뀌었어요" 계산이다.
 * 후자는 응답의 changedCells 길이가 아니라 이 값을 쓴다 — 고정·신청 셀로 스킵된 칸이
 * changedCells 에는 남아 있어 실제 적용 수와 어긋날 수 있다.
 */
export function getEditedFilledCellsSinceBaseline(currentDoc: TDutyDoc, baselineDoc: TDutyDoc | null): TCellPos[] {
    if (!baselineDoc) return [];

    const baselineValueByKey = new Map<string, string | null>();

    for (const row of baselineDoc.rows) {
        for (let col = 0; col < baselineDoc.columns.length; col += 1) {
            const date = baselineDoc.columns[col];

            if (!date) continue;

            baselineValueByKey.set(`${row.workerId}|${date}`, row.cells[col] ?? null);
        }
    }

    const cells: TCellPos[] = [];

    for (let row = 0; row < currentDoc.rows.length; row += 1) {
        const dutyRow = currentDoc.rows[row];

        if (!dutyRow) continue;

        for (let col = 0; col < currentDoc.columns.length; col += 1) {
            const key = getDocCellKey(currentDoc, row, col);

            if (key === null) continue;

            if (currentDoc.fixedCells[key] === true || currentDoc.requestCells[key] === true) continue;

            const currentValue = dutyRow.cells[col] ?? null;

            if (currentValue === null) continue;

            if (baselineValueByKey.get(key) === currentValue) continue;

            cells.push({row, col});
        }
    }

    return cells;
}
