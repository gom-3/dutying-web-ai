import {describe, expect, it} from 'vitest';
import {conversationDraftSignature} from '../conversation-draft-signature';
import type {TResultVersion} from '../schedule-conversation-api';
import actualRows from './fixtures/conversation-row-normalization.json';

type TDraft = Pick<TResultVersion, 'cells' | 'rowOrder' | 'carryOverCells'>;

const draft = (): TDraft => ({
    cells: [{shiftNurseId: 1, date: '2026-11-01', wardShiftTypeId: 4, fixed: true}],
    rowOrder: [
        {shiftNurseId: 1, displayOrder: 1, priority: 16384, divisionNum: 1},
        {shiftNurseId: 2, displayOrder: 2, priority: 6144, divisionNum: 2},
    ],
    carryOverCells: [{shiftNurseId: 1, date: '2026-10-31', wardShiftTypeId: 1, fixed: true}],
});

describe('conversation draft comparison', () => {
    it('matches Spring row normalization without changing either input', () => {
        const local = draft();
        const normalized = {...local, rowOrder: local.rowOrder.map((row, i) => ({...row, priority: (i + 1) * 1024}))};
        const before = JSON.stringify([local, normalized]);

        expect(conversationDraftSignature(local)).toBe(conversationDraftSignature(normalized));
        expect(JSON.stringify([local, normalized])).toBe(before);
    });
    it('uses effective display order rather than array transport order or sparse ranks', () => {
        const local = draft();
        const transport = {
            ...local,
            rowOrder: [
                {...local.rowOrder[1]!, displayOrder: 40},
                {...local.rowOrder[0]!, displayOrder: 10},
            ],
        };

        expect(conversationDraftSignature(local)).toBe(conversationDraftSignature(transport));
    });
    it.each(['assignment', 'fixed', 'date', 'nurse', 'rowOrder', 'division', 'carry', 'missingRow'] as const)(
        'keeps a real %s change distinct',
        (change) => {
            const local = draft();
            const changed = structuredClone(local);

            if (change === 'assignment') changed.cells[0]!.wardShiftTypeId = 1;

            if (change === 'fixed') changed.cells[0]!.fixed = false;

            if (change === 'date') changed.cells[0]!.date = '2026-11-02';

            if (change === 'nurse') changed.cells[0]!.shiftNurseId = 2;

            if (change === 'rowOrder') changed.rowOrder[0]!.displayOrder = 3;

            if (change === 'division') changed.rowOrder[0]!.divisionNum = 2;

            if (change === 'carry') changed.carryOverCells[0]!.wardShiftTypeId = 4;

            if (change === 'missingRow') changed.rowOrder.pop();

            expect(conversationDraftSignature(local)).not.toBe(conversationDraftSignature(changed));
        },
    );
});

it('matches the actual anonymized 16-row development sync despite its 11 rewritten priorities', () => {
    const local = {...draft(), rowOrder: actualRows.workspaceRowOrder};
    const synced = {...draft(), rowOrder: actualRows.syncedRowOrder};

    expect(local.rowOrder).toHaveLength(16);
    expect(local.rowOrder.filter((row, index) => row.priority !== synced.rowOrder[index]!.priority)).toHaveLength(11);
    expect(conversationDraftSignature(local)).toBe(conversationDraftSignature(synced));
});
