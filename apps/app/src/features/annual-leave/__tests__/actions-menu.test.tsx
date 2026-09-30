import {beforeEach, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {AnnualLeaveActionsMenu} from '../actions-menu';

beforeEach(async () => {
    await i18n.changeLanguage('ko');
});
it('opens an accessible keyboard menu, skips disabled items, and restores focus on Escape', async () => {
    const onSelect = vi.fn();

    render(
        <AnnualLeaveActionsMenu
            items={[
                {label: '일괄 추가', disabled: true, onSelect},
                {label: '일괄 빼기', onSelect},
                {label: '관리 설정', onSelect},
            ]}
        />,
    );

    const trigger = screen.getByRole('button', {name: '연차 관리 더보기'});

    await userEvent.click(trigger);
    expect(screen.getByRole('menuitem', {name: '일괄 추가'})).toBeDisabled();
    expect(screen.getByRole('menuitem', {name: '일괄 빼기'})).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', {name: '관리 설정'})).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('offers disabled-item feedback by click and keyboard without running the action', async () => {
    const onSelect = vi.fn();
    const onDisabledSelect = vi.fn();

    render(<AnnualLeaveActionsMenu items={[{label: '일괄 추가', disabled: true, onSelect, onDisabledSelect}]} />);

    const trigger = screen.getByRole('button', {name: '연차 관리 더보기'});

    await userEvent.click(trigger);

    const item = screen.getByRole('menuitem', {name: '일괄 추가'});

    expect(item).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(item);
    expect(onDisabledSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onDisabledSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).not.toHaveBeenCalled();
});
