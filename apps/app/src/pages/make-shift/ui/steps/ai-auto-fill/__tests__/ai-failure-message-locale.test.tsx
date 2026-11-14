import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {AiFailureMessage} from '../ai-failure-message';

vi.mock('../ai-adjust-review-conversation', () => ({AssistantMessage: ({children}: {children: React.ReactNode}) => <div>{children}</div>}));
vi.mock('../../../../model/use-schedule-journey-display', () => ({useScheduleJourneyDisplay: () => undefined}));

afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('ko');
});

it('shows a saved Korean failure in Japanese while reviewing history', async () => {
    const saved = i18n.getFixedT('ko')('aiAdjust.failed');
    await i18n.changeLanguage('ja');
    render(<AiFailureMessage message={saved} title={i18n.t('aiConversationSidebar.previousRequestFailed')} announce={false} />);
    expect(screen.queryByText(/아직 요청|아래 안내/)).not.toBeInTheDocument();
    expect(screen.getByText('もう一度お試しください。')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
