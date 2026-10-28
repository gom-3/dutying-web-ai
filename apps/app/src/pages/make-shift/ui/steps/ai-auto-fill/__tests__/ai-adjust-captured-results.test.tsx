import type {TScheduleAdjustInterpretRes} from '@dutying/api/ward';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {useShiftEditorStore} from '@/features/shift-editor';
import type {TDutyDoc} from '@/features/shift-editor/model/types';
import type {TAdjustApplyResult} from '../../../../model/ai-adjust-conversation';
import AiAdjustTextInput from '../ai-adjust-text-input';
import type {TAutofillFlow} from '../ai-autofill-preparation';

const capture = vi.hoisted(() => vi.fn());

vi.mock('@/shared/hook/use-typed-translation', () => ({useTypedTranslation: () => ({t: (key: string) => key})}));
vi.mock('../ai-result-snapshot', () => ({
    AiResultSnapshot: (props: {doc: TDutyDoc; before?: TDutyDoc; children?: React.ReactNode}) => {
        capture(props);

        return <div data-testid="captured-result">{props.children}</div>;
    },
}));

const original: TDutyDoc = {
    columns: ['2026-11-01'],
    rows: [{workerId: '1', cells: ['D']}],
    workerMeta: {'1': {name: '김 간호사', nurseId: 1}},
    fixedCells: {},
    requestCells: {},
};
const interpreted: TScheduleAdjustInterpretRes = {
    items: [{kind: 'CELL', nurseId: 1, date: '2026-11-01', shiftCode: 'O', severity: 'HARD'}],
    unmapped: [],
    strength: 'NORMAL',
};
const props = {disabled: false, interpret: vi.fn().mockResolvedValue(interpreted), goalNurses: [{nurseId: 1, name: '김 간호사'}]};
const lastSnapshot = () =>
    capture.mock.calls[capture.mock.calls.length - 1]?.[0] as {doc: TDutyDoc; before?: TDutyDoc; changedCount?: number};

beforeEach(() => {
    capture.mockClear();
    useShiftEditorStore.getState().reset();
    useShiftEditorStore.getState().setDoc(structuredClone(original));
});

describe('captured legacy schedule results', () => {
    it('keeps the applied result and opens a follow-up request without another solve', async () => {
        const regenerate = vi.fn();
        const apply = vi.fn().mockResolvedValue({
            applied: true,
            changes: [{name: '김 간호사', date: '2026-11-01', before: 'D', after: 'O'}],
            response: {
                operationType: 'ADJUST',
                draftRevision: 1,
                resultType: 'PATCH',
                changedCells: [],
                unmetInstructions: [],
                sameAsPrevious: false,
            },
        });

        render(<AiAdjustTextInput {...props} onApply={apply} onRegenerate={regenerate} />);
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.modify'}));
        fireEvent.change(screen.getByRole('textbox'), {target: {value: '김 간호사 1일 쉬게 해줘'}});
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
        fireEvent.click(await screen.findByRole('button', {name: 'aiAdjust.chat.applyReply'}));

        const result = await screen.findByRole('region', {name: 'aiAdjust.snapshot.result'});

        expect(within(result).getByRole('button', {name: 'aiAdjust.modifyMore'})).toBeEnabled();
        expect(within(result).queryByRole('button', {name: 'aiAdjust.chat.regenerate'})).not.toBeInTheDocument();
        fireEvent.click(within(result).getByRole('button', {name: 'aiAdjust.modifyMore'}));
        expect(regenerate).not.toHaveBeenCalled();
        expect(apply).toHaveBeenCalledOnce();
        expect(screen.getByRole('textbox')).toHaveFocus();
    });

    it('passes immutable before and after data to the result preview from the execution boundary', async () => {
        const apply = vi.fn(async (): Promise<TAdjustApplyResult> => {
            useShiftEditorStore.getState().setDoc({...structuredClone(original), rows: [{workerId: '1', cells: ['O']}]});

            return {
                applied: true,
                changes: [{name: '김 간호사', date: '2026-11-01', before: 'D', after: 'O'}],
                response: {
                    operationType: 'ADJUST' as const,
                    draftRevision: 1,
                    resultType: 'PATCH' as const,
                    changedCells: [],
                    unmetInstructions: [],
                    sameAsPrevious: false,
                    validation: {
                        draftRevision: 1,
                        rulesHash: 'r1',
                        summary: {valid: true, hardCount: 0, softCount: 0, totalCount: 0},
                        violations: [],
                    },
                },
            };
        });

        render(<AiAdjustTextInput {...props} onApply={apply} />);
        fireEvent.change(screen.getByRole('textbox'), {target: {value: '김 간호사 1일 쉬게 해줘'}});
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.send'}));
        await screen.findByRole('button', {name: 'aiAdjust.chat.applyReply'});
        useShiftEditorStore.getState().setDoc({...structuredClone(original), rows: [{workerId: '1', cells: ['N']}]});
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.applyReply'}));
        await screen.findByTestId('captured-result');

        const snapshot = lastSnapshot();

        expect(snapshot.before?.rows[0]?.cells).toEqual(['N']);
        expect(snapshot.doc.rows[0]?.cells).toEqual(['O']);
        act(() => {
            useShiftEditorStore.getState().doc.rows[0]!.cells[0] = 'E';
        });
        expect(snapshot.before?.rows[0]?.cells).toEqual(['N']);
        expect(snapshot.doc.rows[0]?.cells).toEqual(['O']);
        expect(apply).toHaveBeenCalledOnce();
    });

    it('keeps the earliest source for a generation flow and does not revive it after starting over', async () => {
        const firstFlow: TAutofillFlow = {id: 31, kind: 'generation', status: 'preparing', messages: []};
        const apply = vi.fn();
        const view = render(<AiAdjustTextInput {...props} onApply={apply} autofillFlow={firstFlow} />);

        act(() => useShiftEditorStore.getState().setDoc({...structuredClone(original), rows: [{workerId: '1', cells: ['N']}]}));
        view.rerender(<AiAdjustTextInput {...props} onApply={apply} autofillFlow={{...firstFlow, status: 'running'}} />);
        act(() => useShiftEditorStore.getState().setDoc({...structuredClone(original), rows: [{workerId: '1', cells: ['O']}]}));
        view.rerender(
            <AiAdjustTextInput {...props} onApply={apply} autofillFlow={{...firstFlow, status: 'running'}} generationCompleted />,
        );
        await screen.findByTestId('captured-result');
        expect(lastSnapshot().before?.rows[0]?.cells).toEqual(['D']);
        expect(lastSnapshot().doc.rows[0]?.cells).toEqual(['O']);
        expect(lastSnapshot().changedCount).toBe(1);
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));
        view.rerender(
            <AiAdjustTextInput
                {...props}
                onApply={apply}
                autofillFlow={{...firstFlow, status: 'running', messages: [{role: 'assistant', text: 'old completion'}]}}
                generationCompleted
            />,
        );
        expect(screen.queryByTestId('captured-result')).not.toBeInTheDocument();
        expect(screen.queryByText('old completion')).not.toBeInTheDocument();

        const nextFlow = {...firstFlow, id: 32};

        view.rerender(<AiAdjustTextInput {...props} onApply={apply} autofillFlow={nextFlow} />);
        act(() => useShiftEditorStore.getState().setDoc({...structuredClone(original), rows: [{workerId: '1', cells: ['E']}]}));
        view.rerender(<AiAdjustTextInput {...props} onApply={apply} autofillFlow={{...nextFlow, status: 'running'}} generationCompleted />);
        await waitFor(() => expect(lastSnapshot().before?.rows[0]?.cells).toEqual(['O']));
        expect(lastSnapshot().doc.rows[0]?.cells).toEqual(['E']);
        expect(apply).not.toHaveBeenCalled();
    });
});
