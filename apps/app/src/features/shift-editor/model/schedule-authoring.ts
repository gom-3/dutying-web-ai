import type {TAutofillDTO, TSaveSnapshotDTO, TSnapshotCellDTO, TValidateSnapshotDTO} from '@dutying/api/ward';
import type {TShift} from '@/entities';
import {docToSnapshotCellsDTO, docToSnapshotRowOrderDTO} from './shift-adapter';
import type {TDutyDoc} from './types';

export function buildCellKey(shiftNurseId: number, date: string): string {
    return `${shiftNurseId}:${date}`;
}

/** fixed·신청근무 등 AI/수동 편집에서 보호할 셀 키 */
export function docToLockedCellKeys(doc: TDutyDoc): string[] {
    const keys: string[] = [];

    for (const row of doc.rows) {
        const shiftNurseId = Number(row.workerId);

        for (let colIdx = 0; colIdx < doc.columns.length; colIdx += 1) {
            const date = doc.columns[colIdx]!;

            if (!date) continue;

            const key = `${row.workerId}|${date}`;

            if (doc.fixedCells[key] === true || doc.requestCells[key] === true) {
                keys.push(buildCellKey(shiftNurseId, date));
            }
        }
    }

    return keys;
}

export function buildValidateSnapshotDTO(params: {
    year: number;
    month: number;
    draftRevision: number;
    rulesHash: string;
    doc: TDutyDoc;
    originalShift: TShift;
}): TValidateSnapshotDTO {
    const {year, month, draftRevision, rulesHash, doc, originalShift} = params;

    return {
        year,
        month,
        draftRevision,
        rulesHash,
        cells: docToSnapshotCellsDTO(doc, originalShift),
        rowOrder: docToSnapshotRowOrderDTO(doc),
    };
}

export function buildAutofillDTO(params: {
    year: number;
    month: number;
    draftRevision: number;
    rulesHash: string;
    doc: TDutyDoc;
    originalShift: TShift;
    prompt?: string;
    lockedCellKeys?: string[];
    target?: TAutofillDTO['target'];
}): TAutofillDTO {
    const {year, month, draftRevision, rulesHash, doc, originalShift, prompt, lockedCellKeys, target} = params;

    return {
        year,
        month,
        prompt,
        draftRevision,
        rulesHash,
        rowOrder: docToSnapshotRowOrderDTO(doc),
        cells: docToSnapshotCellsDTO(doc, originalShift),
        lockedCellKeys: lockedCellKeys ?? docToLockedCellKeys(doc),
        target,
        returnMode: 'PATCH',
    };
}

export function buildSaveSnapshotDTO(params: {
    snapshotId?: number;
    title: string;
    year: number;
    month: number;
    doc: TDutyDoc;
    originalShift: TShift;
    prompt?: string;
    baseHash?: string;
}): TSaveSnapshotDTO {
    const {snapshotId, title, year, month, doc, originalShift, prompt, baseHash} = params;

    return {
        snapshotId,
        title,
        year,
        month,
        prompt,
        baseHash,
        cells: docToSnapshotCellsDTO(doc, originalShift),
        rowOrder: docToSnapshotRowOrderDTO(doc),
    };
}

export function workspaceCellsToFixedCells(cells: TSnapshotCellDTO[]): Record<string, true> {
    const fixed: Record<string, true> = {};

    for (const cell of cells) {
        if (!cell.fixed) continue;

        fixed[`${cell.shiftNurseId}|${cell.date}`] = true;
    }

    return fixed;
}
