import type {TResultVersion} from './schedule-conversation-api';

/** Compare the draft Spring executes, without changing the editor or its protected cells. */
export const conversationDraftSignature = (version: Pick<TResultVersion, 'cells' | 'rowOrder' | 'carryOverCells'>) =>
    JSON.stringify([
        version.cells
            .map((cell) => [cell.shiftNurseId, cell.date, cell.wardShiftTypeId ?? null, Boolean(cell.fixed)])
            .sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`)),
        // ScheduleAuthoringService.normalizeRowOrder sorts by displayOrder, then replaces
        // both displayOrder and priority with rank-based values. Persisted sparse priorities
        // are therefore not an edit when the effective nurse order and groups are unchanged.
        [...version.rowOrder]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((row, index) => [row.shiftNurseId, index + 1, (index + 1) * 1024, row.divisionNum]),
        (version.carryOverCells ?? [])
            .map((cell) => [cell.shiftNurseId, cell.date, cell.wardShiftTypeId ?? null])
            .sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`)),
    ]);
