import {useState} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {useShiftEditorStore} from '@/features/shift-editor/model/store';
import i18n from '@/i18n';
import {act, render, screen, userEvent, waitFor, within} from '@/shared/util/test-utils';
import type {TResultVersion} from '../../../../model/schedule-conversation-api';
import AiConversationSnapshot from '../ai-conversation-snapshot';

const result: TResultVersion = {
    versionId: 'result',
    parentVersionId: 'before',
    year: 2026,
    month: 10,
    cells: [{shiftNurseId: 1, date: '2026-10-01', wardShiftTypeId: 1, shiftCode: 'D', fixed: true}],
    rowOrder: [{shiftNurseId: 1, displayOrder: 0, divisionNum: 0}],
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
        const user = userEvent.setup();

        render(<AiConversationSnapshot version={result} before={before} disabled={false} onClose={vi.fn()} onContinue={onContinue} />);

        // Search only the comparison controls, not every cell in the real calendar.
        const comparison = within(screen.getByRole('group', {name: '전후 비교'}));
        const beforeButton = comparison.getByRole('button', {name: '변경 전'});
        const afterButton = comparison.getByRole('button', {name: '변경 후'});
        const continueButton = screen.getByRole('button', {name: '이 표로 이어서 작성하기'});

        expect(document.querySelector('.make-shift-calendar')).toBeInTheDocument();
        expect(screen.getByText('이 결과를 만든 시점의 근무표예요. 여기서는 수정할 수 없어요.')).toBeInTheDocument();
        expect(screen.queryByRole('group', {name: '보기 방식'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '결과 근무표'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '변경 전후 비교'})).not.toBeInTheDocument();
        expect(afterButton).toHaveAttribute('aria-pressed', 'true');
        await user.click(beforeButton);
        expect(beforeButton).toHaveAttribute('aria-pressed', 'true');
        expect(afterButton).toHaveAttribute('aria-pressed', 'false');
        expect(continueButton).toHaveAccessibleName('변경 전 표로 이어서 작성하기');
        await user.click(continueButton);
        expect(onContinue).toHaveBeenLastCalledWith(before);
        await user.click(afterButton);
        expect(continueButton).toHaveAccessibleName('이 표로 이어서 작성하기');
        await user.click(continueButton);
        expect(onContinue).toHaveBeenLastCalledWith(result);
        await user.click(screen.getByRole('region', {name: '근무표 전체 보기'}));
        await user.keyboard('N');
        expect(useShiftEditorStore.getState().doc).toEqual(current.doc);
        expect(useShiftEditorStore.getState().selection).toEqual(current.selection);
        expect(useShiftEditorStore.getState().draftRevision).toEqual(current.draftRevision);
    });
    it('returns to the result with the same before and after control', async () => {
        const onContinue = vi.fn();
        const user = userEvent.setup();

        render(<AiConversationSnapshot version={result} before={before} disabled={false} onClose={vi.fn()} onContinue={onContinue} />);

        // Search only the comparison controls, not every cell in the real calendar.
        const comparison = within(screen.getByRole('group', {name: '전후 비교'}));
        const beforeButton = comparison.getByRole('button', {name: '변경 전'});
        const afterButton = comparison.getByRole('button', {name: '변경 후'});
        const continueButton = screen.getByRole('button', {name: '이 표로 이어서 작성하기'});

        await user.click(beforeButton);
        await user.click(afterButton);
        expect(afterButton).toHaveAttribute('aria-pressed', 'true');
        expect(continueButton).toHaveAccessibleName('이 표로 이어서 작성하기');
        await user.click(continueButton);
        expect(onContinue).toHaveBeenCalledExactlyOnceWith(result);
    });
    it('does not offer comparison when there is no saved earlier schedule', () => {
        render(<AiConversationSnapshot version={result} disabled={false} onClose={vi.fn()} onContinue={vi.fn()} />);
        expect(screen.queryByRole('group', {name: '보기 방식'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '변경 전'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '이 표로 이어서 작성하기'})).toBeEnabled();
    });
    it('loads the saved earlier schedule only when Before is selected, then reuses it', async () => {
        let resolveBefore!: (version: TResultVersion) => void;

        const loadBefore = vi.fn(() => new Promise<TResultVersion>((resolve) => (resolveBefore = resolve)));
        const onContinue = vi.fn();

        render(
            <AiConversationSnapshot version={result} loadBefore={loadBefore} disabled={false} onClose={vi.fn()} onContinue={onContinue} />,
        );
        expect(loadBefore).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: '변경 전'}));
        expect(screen.getByRole('status')).toHaveTextContent('변경 전 근무표 불러오는 중');
        expect(document.querySelector('.make-shift-calendar')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '이 표로 이어서 작성하기'})).toBeDisabled();
        expect(loadBefore).toHaveBeenCalledOnce();
        await userEvent.click(screen.getByRole('button', {name: '변경 후'}));
        expect(screen.getByRole('button', {name: '이 표로 이어서 작성하기'})).toBeEnabled();
        await act(async () => resolveBefore(before));
        await userEvent.click(screen.getByRole('button', {name: '변경 전'}));
        await userEvent.click(screen.getByRole('button', {name: '변경 전 표로 이어서 작성하기'}));
        expect(onContinue).toHaveBeenCalledExactlyOnceWith(before);
        expect(loadBefore).toHaveBeenCalledOnce();
    });
    it('keeps the completed result available when source loading fails and lets comparison retry', async () => {
        const loadBefore = vi
            .fn<() => Promise<TResultVersion>>()
            .mockRejectedValueOnce(new Error('unavailable'))
            .mockResolvedValueOnce(before);

        render(<AiConversationSnapshot version={result} loadBefore={loadBefore} disabled={false} onClose={vi.fn()} onContinue={vi.fn()} />);
        await userEvent.click(screen.getByRole('button', {name: '변경 전'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('변경 전 근무표를 불러오지 못했어요.');
        expect(document.querySelector('.make-shift-calendar')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '이 표로 이어서 작성하기'})).toBeDisabled();
        await userEvent.click(screen.getByRole('button', {name: '변경 후'}));
        expect(screen.getByRole('button', {name: '이 표로 이어서 작성하기'})).toBeEnabled();
        expect(document.querySelector('.make-shift-calendar')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '변경 전'}));
        expect(await screen.findByRole('button', {name: '변경 전 표로 이어서 작성하기'})).toBeEnabled();
        expect(loadBefore).toHaveBeenCalledTimes(2);
    });
    it('retries a failed earlier schedule without leaving the before and after view', async () => {
        const loadBefore = vi
            .fn<() => Promise<TResultVersion>>()
            .mockRejectedValueOnce(new Error('unavailable'))
            .mockResolvedValueOnce(before);

        render(<AiConversationSnapshot version={result} loadBefore={loadBefore} disabled={false} onClose={vi.fn()} onContinue={vi.fn()} />);
        await userEvent.click(screen.getByRole('button', {name: '변경 전'}));
        await screen.findByRole('alert');
        await userEvent.click(screen.getByRole('button', {name: '다시 불러오기'}));
        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
        expect(screen.getByRole('button', {name: '변경 전'})).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', {name: '변경 전 표로 이어서 작성하기'})).toBeEnabled();
        expect(loadBefore).toHaveBeenCalledTimes(2);
    });
    it('renders saved and removed nurses instead of the live editor roster', () => {
        useShiftEditorStore.getState().setDoc({
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
    it('keeps closing available while continuing is disabled', async () => {
        const onClose = vi.fn();
        const onContinue = vi.fn();

        render(<AiConversationSnapshot version={result} disabled onClose={onClose} onContinue={onContinue} />);
        expect(screen.getByRole('button', {name: '이 표로 이어서 작성하기'})).toBeDisabled();
        await userEvent.click(screen.getByRole('button', {name: '이 표로 이어서 작성하기'}));
        expect(onContinue).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: '닫기'}));
        expect(onClose).toHaveBeenCalledOnce();
    });
    it('returns focus to the supplied initiating control even if async loading moved focus before opening', async () => {
        function AsyncPreview() {
            const [open, setOpen] = useState(false);
            const [trigger, setTrigger] = useState<HTMLElement | null>(null);

            return (
                <>
                    <button
                        type="button"
                        onClick={(event) => {
                            setTrigger(event.currentTarget);
                            event.currentTarget.blur();
                            setOpen(true);
                        }}
                    >
                        근무표 살펴보기
                    </button>
                    {open && (
                        <AiConversationSnapshot
                            version={result}
                            disabled={false}
                            returnFocusTo={trigger}
                            onClose={() => setOpen(false)}
                            onContinue={vi.fn()}
                        />
                    )}
                </>
            );
        }

        render(<AsyncPreview />);

        const trigger = screen.getByRole('button', {name: '근무표 살펴보기'});

        await userEvent.click(trigger);
        await userEvent.click(screen.getByRole('button', {name: '닫기'}));
        await waitFor(() => expect(trigger).toHaveFocus());
    });
    it('returns keyboard focus to the initiating control after the calendar closes', async () => {
        function Preview() {
            const [open, setOpen] = useState(false);

            return (
                <>
                    <button type="button" onClick={() => setOpen(true)}>
                        근무표 확인
                    </button>
                    {open && (
                        <AiConversationSnapshot version={result} disabled={false} onClose={() => setOpen(false)} onContinue={vi.fn()} />
                    )}
                </>
            );
        }

        render(<Preview />);

        const trigger = screen.getByRole('button', {name: '근무표 확인'});

        await userEvent.tab();
        expect(trigger).toHaveFocus();
        await userEvent.keyboard('{Enter}');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        await userEvent.keyboard('{Escape}');
        await waitFor(() => expect(trigger).toHaveFocus());
    });
});
