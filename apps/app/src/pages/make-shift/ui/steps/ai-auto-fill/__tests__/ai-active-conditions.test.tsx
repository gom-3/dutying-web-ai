import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ComponentProps, Ref} from 'react';
import toast, {Toaster} from 'react-hot-toast';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {AiActiveConditions, type TAiActiveCondition} from '../ai-active-conditions';

type TEditorState = {dirty: boolean; saving: boolean; ready: boolean; count: number; refreshPending?: boolean; error?: boolean};

const editor = vi.hoisted(() => ({
    apply: vi.fn<() => Promise<boolean>>(),
    state: {dirty: false, saving: false, ready: true, count: 1} as TEditorState,
    report: undefined as ((state: TEditorState) => void) | undefined,
}));

vi.mock('../../constraints', async () => {
    const {useEffect, useImperativeHandle} = await import('react');

    return {
        Constraints: (props: {
            wardId: number;
            shiftTeamId: number;
            year: number;
            month: number;
            disabled?: boolean;
            editorRef?: Ref<{apply: () => Promise<boolean>}>;
            onEditorStateChange?: (state: TEditorState) => void;
            onApplied?: () => Promise<void> | void;
        }) => {
            useEffect(() => {
                editor.report = props.onEditorStateChange;
                props.onEditorStateChange?.(editor.state);

                return () => {
                    editor.report = undefined;
                };
            }, [props.onEditorStateChange]);
            useImperativeHandle(
                props.editorRef,
                () => ({
                    apply: async () => {
                        editor.state = {...editor.state, saving: true};
                        editor.report?.(editor.state);

                        try {
                            const result = await editor.apply();

                            if (result) {
                                await props.onApplied?.();
                                editor.state = {...editor.state, dirty: false};
                            }

                            return result;
                        } finally {
                            editor.state = {...editor.state, saving: false};
                            editor.report?.(editor.state);
                        }
                    },
                }),
                [props.onApplied],
            );

            return (
                <section aria-label="제약조건 편집기" data-context={`${props.wardId}:${props.shiftTeamId}:${props.year}-${props.month}`}>
                    <label>
                        제약조건 값
                        <input
                            defaultValue="연속 근무 5일 이내"
                            disabled={props.disabled}
                            onChange={() => {
                                editor.state = {...editor.state, dirty: true};
                                editor.report?.(editor.state);
                            }}
                        />
                    </label>
                </section>
            );
        },
    };
});

const wardRules = [{id: 'rule:17', label: '연속 근무 5일 이내'}];
const defaults = {wardId: 4, teamId: 7, year: 2026, month: 11, onWardRulesApplied: vi.fn()};
const open = () => fireEvent.click(screen.getByRole('button', {name: '현재 적용된 제약조건 보기'}));
const reportEditor = (patch: Partial<TEditorState>) =>
    act(() => {
        editor.state = {...editor.state, ...patch};
        editor.report?.(editor.state);
    });
const renderPanel = (conditions: TAiActiveCondition[], overrides: Partial<ComponentProps<typeof AiActiveConditions>> = {}) =>
    render(
        <>
            <AiActiveConditions {...defaults} wardRules={wardRules} aiConditions={conditions} {...overrides} />
            <Toaster />
        </>,
    );

beforeEach(async () => {
    vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({
            matches: false,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        })),
    );
    editor.apply.mockReset().mockResolvedValue(true);
    editor.state = {dirty: false, saving: false, ready: true, count: 1};
    editor.report = undefined;
    defaults.onWardRulesApplied.mockReset();
    toast.remove();
    await i18n.changeLanguage('ko');
});
afterEach(() => {
    act(() => toast.remove());
    vi.unstubAllGlobals();
});

describe('chat conditions modal', () => {
    it.each(['조건 목록 닫기', '닫기'])('closes through %s and returns focus to the trigger', async (controlName) => {
        const user = userEvent.setup();

        renderPanel([]);

        const trigger = screen.getByRole('button', {name: '현재 적용된 제약조건 보기'});

        await user.click(trigger);
        await user.click(screen.getByRole('button', {name: controlName}));
        expect(screen.queryByRole('dialog', {name: '제약조건'})).not.toBeInTheDocument();
        await waitFor(() => expect(trigger).toHaveFocus());
    });
    it('handles Escape inside the modal without passing it to the chat', async () => {
        const chatKeyDown = vi.fn();
        const user = userEvent.setup();

        render(
            <div onKeyDown={chatKeyDown}>
                <AiActiveConditions {...defaults} wardRules={wardRules} aiConditions={[]} />
            </div>,
        );

        const trigger = screen.getByRole('button', {name: '현재 적용된 제약조건 보기'});

        await user.click(trigger);
        await waitFor(() => expect(screen.getByRole('button', {name: '조건 목록 닫기'})).toHaveFocus());
        chatKeyDown.mockClear();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog', {name: '제약조건'})).not.toBeInTheDocument();
        expect(chatKeyDown).not.toHaveBeenCalled();
        await waitFor(() => expect(trigger).toHaveFocus());
    });
    it('closes on the gray backdrop and returns focus to the banner', async () => {
        const user = userEvent.setup();

        renderPanel([]);

        const trigger = screen.getByRole('button', {name: '현재 적용된 제약조건 보기'});

        await user.click(trigger);
        await user.click(screen.getByTestId('ai-conditions-overlay'));
        expect(screen.queryByRole('dialog', {name: '제약조건'})).not.toBeInTheDocument();
        await waitFor(() => expect(trigger).toHaveFocus());
    });
    it('keeps keyboard focus in the modal and hides background controls from accessibility navigation', async () => {
        const user = userEvent.setup();

        render(
            <>
                <AiActiveConditions {...defaults} wardRules={wardRules} aiConditions={[]} />
                <button type="button">대화 입력</button>
            </>,
        );

        const background = screen.getByRole('button', {name: '대화 입력'});

        await user.click(screen.getByRole('button', {name: '현재 적용된 제약조건 보기'}));

        const close = screen.getByRole('button', {name: '조건 목록 닫기'});
        const last = screen.getByRole('button', {name: '닫기'});

        await waitFor(() => expect(close).toHaveFocus());
        expect(screen.queryByRole('button', {name: '대화 입력'})).not.toBeInTheDocument();
        expect(document.body).toHaveStyle({pointerEvents: 'none'});
        await user.tab({shift: true});
        expect(last).toHaveFocus();
        await user.tab();
        expect(close).toHaveFocus();
        act(() => background.focus());
        await waitFor(() => expect(close).toHaveFocus());
    });
    it('moves keyboard focus to the next condition after removal and to close after the last one', async () => {
        const user = userEvent.setup();
        const remaining = {
            id: 'request:18',
            label: '이브닝 4회',
            onRemove: () => {
                view.rerender(
                    <>
                        <AiActiveConditions {...defaults} wardRules={wardRules} aiConditions={[]} />
                        <Toaster />
                    </>,
                );
            },
        };
        const view: ReturnType<typeof renderPanel> = renderPanel([
            {
                id: 'request:17',
                label: '야간 3회',
                onRemove: () => {
                    view.rerender(
                        <>
                            <AiActiveConditions {...defaults} wardRules={wardRules} aiConditions={[remaining]} />
                            <Toaster />
                        </>,
                    );
                },
            },
            remaining,
        ]);

        await user.click(screen.getByRole('button', {name: '현재 적용된 제약조건 보기'}));
        act(() => screen.getByRole('button', {name: '야간 3회 삭제'}).focus());
        expect(screen.getByRole('button', {name: '야간 3회 삭제'})).toHaveFocus();
        await user.keyboard('{Enter}');
        await waitFor(() => expect(screen.getByRole('button', {name: '이브닝 4회 삭제'})).toHaveFocus());
        expect(screen.getByRole('dialog', {name: '제약조건'})).toBeVisible();
        await user.keyboard('{Enter}');
        await waitFor(() => expect(screen.getByRole('button', {name: '조건 목록 닫기'})).toHaveFocus());
        expect(screen.getByRole('dialog', {name: '제약조건'})).toBeVisible();
    });
    it('guards repeated removal, shows completion, and leaves the other source untouched', async () => {
        let finish!: () => void;

        const remove = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                }),
        );
        const condition = {id: 'request:17', label: '야간 3회', onRemove: remove};
        const view = renderPanel([condition]);
        const trigger = screen.getByRole('button', {name: '현재 적용된 제약조건 보기'});

        open();

        const button = screen.getByRole('button', {name: '야간 3회 삭제'});

        fireEvent.click(button);
        fireEvent.click(button);
        expect(remove).toHaveBeenCalledOnce();
        expect(button).toHaveAttribute('aria-busy', 'true');
        expect(button).toBeDisabled();
        await act(async () => finish());
        expect(screen.getByText('조건을 삭제했어요.')).toBeVisible();
        view.rerender(
            <>
                <AiActiveConditions {...defaults} wardRules={wardRules} aiConditions={[]} />
                <Toaster />
            </>,
        );
        expect(trigger).toHaveAccessibleDescription('조건 1개');
        expect(screen.getByRole('textbox', {name: '제약조건 값'})).toHaveValue('연속 근무 5일 이내');
        expect(screen.queryByText('야간 3회')).not.toBeInTheDocument();
    });
    it('retains a failed removal and permits another try', async () => {
        const remove = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);

        renderPanel([{id: 'request:17', label: '야간 3회', onRemove: remove}]);
        open();
        fireEvent.click(screen.getByRole('button', {name: '야간 3회 삭제'}));
        expect(await screen.findByText('삭제하지 못했어요. 다시 시도해 주세요.')).toBeVisible();
        expect(screen.getByText('야간 3회')).toBeVisible();
        fireEvent.click(screen.getByRole('button', {name: '야간 3회 삭제'}));
        expect(await screen.findByText('조건을 삭제했어요.')).toBeVisible();
        expect(remove).toHaveBeenCalledTimes(2);
    });
    it('does not resurrect a notification when a pending removal finishes after closing', async () => {
        let finish!: () => void;

        const remove = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                }),
        );

        renderPanel([{id: 'request:17', label: '야간 3회', onRemove: remove}]);
        open();
        fireEvent.click(screen.getByRole('button', {name: '야간 3회 삭제'}));
        fireEvent.click(screen.getByRole('button', {name: '조건 목록 닫기'}));
        await act(async () => finish());
        expect(screen.queryByRole('dialog', {name: '제약조건'})).not.toBeInTheDocument();
        expect(screen.queryByText('조건을 삭제했어요.')).not.toBeInTheDocument();
        open();
        expect(screen.getByRole('dialog', {name: '제약조건'})).toBeVisible();
        expect(screen.queryByText('조건을 삭제했어요.')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '야간 3회 삭제'})).toBeEnabled();
    });

    it('opens the actual constraints editor and AI requests together without source tabs', () => {
        const view = renderPanel([{id: 'request:17', label: '야간 3회', onRemove: vi.fn()}]);
        const trigger = screen.getByRole('button', {name: '현재 적용된 제약조건 보기'});

        expect(trigger).toHaveAccessibleDescription('조건 2개');
        expect(trigger).not.toHaveTextContent('조건 2개');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('dialog', {name: '제약조건'})).not.toBeInTheDocument();
        expect(screen.queryByText('야간 3회')).not.toBeInTheDocument();
        fireEvent.click(trigger);

        const popup = screen.getByRole('dialog', {name: '제약조건'});

        expect(popup).toBeVisible();
        expect(popup).toHaveAttribute('aria-modal', 'true');
        expect(view.container.contains(popup)).toBe(false);
        expect(within(popup).getByRole('region', {name: '제약조건 편집기'})).toHaveAttribute('data-context', '4:7:2026-11');
        expect(within(popup).getByText('야간 3회')).toBeVisible();
        expect(within(popup).queryByRole('tab')).not.toBeInTheDocument();
        expect(within(popup).queryByRole('button', {name: '연속 근무 5일 이내 제약조건에서 관리'})).not.toBeInTheDocument();
        expect(screen.getByTestId('ai-conditions-overlay')).toBeVisible();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it.each(['닫기', '조건 목록 닫기', 'overlay', 'Escape'])(
        'asks before discarding edits through %s and preserves the mounted draft on cancel',
        async (control) => {
            const user = userEvent.setup();

            renderPanel([]);
            open();

            const input = screen.getByRole('textbox', {name: '제약조건 값'});

            fireEvent.change(input, {target: {value: '연속 근무 4일 이내'}});

            if (control === 'overlay') await user.click(screen.getByTestId('ai-conditions-overlay'));
            else if (control === 'Escape') await user.keyboard('{Escape}');
            else await user.click(screen.getByRole('button', {name: control}));

            const confirmation = screen.getByRole('alertdialog', {name: '변경사항을 버릴까요?'});

            expect(confirmation).toBeVisible();
            await user.click(within(confirmation).getByRole('button', {name: '계속 수정하기'}));
            expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
            expect(screen.getByRole('textbox', {name: '제약조건 값'})).toBe(input);
            expect(input).toHaveValue('연속 근무 4일 이내');
            expect(editor.apply).not.toHaveBeenCalled();
            expect(defaults.onWardRulesApplied).not.toHaveBeenCalled();
        },
    );

    it('discards unsaved edits only after explicit confirmation', async () => {
        const user = userEvent.setup();

        renderPanel([]);
        open();
        reportEditor({dirty: true});
        await user.click(screen.getByRole('button', {name: '닫기'}));
        await user.click(screen.getByRole('button', {name: '변경사항 버리기'}));
        expect(screen.queryByRole('dialog', {name: '제약조건'})).not.toBeInTheDocument();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        expect(editor.apply).not.toHaveBeenCalled();
    });

    it('applies ward edits manually, refreshes the caller, and closes only after success', async () => {
        let finish!: (success: boolean) => void;

        editor.apply.mockImplementation(() => new Promise<boolean>((resolve) => (finish = resolve)));
        renderPanel([]);
        open();
        expect(screen.getByRole('button', {name: '변경사항 적용'})).toBeDisabled();
        reportEditor({dirty: true});
        fireEvent.click(screen.getByRole('button', {name: '변경사항 적용'}));
        expect(editor.apply).toHaveBeenCalledOnce();
        expect(screen.getByRole('dialog', {name: '제약조건'})).toBeVisible();
        expect(defaults.onWardRulesApplied).not.toHaveBeenCalled();
        await act(async () => finish(true));
        expect(defaults.onWardRulesApplied).toHaveBeenCalledOnce();
        expect(screen.queryByRole('dialog', {name: '제약조건'})).not.toBeInTheDocument();
    });

    it('keeps failed ward edits available and permits another apply attempt', async () => {
        editor.apply.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        renderPanel([]);
        open();
        fireEvent.change(screen.getByRole('textbox', {name: '제약조건 값'}), {target: {value: '연속 근무 4일 이내'}});
        fireEvent.click(screen.getByRole('button', {name: '변경사항 적용'}));
        await waitFor(() => expect(screen.getByRole('button', {name: '변경사항 적용'})).toBeEnabled());
        expect(screen.getByRole('textbox', {name: '제약조건 값'})).toHaveValue('연속 근무 4일 이내');
        expect(defaults.onWardRulesApplied).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: '변경사항 적용'}));
        await waitFor(() => expect(screen.queryByRole('dialog', {name: '제약조건'})).not.toBeInTheDocument());
        expect(editor.apply).toHaveBeenCalledTimes(2);
        expect(defaults.onWardRulesApplied).toHaveBeenCalledOnce();
    });

    it('blocks closing and AI deletion while ward changes are saving and reports the busy interval', async () => {
        const user = userEvent.setup();
        const busy = vi.fn();
        const remove = vi.fn();

        renderPanel([{id: 'request:17', label: '야간 3회', onRemove: remove}], {onBusyChange: busy});
        open();
        reportEditor({dirty: true, saving: true});
        expect(busy).toHaveBeenLastCalledWith(true);
        expect(screen.getByRole('button', {name: '야간 3회 삭제'})).toBeDisabled();
        expect(screen.getByRole('button', {name: '적용 중'})).toBeDisabled();
        fireEvent.click(screen.getByRole('button', {name: '조건 목록 닫기'}));
        fireEvent.click(screen.getByRole('button', {name: '닫기'}));
        await user.click(screen.getByTestId('ai-conditions-overlay'));
        await user.keyboard('{Escape}');
        expect(screen.getByRole('dialog', {name: '제약조건'})).toBeVisible();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        expect(remove).not.toHaveBeenCalled();
        reportEditor({saving: false});
        expect(busy).toHaveBeenLastCalledWith(false);
    });

    it('cleans up the modal when its sheet becomes unavailable without reopening it later', () => {
        const view = renderPanel([]);

        open();
        view.rerender(<AiActiveConditions {...defaults} wardRules={wardRules} aiConditions={[]} available={false} />);
        expect(screen.queryByRole('dialog', {name: '제약조건'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: '현재 적용된 제약조건 보기'})).toBeDisabled();
        view.rerender(<AiActiveConditions {...defaults} wardRules={wardRules} aiConditions={[]} />);
        expect(screen.queryByRole('dialog', {name: '제약조건'})).not.toBeInTheDocument();
        open();
        expect(screen.getByRole('dialog', {name: '제약조건'})).toBeVisible();
    });

    it('keeps AI identities and meaningful source captions separate from ward edits', async () => {
        const remove = vi.fn();

        renderPanel([
            {id: 'request:17', label: wardRules[0]!.label, description: '이번 달에 저장됨', onRemove: remove},
            {id: 'condition:18', label: '이브닝 4회', description: '현재 대화의 조건', onRemove: vi.fn()},
        ]);
        open();
        expect(screen.getByText('이번 달에 저장됨')).toBeVisible();
        expect(screen.getByText('현재 대화의 조건')).toBeVisible();
        fireEvent.click(screen.getByRole('button', {name: '연속 근무 5일 이내 삭제'}));
        expect(remove).toHaveBeenCalledOnce();
        expect(await screen.findByText('조건을 삭제했어요.')).toBeVisible();
        expect(editor.apply).not.toHaveBeenCalled();
        expect(defaults.onWardRulesApplied).not.toHaveBeenCalled();
    });

    it('disables AI deletion and the ward editor during calculation', () => {
        const remove = vi.fn();

        renderPanel([{id: 'request:17', label: '야간 3회', onRemove: remove}], {disabled: true});
        open();
        expect(screen.getByRole('button', {name: '야간 3회 삭제'})).toBeDisabled();
        expect(screen.getByRole('textbox', {name: '제약조건 값'})).toBeDisabled();
        expect(screen.getByRole('button', {name: '변경사항 적용'})).toBeDisabled();
        expect(remove).not.toHaveBeenCalled();
    });

    it('distinguishes loading and a failed AI conditions read with retry', () => {
        const retry = vi.fn();
        const view = renderPanel([], {wardRules: [], loading: true, onRetry: retry});

        open();
        expect(screen.getByText('조건 확인 중')).toBeVisible();
        view.rerender(<AiActiveConditions {...defaults} wardRules={[]} aiConditions={[]} error onRetry={retry} />);
        expect(screen.getByRole('alert')).toHaveTextContent('조건을 불러오지 못했어요.');
        fireEvent.click(screen.getByRole('button', {name: '다시 불러오기'}));
    });

    it('updates the banner and manual-apply controls when switching to English', async () => {
        renderPanel([{id: 'request:17', label: 'Nights 3 times', onRemove: vi.fn()}]);

        const trigger = screen.getByRole('button', {name: '현재 적용된 제약조건 보기'});

        open();
        await act(async () => i18n.changeLanguage('en'));
        expect(trigger).toHaveAccessibleName('View active constraints');
        expect(trigger).toHaveAccessibleDescription('2 conditions');
        expect(screen.getByRole('button', {name: 'Remove Nights 3 times'})).toBeVisible();
        expect(screen.getByRole('button', {name: 'Apply changes'})).toBeVisible();
        expect(screen.getByRole('button', {name: 'Close'})).toBeVisible();
    });
});
