import {afterEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {AiAutofillPreparation} from '../ai-autofill-preparation';

afterEach(async () => {
    await i18n.changeLanguage('ko');
});

describe('autofill recovery choices', () => {
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

        expect(screen.getByRole('status')).toHaveTextContent('모든 근무가 고정돼 있어요.');
        expect(screen.getByRole('button', {name: '다시 자동채우기'})).toBeDisabled();
        expect(screen.queryByRole('button', {name: '입력한 근무 모두 고정하기'})).not.toBeInTheDocument();
        view.rerender(<AiAutofillPreparation {...props} canAutofill />);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '다시 자동채우기'}));
        expect(onConfirm).toHaveBeenCalledOnce();
    });
});
