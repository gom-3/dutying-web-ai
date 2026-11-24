import type {TAutofillResponse, TSnapshotCellDTO} from '@dutying/api/ward';
import type {TDutyDoc} from '@/features/shift-editor';
import type {TInterpretCell} from './schedule-month-requests';

export type TAdjustChange = {name: string; date: string; before: string | null; after: string | null};
export type TAdjustApplyResult = {
    response: TAutofillResponse;
    changes: TAdjustChange[];
    applied: boolean;
    undoRevision?: number;
};

/** Stage explicit cell assignments without changing the editor or its undo history. */
export function prepareAdjustDoc(doc: TDutyDoc, cells: TInterpretCell[], shiftCodes: string[]): TDutyDoc {
    const next = {...doc, rows: doc.rows.map((row) => ({...row, cells: [...row.cells]})), fixedCells: {...doc.fixedCells}};

    for (const {nurseId, date, shiftCode} of cells) {
        const row = next.rows.find((entry) => doc.workerMeta[entry.workerId]?.nurseId === nurseId);
        const col = doc.columns.indexOf(date);

        if (!row || col < 0 || !shiftCodes.includes(shiftCode)) throw new Error('INVALID_CELL');

        const key = `${row.workerId}|${date}`;

        if ((doc.fixedCells[key] || doc.requestCells[key]) && row.cells[col] !== shiftCode) throw new Error('LOCKED_CELL');

        row.cells[col] = shiftCode;

        if (!doc.requestCells[key]) next.fixedCells[key] = true;
    }

    return next;
}

export function mergeAdjustPatch(doc: TDutyDoc, cells: TSnapshotCellDTO[], shiftCodes: Map<number, string>): TDutyDoc {
    const next = {...doc, rows: doc.rows.map((row) => ({...row, cells: [...row.cells]}))};

    for (const cell of cells) {
        const row = next.rows.find((entry) => entry.workerId === String(cell.shiftNurseId));
        const col = next.columns.indexOf(cell.date);
        const key = `${cell.shiftNurseId}|${cell.date}`;

        if (!row || col < 0 || next.fixedCells[key] || next.requestCells[key]) continue;

        row.cells[col] = (cell.wardShiftTypeId != null ? shiftCodes.get(cell.wardShiftTypeId) : undefined) ?? cell.shiftCode ?? null;
    }

    return next;
}

export function describeAdjustChanges(before: TDutyDoc, after: TDutyDoc): TAdjustChange[] {
    return after.rows.flatMap((row) => {
        const previous = before.rows.find((entry) => entry.workerId === row.workerId);

        return after.columns.flatMap((date, col) => {
            const oldValue = previous?.cells[before.columns.indexOf(date)] ?? null;
            const newValue = row.cells[col] ?? null;

            return oldValue === newValue
                ? []
                : [{name: after.workerMeta[row.workerId]?.name ?? row.workerId, date, before: oldValue, after: newValue}];
        });
    });
}

/** A delta such as “3 days” cannot be resolved by this stateless API without guessing. */
export function isIncompleteRevision(text: string): boolean {
    return /^(?:아니[,.]?\s*)?(?:그거|그건|그것|이거|똑같이|그대로|취소|더|덜|\d+\s*(?:일|번|명)(?:로|만|이내로)?)[.!?\s]*$/.test(
        text.trim(),
    );
}

/** The entire command must authorize only filling empty cells. */
export function isEmptyOnlyFillCommand(text: string): boolean {
    const command = text.trim();
    if (/^fill this month[’']s blanks and keep existing assignments[.!]?$/iu.test(command)) return true;
    if (/^기존 배정은 유지하고 이번 달 전체의 빈 칸을 채워 줘[.!。]?$/u.test(command)) return true;
    if (/^既存の割り当てを維持して今月全体の空欄を埋めて[。！!]?$/u.test(command)) return true;

    return /^(?:(?:수락(?:된|한)\s*)?(?:원티드|신청\s*근무|신청\s*휴무)(?:\s*한\s*(?:거|것))?(?:는|은|을|를)?\s*(?:그대로\s*두고|유지하고|보존하고)\s*[,，]?\s*)?빈\s*칸(?:만|을)?\s*채워\s*(?:줘요?|주세요)[.!。]?$/u.test(
        command,
    );
}

/** Only standalone generation commands; extra conditions and negation require interpretation. */
export function isPlainAutofillCommand(text: string): boolean {
    return /^(?:다시\s*)?(?:AI\s*채우기|채우기|자동완성|자동채우기|자동\s*채우기)\s*(?:해\s*줘|해주세요|해\s*주세요|해줘요)?[.!。]?$/iu.test(
        text.trim(),
    );
}
