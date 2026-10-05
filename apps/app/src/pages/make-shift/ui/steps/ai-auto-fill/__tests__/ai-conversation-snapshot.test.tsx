import {beforeEach, describe, expect, it, vi} from 'vitest';
import {useShiftEditorStore} from '@/features/shift-editor/model/store';
import i18n from '@/i18n';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import type {TResultVersion} from '../../../../model/schedule-conversation-api';
import AiConversationSnapshot from '../ai-conversation-snapshot';

const result: TResultVersion = {
    versionId: 'result',
    parentVersionId: 'before',
    year: 2026,
    month: 10,
    cells: [{shiftNurseId: 1, date: '2026-10-01', wardShiftTypeId: 1, shiftCode: 'D', fixed: true}],
    rowOrder: [{shiftNurseId: 1, displayOrder: 0}],
    carryOverCells: [],
    constraintsJson: '{}',
    inputDigest: 'result',
    createdAt: '2026-10-03T19:00:00',
};
const before = {...result, versionId: 'before', cells: [{...result.cells[0]!, wardShiftTypeId: null, shiftCode: null}]};

beforeEach(async () => {
    await i18n.changeLanguage('ko');
    useShiftEditorStore.getState().reset();
    useShiftEditorStore.getState().setDoc({
        columns: ['2026-10-01'],
        rows: [{workerId: '1', cells: ['E']}],
        workerMeta: {'1': {name: '현재 표'}},
        fixedCells: {},
        requestCells: {},
    });
});

describe('conversation snapshot screen', () => {
    it('renders the existing calendar and switches immutable versions without changing the editor or its selection', async () => {
        const current = useShiftEditorStore.getState();
        const onContinue = vi.fn();
        render(<AiConversationSnapshot version={result} before={before} disabled={false} onClose={vi.fn()} onContinue={onContinue} />);
        expect(document.querySelector('.make-shift-calendar')).toBeInTheDocument();
        expect(screen.getByText('읽기 전용 스냅샷', {exact: false})).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '실행 전', exact: true}));
        await userEvent.click(screen.getByRole('button', {name: '이 표에서 이어서 작성'}));
        expect(onContinue).toHaveBeenLastCalledWith(before);
        await userEvent.click(screen.getByRole('button', {name: '실행 결과', exact: true}));
        await userEvent.click(screen.getByRole('button', {name: '이 표에서 이어서 작성'}));
        expect(onContinue).toHaveBeenLastCalledWith(result);
        expect(useShiftEditorStore.getState().doc).toEqual(current.doc);
        expect(useShiftEditorStore.getState().selection).toEqual(current.selection);
        expect(useShiftEditorStore.getState().draftRevision).toEqual(current.draftRevision);
    });
    it('renders saved and removed nurses instead of the live editor roster', () => {
        useShiftEditorStore
            .getState()
            .setDoc({
                columns: ['2026-10-01'],
                rows: [{workerId: '99', cells: ['E']}],
                workerMeta: {'99': {name: '새로 추가된 간호사'}},
                fixedCells: {},
                requestCells: {},
            });
        const historical = {
            ...result,
            rowOrder: [
                {shiftNurseId: 1, displayOrder: 0, divisionNum: 1},
                {shiftNurseId: 2, displayOrder: 1, divisionNum: 1},
            ],
            constraintsJson: JSON.stringify({
                rows: [
                    {shiftNurseId: 1, name: '과거 이름'},
                    {shiftNurseId: 2, name: '삭제된 간호사'},
                ],
            }),
        };
        render(<AiConversationSnapshot version={historical} disabled={false} onClose={vi.fn()} onContinue={vi.fn()} />);
        expect(screen.getByText('과거 이름')).toBeInTheDocument();
        expect(screen.getByTitle('삭제된 간호사')).toBeInTheDocument();
        expect(screen.queryByText('새로 추가된 간호사')).not.toBeInTheDocument();
        expect(useShiftEditorStore.getState().doc.rows[0]?.workerId).toBe('99');
    });
    it('closes on Escape without branching', async () => {
        const onClose = vi.fn(),
            onContinue = vi.fn();
        render(<AiConversationSnapshot version={result} disabled={false} onClose={onClose} onContinue={onContinue} />);
        await userEvent.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledOnce();
        expect(onContinue).not.toHaveBeenCalled();
    });
});
