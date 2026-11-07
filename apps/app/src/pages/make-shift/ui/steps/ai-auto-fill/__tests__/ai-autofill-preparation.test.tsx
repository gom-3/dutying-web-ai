import {afterEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {AiAutofillMessages, AiAutofillPreparation} from '../ai-autofill-preparation';
import {AiFailureMessage} from '../ai-failure-message';

afterEach(async () => {
    await i18n.changeLanguage('ko');
});

describe('interrupted request history', () => {
    it.each(['ko', 'en', 'ja'])('updates old %s browser notices to the current language without changing user messages', (language) => {
        const oldNotice = i18n.getFixedT(language)('aiAdjust.preparation.interruptedHistoryLegacy');

        render(
            <AiAutofillMessages
                messages={[
                    {role: 'assistant', text: oldNotice, createdAt: '2026-11-06T10:38:00+09:00'},
                    {role: 'user', text: oldNotice},
                ]}
            />,
        );
        expect(screen.getByText('이전 요청 결과를 확인하지 못했어요.')).toBeVisible();
        expect(screen.getByText('근무표에 반영됐는지 먼저 확인해 주세요.')).toBeVisible();
        expect(screen.getByText(oldNotice)).toBeVisible();
    });

    it('shows an unconfirmed adjustment as a neutral notice instead of a failed-request alert', () => {
        render(<AiFailureMessage message={i18n.t('aiAdjust.preparation.interruptedHistory')} />);
        expect(screen.getByText('이전 요청 결과를 확인하지 못했어요.')).toBeVisible();
        expect(screen.queryByText('요청을 처리하지 못했어요.')).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});

describe('autofill recovery choices', () => {
    it('accepts an optional first-generation request without changing the choices', async () => {
        const onRequestTextChange = vi.fn();

        render(
            <AiAutofillPreparation
                step="fixed"
                fixableCount={1}
                requestText=""
                onRequestTextChange={onRequestTextChange}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
                onFixAll={vi.fn()}
            />,
        );
        await userEvent.type(screen.getByRole('textbox', {name: '이번 근무표에 반영할 내용 · 선택'}), '주말 근무 줄여줘');
        expect(onRequestTextChange).toHaveBeenCalled();
        expect(screen.getByRole('button', {name: '이대로 자동채우기'})).toBeVisible();
        expect(screen.getByRole('button', {name: '입력한 근무 모두 고정하기'})).toBeVisible();
    });
    it.each([
        ['ko', '다시 자동채우기', '입력한 근무 모두 고정하기', '근무 조건 확인하기'],
        ['en', 'Try autofill again', 'Fix all entered shifts', 'Review shift conditions'],
        ['ja', 'もう一度自動入力', '入力済みの勤務をすべて固定', '勤務条件を確認'],
    ])('offers explicit recovery actions in %s', async (language, retry, fixAll, conditions) => {
        await i18n.changeLanguage(language);

        const onConfirm = vi.fn();
        const onFixAll = vi.fn();
        const onEditConditions = vi.fn();
        const user = userEvent.setup();

        render(
            <AiAutofillPreparation
                step="fixed"
                recovery
                fixableCount={3}
                onConfirm={onConfirm}
                onCancel={vi.fn()}
                onFixAll={onFixAll}
                onEditConditions={onEditConditions}
            />,
        );
        expect(onConfirm).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', {name: fixAll}));
        expect(onFixAll).toHaveBeenCalledOnce();
        expect(onConfirm).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', {name: conditions}));
        expect(onEditConditions).toHaveBeenCalledOnce();
        await user.click(screen.getByRole('button', {name: retry}));
        expect(onConfirm).toHaveBeenCalledOnce();
    });

    it('keeps the all-fixed explanation visible and waits until a shift is unprotected', async () => {
        await i18n.changeLanguage('ko');

        const onConfirm = vi.fn();
        const props = {step: 'fixed' as const, recovery: true, fixableCount: 0, onConfirm, onCancel: vi.fn(), onFixAll: vi.fn()};
        const view = render(<AiAutofillPreparation {...props} canAutofill={false} />);

        expect(screen.getByRole('status')).toHaveTextContent('AI가 바꿀 수 있는 칸이 없어요.');
        expect(screen.getByRole('button', {name: '다시 자동채우기'})).toBeDisabled();
        expect(screen.queryByRole('button', {name: '입력한 근무 모두 고정하기'})).not.toBeInTheDocument();
        view.rerender(<AiAutofillPreparation {...props} canAutofill />);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '다시 자동채우기'}));
        expect(onConfirm).toHaveBeenCalledOnce();
    });
});
