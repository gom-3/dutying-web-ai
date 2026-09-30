import {beforeEach, describe, expect, it} from 'vitest';
import i18n from '@/i18n';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {useScheduleDisplay} from '../../../../model/use-schedule-display';
import {ScheduleDisplayMenu} from '../schedule-display-menu';

function Fixture({wardId = 1}: {wardId?: number}) {
    const display = useScheduleDisplay(wardId);

    return (
        <>
            <ScheduleDisplayMenu display={display} />
            <output>{JSON.stringify(display.value)}</output>
        </>
    );
}

beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('ko');
});
describe('schedule display preferences', () => {
    it('migrates the previous leave display choice and toggles each column group independently', async () => {
        localStorage.setItem('annual-leave-display:1', 'true');

        const view = render(<Fixture />);

        await userEvent.click(screen.getByRole('button', {name: '표시 설정'}));
        expect(screen.getByRole('menuitemcheckbox', {name: '연차'})).toHaveAttribute('aria-checked', 'true');
        await userEvent.click(screen.getByRole('menuitemcheckbox', {name: '목표 OFF'}));
        expect(JSON.parse(localStorage.getItem('schedule-display:1')!)).toEqual({rest: false, annualLeave: true});
        await userEvent.click(screen.getByRole('menuitemcheckbox', {name: '연차'}));
        expect(JSON.parse(localStorage.getItem('schedule-display:1')!)).toEqual({rest: false, annualLeave: false});
        view.unmount();
        render(<Fixture />);
        await userEvent.click(screen.getByRole('button', {name: '표시 설정'}));
        expect(screen.getByRole('menuitemcheckbox', {name: '목표 OFF'})).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByRole('menuitemcheckbox', {name: '연차'})).toHaveAttribute('aria-checked', 'false');
    });
    it('supports keyboard toggles, focus return and isolated ward preferences', async () => {
        const view = render(<Fixture />);
        const trigger = screen.getByRole('button', {name: '표시 설정'});

        await userEvent.click(trigger);
        await userEvent.keyboard('{ArrowDown}{Enter}');
        expect(screen.getByRole('menuitemcheckbox', {name: '연차'})).toHaveAttribute('aria-checked', 'true');
        await userEvent.keyboard('{Escape}');
        expect(trigger).toHaveFocus();
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        view.rerender(<Fixture wardId={2} />);
        expect(screen.getByRole('status')).toHaveTextContent('{"rest":true,"annualLeave":false}');
        view.rerender(<Fixture wardId={1} />);
        expect(screen.getByRole('status')).toHaveTextContent('{"rest":true,"annualLeave":true}');
    });
});
