import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {TShift} from '@/entities/shift';
import {useShiftEditorStore} from '@/features/shift-editor';
import type {TDutyDoc} from '@/features/shift-editor/model/types';
import AiAdjustTextInput from '../ai-adjust-text-input';
import {AiResultSnapshot} from '../ai-result-snapshot';

const mocks = vi.hoisted(() => ({capture: vi.fn()}));

vi.mock('@/shared/hook/use-typed-translation', async () => {
    const {default: i18n} = await import('@/i18n');

    return {
        useTypedTranslation: () => ({
            t: (key: string, options?: {count?: number}) =>
                key.startsWith('aiAutofillUi.')
                    ? i18n.t(key, options)
                    : key === 'aiAdjust.snapshot.attempt'
                      ? `(${options?.count}회차)`
                      : key,
        }),
    };
});
vi.mock('html-to-image', () => ({toBlob: mocks.capture}));
vi.mock('../../shared/make-shift-calendar', () => ({
    MakeShiftCalendar: ({doc, shift, readonly}: {doc: TDutyDoc; shift: TShift; readonly: boolean}) => (
        <table aria-label="stored calendar" data-readonly={readonly}>
            <caption>
                {shift.divisionShiftNurses.flat()[0]?.shiftNurse.name} · {shift.wardShiftTypes[0]?.color}
            </caption>
            <thead>
                <tr>
                    <th>이름</th>
                    {doc.columns.map((date) => (
                        <th key={date}>{date}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {doc.rows.map((row) => (
                    <tr key={row.workerId}>
                        <th>{doc.workerMeta[row.workerId]?.name}</th>
                        {row.cells.map((value, index) => (
                            <td key={index}>{value ?? '—'}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    ),
}));

const initialDoc = () => ({
    columns: ['2026-10-01'],
    rows: [{workerId: '1', cells: ['D']}],
    workerMeta: {'1': {name: '김간호'}},
    fixedCells: {},
    requestCells: {},
});
const initialShift = () =>
    ({
        days: [{day: 1, dayType: 'workday'}],
        lastDays: [],
        wardShiftTypes: [
            {
                wardShiftTypeId: 1,
                shortName: 'D',
                name: 'Day',
                color: '#44c4b0',
                isDefault: true,
                isOff: false,
                isCounted: true,
                startTime: '07:00',
                endTime: '15:00',
                classification: 'DAY',
            },
        ],
        divisionShiftNurses: [
            [
                {
                    shiftNurse: {shiftNurseId: 1, nurseId: 1, name: '기존 간호사', isWorker: true, divisionNum: 0, priority: 0, carried: 0},
                    wardShiftList: [1],
                    wardReqShiftList: [null],
                    lastWardShiftList: [],
                    lastWardReqShiftList: [],
                },
            ],
        ],
    }) as TShift;
const props = {
    disabled: false,
    interpret: vi.fn(),
    onApply: vi.fn(),
    goalNurses: [],
    autofillFlow: {id: 1, messages: [], status: 'running' as const},
};

beforeEach(() => {
    useShiftEditorStore.setState({doc: initialDoc()});
    vi.stubGlobal('IntersectionObserver', undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:snapshot');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    mocks.capture.mockReset().mockResolvedValue(new Blob(['schedule image']));
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
describe('completed schedule snapshots', () => {
    it('keeps editing and change requests with the result image while confirmation stays separate', async () => {
        const onRegenerate = vi.fn();
        const onConfirm = vi.fn();
        const view = render(
            <AiAdjustTextInput
                {...props}
                snapshotShift={initialShift()}
                generationCompleted
                onRegenerate={onRegenerate}
                resultActions={{canConfirm: true, onConfirm}}
            />,
        );

        await screen.findByRole('img', {name: '근무표 결과 이미지'});

        const result = screen.getByRole('region', {name: 'aiAdjust.snapshot.result'});
        const confirm = screen.getByRole('button', {name: 'aiAdjust.chat.confirmSchedule'});

        expect(within(result).getByRole('button', {name: '근무표 살펴보기'})).toBeEnabled();
        expect(within(result).getByRole('button', {name: '표 직접 수정하기'})).toBeEnabled();
        expect(screen.getByRole('textbox')).toBeVisible();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.regenerate'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.modify'})).not.toBeInTheDocument();
        expect(result).not.toContainElement(confirm);
        fireEvent.click(confirm);
        expect(onConfirm).toHaveBeenCalledOnce();
        expect(onRegenerate).not.toHaveBeenCalled();
        view.rerender(
            <AiAdjustTextInput
                {...props}
                snapshotShift={initialShift()}
                generationCompleted
                onRegenerate={onRegenerate}
                resultActions={{canConfirm: false, onConfirm}}
            />,
        );
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.confirmSchedule'}));
        expect(screen.getByRole('button', {name: 'aiAdjust.chat.confirmSchedule'})).toBeDisabled();
        expect(onConfirm).toHaveBeenCalledOnce();
    });
    it('keeps the change composer available beside the result without regenerating or confirming', async () => {
        const onRegenerate = vi.fn();
        const onConfirm = vi.fn();
        const onApply = vi.fn();

        render(
            <AiAdjustTextInput
                {...props}
                snapshotShift={initialShift()}
                generationCompleted
                onApply={onApply}
                onRegenerate={onRegenerate}
                resultActions={{canConfirm: true, onConfirm}}
            />,
        );
        await screen.findByRole('img', {name: '근무표 결과 이미지'});

        const result = screen.getByRole('region', {name: 'aiAdjust.snapshot.result'});

        expect(screen.getByRole('textbox')).toBeVisible();
        expect(screen.queryByText('aiAdjust.chat.modify')).not.toBeInTheDocument();
        expect(screen.queryByText('aiAdjust.chat.askChanges')).not.toBeInTheDocument();
        expect(within(result).queryByRole('button', {name: 'aiAdjust.chat.modify'})).not.toBeInTheDocument();
        expect(within(result).queryByRole('button', {name: 'aiAdjust.chat.regenerate'})).not.toBeInTheDocument();
        expect(within(result).getByRole('img', {name: '근무표 결과 이미지'})).toBeVisible();
        expect(onRegenerate).not.toHaveBeenCalled();
        expect(onConfirm).not.toHaveBeenCalled();
        expect(onApply).not.toHaveBeenCalled();
    });
    it('offers next choices only on the latest completed result and opens editing from that result', async () => {
        const onRegenerate = vi.fn();
        const onReviewSchedule = vi.fn();
        const onConfirm = vi.fn();
        const common = {onRegenerate, onReviewSchedule, snapshotShift: initialShift(), resultActions: {canConfirm: true, onConfirm}};
        const view = render(<AiAdjustTextInput {...props} {...common} generationCompleted />);

        await screen.findByRole('img', {name: '근무표 결과 이미지'});
        view.rerender(
            <AiAdjustTextInput
                {...props}
                {...common}
                autofillFlow={{id: 2, status: 'preparing', messages: [{role: 'assistant', text: '다음 근무표 준비'}]}}
                preparation={<p>고정 근무 확인</p>}
            />,
        );
        expect(screen.queryByRole('button', {name: '표 직접 수정하기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.modify'})).not.toBeInTheDocument();
        view.rerender(
            <AiAdjustTextInput {...props} {...common} autofillFlow={{id: 2, status: 'running', messages: []}} generationCompleted />,
        );
        await waitFor(() => expect(screen.getAllByRole('img', {name: '근무표 결과 이미지'})).toHaveLength(2));

        const results = screen.getAllByRole('region', {name: 'aiAdjust.snapshot.result'});

        expect(within(results[0]).queryByRole('button', {name: '표 직접 수정하기'})).not.toBeInTheDocument();
        expect(within(results[0]).queryByRole('button', {name: 'aiAdjust.chat.modify'})).not.toBeInTheDocument();
        expect(screen.getByRole('textbox')).toBeVisible();
        fireEvent.click(within(results[1]).getByRole('button', {name: '표 직접 수정하기'}));
        expect(onReviewSchedule).toHaveBeenCalledOnce();
        expect(onRegenerate).not.toHaveBeenCalled();
        expect(onConfirm).not.toHaveBeenCalled();
        expect(within(results[1]).getByRole('button', {name: '표 직접 수정하기'})).toBeEnabled();
        expect(screen.queryByRole('button', {name: 'aiAdjust.chat.modify'})).not.toBeInTheDocument();
        expect(screen.getAllByRole('img', {name: '근무표 결과 이미지'})).toHaveLength(2);
    });
    it('counts the first successful calculation as run one after preparation was canceled', async () => {
        const view = render(
            <AiAdjustTextInput
                {...props}
                snapshotShift={initialShift()}
                autofillFlow={{id: 10, status: 'paused', messages: [{role: 'assistant', text: '근무 입력을 기다리는 중'}]}}
            />,
        );

        expect(screen.getByText('근무 입력을 기다리는 중')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '근무표 살펴보기'})).not.toBeInTheDocument();
        view.rerender(
            <AiAdjustTextInput
                {...props}
                snapshotShift={initialShift()}
                autofillFlow={{id: 11, status: 'running', messages: []}}
                generationCompleted
            />,
        );
        await screen.findByRole('img', {name: '근무표 결과 이미지'});

        const result = screen.getByRole('region', {name: 'aiAdjust.snapshot.result'});

        expect(result).toHaveTextContent('aiAdjust.generationCompleted (1회차)');
        expect(result).not.toHaveTextContent('(2회차)');
        expect(screen.getAllByRole('button', {name: '근무표 살펴보기'})).toHaveLength(1);
    });
    it('keeps a completion without flow history while requesting changes and does not recreate it after restart', async () => {
        const onRegenerate = vi.fn();
        const view = render(
            <AiAdjustTextInput
                {...props}
                onRegenerate={onRegenerate}
                autofillFlow={undefined}
                snapshotShift={initialShift()}
                generationCompleted
            />,
        );

        await screen.findByRole('img', {name: '근무표 결과 이미지'});
        expect(screen.getAllByText('aiAdjust.generationCompleted')).toHaveLength(1);
        fireEvent.click(screen.getByRole('textbox'));
        fireEvent.change(screen.getByRole('textbox'), {target: {value: '오프를 고르게 배정해줘'}});
        expect(screen.getAllByText('aiAdjust.generationCompleted')).toHaveLength(1);
        expect(screen.getAllByRole('img', {name: '근무표 결과 이미지'})).toHaveLength(1);
        expect(onRegenerate).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: 'aiAdjust.chat.restart'}));
        view.rerender(
            <AiAdjustTextInput
                {...props}
                onRegenerate={onRegenerate}
                autofillFlow={undefined}
                snapshotShift={initialShift()}
                generationCompleted
            />,
        );
        expect(screen.queryByRole('button', {name: '근무표 살펴보기'})).not.toBeInTheDocument();
        expect(screen.queryByText('aiAdjust.generationCompleted')).not.toBeInTheDocument();
        expect(mocks.capture).toHaveBeenCalledOnce();
    });
    it('compares captured before and after in the shared read-only viewer without changing the live schedule', async () => {
        const before = {...initialDoc(), rows: [{workerId: '1', cells: ['E']}]};

        render(
            <AiResultSnapshot
                doc={initialDoc()}
                shift={initialShift()}
                before={before}
                beforeShift={initialShift()}
                title="근무표를 채웠어요!"
            />,
        );
        await screen.findByRole('img', {name: '근무표 결과 이미지'});

        const trigger = screen.getByRole('button', {name: '근무표 살펴보기'});

        fireEvent.click(trigger);

        const dialog = screen.getByRole('dialog');

        expect(within(dialog).getByRole('button', {name: '변경 후'})).toHaveAttribute('aria-pressed', 'true');
        expect(within(dialog).getByRole('cell', {name: 'D'})).toBeVisible();
        fireEvent.click(within(dialog).getByRole('button', {name: '변경 전'}));
        expect(within(dialog).getByRole('cell', {name: 'E'})).toBeVisible();
        expect(within(dialog).queryByRole('cell', {name: 'D'})).not.toBeInTheDocument();
        expect(within(dialog).queryByRole('button', {name: /이어서 작성하기/})).not.toBeInTheDocument();
        expect(useShiftEditorStore.getState().doc.rows[0].cells).toEqual(['D']);
        fireEvent.click(within(dialog).getByRole('button', {name: 'aiAdjust.snapshot.close'}));
        await waitFor(() => expect(trigger).toHaveFocus());
    });
    it('keeps completed assignments and visual metadata after live changes and opens them read-only', async () => {
        const shift = initialShift();
        const view = render(<AiAdjustTextInput {...props} snapshotShift={shift} generationCompleted />);

        await screen.findByRole('img', {name: '근무표 결과 이미지'});
        expect(screen.getByRole('img', {name: 'aiAdjust.snapshot.success'})).toBeInTheDocument();
        act(() => {
            useShiftEditorStore.setState({doc: {...initialDoc(), rows: [{workerId: '1', cells: ['N']}]}});
        });
        shift.wardShiftTypes[0].color = '#ff0000';
        shift.divisionShiftNurses[0][0].shiftNurse.name = '변경된 간호사';
        view.rerender(<AiAdjustTextInput {...props} snapshotShift={shift} generationCompleted />);
        fireEvent.click(screen.getByRole('button', {name: '근무표 살펴보기'}));

        const dialog = screen.getByRole('dialog');
        const table = within(dialog).getByRole('table', {name: 'stored calendar'});

        expect(table).toHaveAttribute('data-readonly', 'true');
        expect(within(table).getByRole('cell', {name: 'D'})).toBeVisible();
        expect(within(table).queryByRole('cell', {name: 'N'})).not.toBeInTheDocument();
        expect(table).toHaveTextContent('기존 간호사 · #44c4b0');
        expect(table).not.toHaveTextContent('변경된 간호사');
        expect(useShiftEditorStore.getState().doc.rows[0].cells).toEqual(['N']);
        fireEvent.click(within(dialog).getByRole('button', {name: 'aiAdjust.snapshot.close'}));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    it('does not show a result snapshot for a failed attempt with a retained completion notice', () => {
        render(
            <AiAdjustTextInput
                {...props}
                snapshotShift={initialShift()}
                generationCompleted
                generationFailure={{message: '연결 실패', blocked: false}}
            />,
        );
        expect(screen.queryByRole('button', {name: '근무표 살펴보기'})).not.toBeInTheDocument();
        expect(mocks.capture).not.toHaveBeenCalled();
    });
    it('retains separate captured images and immutable viewers across successful attempts', async () => {
        const view = render(<AiAdjustTextInput {...props} snapshotShift={initialShift()} generationCompleted />);

        await screen.findByRole('img', {name: '근무표 결과 이미지'});
        act(() => {
            useShiftEditorStore.setState({doc: {...initialDoc(), rows: [{workerId: '1', cells: ['N']}]}});
        });
        view.rerender(
            <AiAdjustTextInput
                {...props}
                snapshotShift={initialShift()}
                autofillFlow={{...props.autofillFlow, id: 2}}
                generationCompleted
            />,
        );
        await waitFor(() => expect(screen.getAllByRole('img', {name: '근무표 결과 이미지'})).toHaveLength(2));
        expect(mocks.capture).toHaveBeenCalledTimes(2);

        const previews = screen.getAllByRole('button', {name: '근무표 살펴보기'});

        fireEvent.click(previews[0]);
        expect(within(screen.getByRole('dialog')).getByRole('cell', {name: 'D'})).toBeVisible();
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: 'aiAdjust.snapshot.close'}));
        fireEvent.click(previews[1]);
        expect(within(screen.getByRole('dialog')).getByRole('cell', {name: 'N'})).toBeVisible();
    });
    it('captures every worker and date with the real calendar renderer instead of a partial table', async () => {
        const doc = {
            ...initialDoc(),
            columns: Array.from({length: 31}, (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`),
            rows: Array.from({length: 5}, (_, index) => ({workerId: String(index + 1), cells: Array<string>(31).fill('D')})),
        };

        render(<AiResultSnapshot doc={doc} shift={initialShift()} />);
        await screen.findByRole('img', {name: '근무표 결과 이미지'});

        const element = mocks.capture.mock.calls[0][0] as HTMLElement;

        expect(element.querySelectorAll('tbody tr')).toHaveLength(5);
        expect(element.querySelectorAll('thead th')).toHaveLength(32);
        expect(element.textContent).toContain('2026-10-31');
        expect(screen.queryByText('aiAdjust.snapshot.note')).not.toBeInTheDocument();
        expect(screen.queryByText('aiAdjust.snapshot.open')).not.toBeInTheDocument();
    });
    it('keeps the draft title, review reason and image in one assistant message without announcing success', async () => {
        render(
            <AiResultSnapshot
                doc={initialDoc()}
                shift={initialShift()}
                title="확인이 필요한 근무표 초안이에요."
                reviewRequired
                description="필수 조건을 확인해 주세요."
                attempt={1}
            />,
        );
        await screen.findByRole('img', {name: '근무표 결과 이미지'});
        expect(screen.getAllByText(/확인이 필요한 근무표 초안이에요/)).toHaveLength(1);
        expect(screen.getByText('필수 조건을 확인해 주세요.')).toBeVisible();
        expect(screen.queryByRole('img', {name: 'aiAdjust.snapshot.success'})).not.toBeInTheDocument();
        expect(screen.getByRole('img', {name: 'aiAdjust.snapshot.review'})).toBeInTheDocument();
        expect(screen.getAllByText('aiAdjust.assistant')).toHaveLength(1);
        expect(screen.getAllByRole('button', {name: '근무표 살펴보기'})).toHaveLength(1);
    });
    it('preserves the review outcome of an earlier generation after the next attempt succeeds', async () => {
        const view = render(
            <AiAdjustTextInput
                {...props}
                snapshotShift={initialShift()}
                generationCompleted
                generationReviewRequired
                generationCompletedMessage="일부 필수 조건을 확인해 주세요."
            />,
        );

        await screen.findByRole('img', {name: '근무표 결과 이미지'});
        expect(screen.getAllByText('aiAdjust.reviewDraft.completed', {exact: false})).toHaveLength(1);
        expect(screen.getAllByText('일부 필수 조건을 확인해 주세요.')).toHaveLength(1);
        expect(screen.queryByRole('img', {name: 'aiAdjust.snapshot.success'})).not.toBeInTheDocument();
        view.rerender(
            <AiAdjustTextInput
                {...props}
                snapshotShift={initialShift()}
                autofillFlow={{...props.autofillFlow, id: 2}}
                generationCompleted
            />,
        );
        await waitFor(() => expect(screen.getAllByRole('img', {name: '근무표 결과 이미지'})).toHaveLength(2));
        expect(screen.getAllByRole('img', {name: 'aiAdjust.snapshot.review'})).toHaveLength(1);
        expect(screen.getAllByRole('img', {name: 'aiAdjust.snapshot.success'})).toHaveLength(1);
        expect(screen.getAllByText('일부 필수 조건을 확인해 주세요.')).toHaveLength(1);
    });
});
