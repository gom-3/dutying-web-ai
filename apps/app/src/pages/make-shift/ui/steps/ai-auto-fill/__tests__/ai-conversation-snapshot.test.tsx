import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {TShift} from '@/entities/shift';
import {useShiftEditorStore} from '@/features/shift-editor/model/store';
import i18n from '@/i18n';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import type {TResultVersion} from '../../../../model/schedule-conversation-api';
import AiConversationSnapshot from '../ai-conversation-snapshot';

const shift = {
    lastDays: [],
    days: [{day: 1, dayType: 'workday'}],
    wardShiftTypes: [{wardShiftTypeId: 1, name: 'Day', shortName: 'D', color: '#44c4b0', isOff: false, isDefault: true, isCounted: true}],
    divisionShiftNurses: [
        [
            {
                shiftNurse: {shiftNurseId: 1, name: '합성 간호사', isWorker: true, divisionNum: 0, priority: 0, carried: 0, nurseId: 1},
                lastWardShiftList: [],
                lastWardReqShiftList: [],
                wardShiftList: [null],
                wardReqShiftList: [null],
            },
        ],
    ],
} as TShift;
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
    useShiftEditorStore
        .getState()
        .setDoc({
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
        render(
            <AiConversationSnapshot
                shift={shift}
                version={result}
                before={before}
                disabled={false}
                onClose={vi.fn()}
                onContinue={onContinue}
            />,
        );
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
    it('closes on Escape without branching', async () => {
        const onClose = vi.fn(),
            onContinue = vi.fn();
        render(<AiConversationSnapshot shift={shift} version={result} disabled={false} onClose={onClose} onContinue={onContinue} />);
        await userEvent.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledOnce();
        expect(onContinue).not.toHaveBeenCalled();
    });
});
