import {fireEvent, render, screen} from '@testing-library/react';
import {act} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import type * as RestLeavePolicy from '@/pages/ward-settings/model/rest-leave-policy';
import {RestLeavePolicySummaryButton, RestLeavePolicySummaryCard} from '../rest-leave-policy-summary-card';

vi.mock('@/pages/ward-settings/model/rest-leave-policy', async (importOriginal) => {
    const actual = await importOriginal<typeof RestLeavePolicy>();

    return {
        ...actual,
        useRestLeavePolicy: () => ({policy: {...actual.DEFAULT_REST_LEAVE_POLICY, includeHolidays: false}}),
    };
});

const props = {wardId: 1, shiftTeamId: 10, year: 2026, month: 12};

describe('monthly days-off target labels', () => {
    afterEach(async () => {
        await act(async () => {
            await i18n.changeLanguage('ko');
        });
    });

    it.each([
        ['ko', '12월 목표 휴무일'],
        ['en', 'December target days off'],
        ['ja', '12月の目標休日数'],
        ['zh', '十二月目标休息天数'],
        ['zh-TW', '12月目標休息天數'],
        ['th', 'วันหยุดเป้าหมายเดือนธันวาคม'],
        ['vi', 'Số ngày nghỉ mục tiêu · Tháng 12'],
    ])('uses %s month names in the card, menu, tooltip, and accessible button name', async (language, label) => {
        await i18n.changeLanguage(language);

        const view = render(<RestLeavePolicySummaryCard {...props} />);

        expect(screen.getByText(label)).toBeVisible();
        expect(view.container.querySelector('p')?.textContent).toContain(label);

        if (language !== 'ko') expect(view.container).not.toHaveTextContent('12월');

        view.rerender(<RestLeavePolicySummaryButton {...props} variant="menu" />);
        expect(screen.getByText(label)).toBeVisible();

        view.rerender(<RestLeavePolicySummaryButton {...props} />);

        const button = screen.getByRole('button');
        const title = button.getAttribute('title') ?? '';

        expect(title).toContain(label);
        expect(button).toHaveAccessibleName(title);
        fireEvent.click(button);
        expect(screen.getByText(label)).toBeVisible();
    });

    it('updates an already mounted label for regional languages and a year-boundary month change', async () => {
        const view = render(<RestLeavePolicySummaryCard {...props} />);

        await act(async () => {
            await i18n.changeLanguage('ja-JP');
        });
        expect(screen.getByText('12月の目標休日数')).toBeVisible();

        await act(async () => {
            await i18n.changeLanguage('en-US');
        });
        expect(screen.getByText('December target days off')).toBeVisible();

        view.rerender(<RestLeavePolicySummaryCard {...props} year={2027} month={1} />);
        expect(screen.getByText('January target days off')).toBeVisible();
        expect(view.container).not.toHaveTextContent('December');
        expect(view.container).not.toHaveTextContent('월');
    });
});
