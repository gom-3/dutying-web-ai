import type {TAutofillDTO, TSaveSnapshotDTO, TSnapshotCellDTO, TValidateSnapshotDTO} from '@dutying/api/ward';
import type {TShift} from '@/entities';
import {docToCarryOverCellsDTO, docToSnapshotCellsDTO, docToSnapshotRowOrderDTO} from './shift-adapter';
import type {TCellPos, TDutyDoc} from './types';

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
        carryOverCells: docToCarryOverCellsDTO(doc, originalShift, year, month),
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
    adjust?: TAutofillDTO['adjust'];
}): TAutofillDTO {
    const {year, month, draftRevision, rulesHash, doc, originalShift, prompt, lockedCellKeys, target, adjust} = params;

    return {
        year,
        month,
        prompt,
        draftRevision,
        rulesHash,
        rowOrder: docToSnapshotRowOrderDTO(doc),
        cells: docToSnapshotCellsDTO(doc, originalShift),
        carryOverCells: docToCarryOverCellsDTO(doc, originalShift, year, month),
        lockedCellKeys: lockedCellKeys ?? docToLockedCellKeys(doc),
        target,
        adjust,
        returnMode: 'PATCH',
    };
}

/**
 * 조절이 건드리면 안 되는 셀. 고정·신청 셀에 더해 **마지막 자동완성 이후 사용자가 손댄 칸**을
 * 포함한다.
 *
 * 사용자가 직접 고친 칸은 칩보다 강한 신호다. 그것까지 조절이 다시 옮기면, 방금 손으로
 * 맞춰 놓은 것이 눈앞에서 사라진다. 다만 이 잠금은 **요청에만** 실리고 doc 의 fixedCells 는
 * 건드리지 않는다 — 사용자가 찍은 적 없는 핀이 화면에 생기면 그것대로 혼란이다.
 */
export function adjustLockedCellKeys(doc: TDutyDoc, editedSinceLastAi: readonly TCellPos[]): string[] {
    const keys = new Set(docToLockedCellKeys(doc));

    editedSinceLastAi.forEach(({row, col}) => {
        const workerId = doc.rows[row]?.workerId;
        const date = doc.columns[col];

        if (workerId === undefined || date === undefined) return;

        keys.add(buildCellKey(Number(workerId), date));
    });

    return [...keys];
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
