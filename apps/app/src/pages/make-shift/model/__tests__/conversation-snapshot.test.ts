import {describe, expect, it} from 'vitest';
import {buildConversationSnapshot} from '../conversation-snapshot';
import type {TResultVersion} from '../schedule-conversation-api';

const version: TResultVersion = {
    versionId: 'past',
    parentVersionId: null,
    year: 2026,
    month: 10,
    createdAt: '2026-10-03',
    inputDigest: 'past',
    rowOrder: [
        {shiftNurseId: 2, displayOrder: 1, divisionNum: 1},
        {shiftNurseId: 1, displayOrder: 0, divisionNum: 1},
    ],
    cells: [
        {shiftNurseId: 1, date: '2026-10-01', wardShiftTypeId: 1, shiftCode: 'D', fixed: true},
        {shiftNurseId: 2, date: '2026-10-01', wardShiftTypeId: 1, shiftCode: 'D', fixed: false},
    ],
    carryOverCells: [{shiftNurseId: 2, date: '2026-09-30', wardShiftTypeId: 1, shiftCode: 'D', fixed: false}],
    constraintsJson: JSON.stringify({
        rows: [
            {shiftNurseId: 1, name: '저장 당시 이름'},
            {shiftNurseId: 2, name: '삭제된 간호사'},
            {shiftNurseId: 99, name: '표 밖의 간호사'},
        ],
        shiftTypes: [
            {wardShiftTypeId: 1, code: 'D', name: '저장 당시 Day', color: '#44c4b0', isOff: false, isCounted: true, classification: 'DAY'},
        ],
        calendarDays: [{date: '2026-10-01', isHoliday: true}],
    }),
};

describe('immutable conversation snapshot rendering', () => {
    it('uses only saved rows in saved order, including removed nurses and excluding other metadata rows', () => {
        const {shift, doc} = buildConversationSnapshot(version);
        expect(doc.rows.map((row) => row.workerId)).toEqual(['1', '2']);
        expect(shift.divisionShiftNurses.flat().map((row) => row.shiftNurse.name)).toEqual(['저장 당시 이름', '삭제된 간호사']);
        expect(doc.workerMeta['99']).toBeUndefined();
        expect(doc.rows[0]?.cells.slice(0, 2)).toEqual(['D', null]);
        expect(doc.rows[0]?.lastCells).toEqual([null]);
        expect(doc.rows[1]?.lastCells).toEqual(['D']);
        expect(shift.days[0]?.dayType).toBe('holiday');
        expect(shift.wardShiftTypes[0]?.color).toBe('#44c4b0');
    });
    it('preserves the saved shift-type column order even when the first assigned cell uses another type', () => {
        const context = JSON.parse(version.constraintsJson);
        const snapshot = {
            ...version,
            constraintsJson: JSON.stringify({
                ...context,
                shiftTypes: [{wardShiftTypeId: 2, code: 'E', name: 'Evening'}, ...context.shiftTypes],
            }),
        };
        expect(buildConversationSnapshot(snapshot).shift.wardShiftTypes.map((type) => type.shortName)).toEqual(['E', 'D']);
    });
    it('keeps unknown historical metadata explicit instead of substituting current data', () => {
        const {shift, doc} = buildConversationSnapshot({...version, constraintsJson: '{}'});
        expect(shift.divisionShiftNurses.flat().map((row) => row.shiftNurse.name)).toEqual(['#1', '#2']);
        expect(doc.rows[0]?.cells[0]).toBe('D');
        expect(doc.rows[0]?.cells[1]).toBeNull();
    });
    it('does not turn missing or explicitly empty saved cells into another assignment', () => {
        const {doc} = buildConversationSnapshot({...version, cells: [{...version.cells[0]!, wardShiftTypeId: null, shiftCode: null}]});
        expect(doc.rows.every((row) => row.cells.every((cell) => cell === null))).toBe(true);
    });
    it('reconstructs before and result independently without modifying either input', () => {
        const initial = JSON.stringify(version);
        const before = {...version, rowOrder: [version.rowOrder[1]!], cells: [], carryOverCells: []};
        expect(buildConversationSnapshot(before).doc.rows.map((row) => row.workerId)).toEqual(['1']);
        expect(buildConversationSnapshot(before).doc.rows[0]?.cells[0]).toBeNull();
        expect(buildConversationSnapshot(version).doc.rows.map((row) => row.workerId)).toEqual(['1', '2']);
        expect(JSON.stringify(version)).toEqual(initial);
    });
});
