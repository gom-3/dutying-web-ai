import {beforeEach, expect, it} from 'vitest';
import i18n from '@/i18n';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {AiAdjustIntro} from '../ai-adjust-intro';

beforeEach(() => localStorage.clear());

it('shows before adjustment, persists acknowledgement per account and allows keyboard dismissal', async () => {
    const view = render(<AiAdjustIntro open={false} owner="account:1" />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.rerender(<AiAdjustIntro open owner="account:1" />);
    expect(screen.getByRole('dialog', {name: i18n.t('aiAutofillUi.adjustIntro.title')})).toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: i18n.t('aiAutofillUi.adjustIntro.confirm')}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.unmount();

    const next = render(<AiAdjustIntro open owner="account:1" />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    next.rerender(<AiAdjustIntro open owner="ward-admin:1" />);
    expect(screen.getByRole('dialog')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
