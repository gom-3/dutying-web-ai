import type {TAutofillResponse, TScheduleConflict} from '@dutying/api/ward';
import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useShiftEditorStore} from '@/features/shift-editor/model/store';
import type {TDutyDoc} from '@/features/shift-editor/model/types';
import {ShiftEditorGrid} from '@/features/shift-editor/ui/shift-editor-grid';
import i18n from '@/i18n';
import {aiExecutionFailure} from '../../../../model/ai-execution-failure';
import {conflictCellPosition, readScheduleConflicts} from '../../../../model/schedule-conflicts';
import {AiExecutionFailure} from '../ai-execution-failure';

const conflict: TScheduleConflict = {
    date: '2026-11-01',
    shiftCodes: ['D', 'E', 'N'],
    required: 11,
    available: 10,
    ruleIds: [10, 11, 12, 20],
    nurses: [{shiftNurseId: 3, name: 'Nurse 3', reason: 'CONSECUTIVE_WORK_LIMIT', maximumWorkDays: 5}],
    fixedAssignments: [
        {shiftNurseId: 3, name: 'Nurse 3', date: '2026-10-31', wardShiftTypeId: 1, shiftCode: 'D', readOnly: true},
        {shiftNurseId: 3, name: 'Nurse 3', date: '2026-11-02', wardShiftTypeId: 3, shiftCode: 'N', readOnly: false},
        {shiftNurseId: 7, name: 'Nurse 7', date: '2026-11-01', wardShiftTypeId: 4, shiftCode: 'O', readOnly: true},
    ],
};

function response(): TAutofillResponse {
    return {
        operationType: 'GENERATE',
        draftRevision: 9,
        resultType: 'PATCH',
        changedCells: [],
        applicable: false,
        unmetInstructions: [],
        sameAsPrevious: true,
        engineResult: {status: 'INFEASIBLE'},
        validation: {
            draftRevision: 9,
            rulesHash: 'rules',
            summary: {valid: false, hardCount: 1, softCount: 0, totalCount: 1},
            violations: [],
        },
        failure: {reasonCode: 'PROPAGATED_STAFFING_CONFLICT', message: 'internal text must not leak', conflicts: [conflict]},
    };
}

const doc: TDutyDoc = {
    columns: ['2026-11-01', '2026-11-02'],
    rows: [
        {workerId: '7', cells: ['O', null]},
        {workerId: '3', cells: [null, 'N']},
    ],
    workerMeta: {'3': {name: 'Nurse 3'}, '7': {name: 'Nurse 7'}},
    fixedCells: {'3|2026-11-02': true},
    requestCells: {'7|2026-11-01': true},
};

beforeEach(() => {
    useShiftEditorStore.getState().reset();
    useShiftEditorStore.setState({doc: structuredClone(doc), draftRevision: 9, rulesHash: 'rules'});
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        callback(0);

        return 1;
    });
});
afterEach(() => vi.unstubAllGlobals());

describe('actionable conflict evidence', () => {
    it.each(['ko', 'en', 'ja'])('shows the exact shortage and readonly sources in %s without retrying', async (language) => {
        await i18n.changeLanguage(language);

        const failure = aiExecutionFailure(response())!;
        const retry = vi.fn();

        render(<AiExecutionFailure failure={failure} active onRetry={retry} operationType="GENERATE" />);

        expect(failure.recovery).toBe('review');
        expect(screen.getAllByText(/11.*10/).length).toBeGreaterThan(0);
        expect(screen.getByText(/2026-10-31.*Nurse 3.*D/)).toHaveTextContent(i18n.t('aiAdjust.executionFailure.priorReadOnly'));
        expect(screen.getByText(/2026-11-01.*Nurse 7.*O/)).toHaveTextContent(i18n.t('aiAdjust.executionFailure.acceptedReadOnly'));
        expect(screen.queryByRole('button', {name: i18n.t('aiAdjust.failure.retry')})).not.toBeInTheDocument();
        expect(screen.queryByText('internal text must not leak')).not.toBeInTheDocument();
        expect(retry).not.toHaveBeenCalled();
    });

    it('selects the current nurse/date and focuses its cell without editing assignments, locks or accepted requests', () => {
        const close = vi.fn();
        const failure = aiExecutionFailure(response())!;
        const before = useShiftEditorStore.getState();

        render(
            <>
                <div id="schedule-cell-3-2026-11-01" tabIndex={-1} data-testid="target" />
                <AiExecutionFailure failure={failure} active onInspectSchedule={close} />
            </>,
        );
        fireEvent.click(screen.getByRole('button', {name: /Nurse 3/}));

        const after = useShiftEditorStore.getState();

        expect(after.selection).toEqual({type: 'single', anchor: {row: 1, col: 0}});
        expect(screen.getByTestId('target')).toHaveFocus();
        expect(close).toHaveBeenCalledTimes(1);
        expect(after.doc).toBe(before.doc);
        expect(after.history).toBe(before.history);
        expect(after.draftRevision).toBe(before.draftRevision);
    });

    it('disables links after a local edit or rules change and for historical failures', () => {
        const failure = aiExecutionFailure(response())!;
        const {rerender} = render(<AiExecutionFailure failure={failure} active />);

        act(() => useShiftEditorStore.setState({draftRevision: 10}));
        expect(screen.getByRole('status')).toHaveTextContent(i18n.t('aiAdjust.executionFailure.conflictStale'));
        expect(screen.getByRole('button', {name: /Nurse 3/})).toBeDisabled();
        act(() => useShiftEditorStore.setState({draftRevision: 9, rulesHash: 'changed'}));
        expect(screen.getByRole('button', {name: /Nurse 3/})).toBeDisabled();
        act(() => useShiftEditorStore.setState({rulesHash: 'rules'}));
        rerender(<AiExecutionFailure failure={failure} />);
        expect(screen.getByRole('button', {name: /Nurse 3/})).toBeDisabled();
        expect(useShiftEditorStore.getState().selection).toBeNull();
    });

    it('allows manual keyboard editing after inspection using existing editor protections', async () => {
        await i18n.changeLanguage('ko');

        const failure = aiExecutionFailure(response())!;

        render(
            <>
                <ShiftEditorGrid />
                <AiExecutionFailure failure={failure} active />
            </>,
        );
        fireEvent.click(screen.getByRole('button', {name: /Nurse 3 ·/}));

        const target = document.getElementById('schedule-cell-3-2026-11-01')!;

        expect(target).toHaveFocus();
        fireEvent.keyDown(target, {key: 'o'});

        const state = useShiftEditorStore.getState();

        expect(state.doc.rows[1].cells).toEqual(['O', 'N']);
        expect(state.doc.fixedCells).toEqual(doc.fixedCells);
        expect(state.doc.requestCells).toEqual(doc.requestCells);
        expect(state.doc.rows[0].cells[0]).toBe('O');
        expect(state.history.past).toHaveLength(1);
        expect(screen.getByRole('button', {name: /Nurse 3 ·/})).toBeDisabled();
    });

    it.each([
        {date: '2026-11-02', name: 'Nurse 3', nurse: 3, row: 1, col: 1, expected: 'N'},
        {date: '2026-11-01', name: 'Nurse 7', nurse: 7, row: 0, col: 0, expected: 'O'},
    ])('keeps fixed and accepted assignments protected after inspecting $name on $date', ({date, name, nurse, row, col, expected}) => {
        const failure = aiExecutionFailure(response())!;
        const before = useShiftEditorStore.getState();

        render(
            <>
                <ShiftEditorGrid />
                <AiExecutionFailure failure={failure} active />
            </>,
        );

        const item = screen.getByText(`${date} · ${name} · ${expected}`, {exact: false}).closest('li')!;

        fireEvent.click(within(item).getByRole('button', {name: i18n.t('aiAdjust.executionFailure.inspectCell')}));

        const target = document.getElementById(`schedule-cell-${nurse}-${date}`)!;

        expect(target).toHaveFocus();
        fireEvent.keyDown(target, {key: 'd'});

        const after = useShiftEditorStore.getState();

        expect(after.doc.rows[row].cells[col]).toBe(expected);
        expect(after.doc).toBe(before.doc);
        expect(after.draftRevision).toBe(before.draftRevision);
        expect(after.history).toBe(before.history);
    });

    it('does not map a previous month, different team, removed nurse or changed assignment to another cell', () => {
        expect(conflictCellPosition(doc, 3, '2026-10-31')).toBeNull();
        expect(conflictCellPosition(doc, 999, '2026-11-01')).toBeNull();
        expect(conflictCellPosition({...doc, columns: ['2026-12-01']}, 3, '2026-11-01')).toBeNull();
        expect(conflictCellPosition(doc, 3, '2026-11-02', 'D')).toBeNull();
    });

    it('refuses malformed evidence and does not call a timeout a proven conflict', () => {
        for (const update of [
            {date: '2026-02-31'},
            {required: 10},
            {available: -1},
            {nurses: [null]},
            {fixedAssignments: [null]},
            {ruleIds: [NaN]},
        ]) {
            expect(readScheduleConflicts([{...conflict, ...update}])).toEqual([]);
        }

        const result = response();

        result.engineResult!.status = 'TIME_LIMIT';
        expect(aiExecutionFailure(result)?.conflicts).toBeUndefined();
    });
});
