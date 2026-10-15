import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {useShiftEditorStore} from '@/features/shift-editor';
import AiAdjustTextInput from '../ai-adjust-text-input';

vi.mock('@/shared/hook/use-typed-translation', () => ({useTypedTranslation: () => ({t: (key: string) => key})}));

const initialDoc = () => ({
    columns: ['2026-10-01'],
    rows: [{workerId: '1', cells: ['D']}],
    workerMeta: {'1': {name: '김간호'}},
    fixedCells: {},
    requestCells: {},
});
const props = {
    disabled: false,
    interpret: vi.fn(),
    onApply: vi.fn(),
    goalNurses: [],
    autofillFlow: {id: 1, messages: [], status: 'running' as const},
};

beforeEach(() => {
    useShiftEditorStore.setState({doc: initialDoc()});
});
describe('completed schedule snapshots', () => {
    it('keeps the completed result after the live schedule changes and opens it read-only', () => {
        const view = render(<AiAdjustTextInput {...props} generationCompleted />);

        act(() => {
            useShiftEditorStore.setState({doc: {...initialDoc(), rows: [{workerId: '1', cells: ['N']}]}});
        });
        view.rerender(<AiAdjustTextInput {...props} generationCompleted />);
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.snapshot.open'}));

        const dialog = screen.getByRole('dialog');

        expect(within(dialog).getByRole('cell', {name: 'D'})).toBeVisible();
        expect(within(dialog).queryByRole('cell', {name: 'N'})).not.toBeInTheDocument();
        expect(useShiftEditorStore.getState().doc.rows[0].cells).toEqual(['N']);
        fireEvent.click(within(dialog).getByRole('button', {name: 'aiAdjust.snapshot.close'}));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    it('does not show a result snapshot for a failed attempt', () => {
        render(<AiAdjustTextInput {...props} generationFailure={{message: '연결 실패', blocked: false}} />);
        expect(screen.queryByRole('button', {name: 'aiAdjust.snapshot.open'})).not.toBeInTheDocument();
    });
    it('retains separate snapshots across successful attempts', () => {
        const view = render(<AiAdjustTextInput {...props} generationCompleted />);

        act(() => {
            useShiftEditorStore.setState({doc: {...initialDoc(), rows: [{workerId: '1', cells: ['N']}]}});
        });
        view.rerender(<AiAdjustTextInput {...props} autofillFlow={{...props.autofillFlow, id: 2}} generationCompleted />);
        expect(screen.getAllByRole('button', {name: 'aiAdjust.snapshot.open'})).toHaveLength(2);
    });
});
