import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it} from 'vitest';
import {InfoTip} from './info-tip';

afterEach(cleanup);

function mount() {
    return render(
        <div>
            <InfoTip label="병동 연결 안내">병동 최고 관리자가 동의하면 병원에 연결됩니다.</InfoTip>
            <button type="button">다음 항목</button>
        </div>,
    );
}

describe('hospital optional help', () => {
    it('opens on hover, stays open while the pointer moves into the help, and closes when leaving', async () => {
        const user = userEvent.setup();

        mount();

        const trigger = screen.getByRole('button', {name: '병동 연결 안내'});

        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        await user.hover(trigger);

        const tooltip = await screen.findByRole('tooltip');

        expect(tooltip).toHaveTextContent('병동 최고 관리자가 동의하면 병원에 연결됩니다.');
        expect(trigger).toHaveAccessibleDescription('병동 최고 관리자가 동의하면 병원에 연결됩니다.');
        await user.unhover(trigger);
        fireEvent.pointerMove(tooltip.parentElement!, {pointerType: 'mouse'});
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        fireEvent.pointerLeave(tooltip.parentElement!, {pointerType: 'mouse'});
        fireEvent.pointerMove(document.body, {clientX: 1000, clientY: 1000});
        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    });

    it('opens with keyboard focus, dismisses with Escape, and preserves the trigger focus', async () => {
        const user = userEvent.setup();

        mount();
        await user.tab();

        const trigger = screen.getByRole('button', {name: '병동 연결 안내'});

        expect(trigger).toHaveFocus();
        expect(await screen.findByRole('tooltip')).toBeInTheDocument();
        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
        expect(trigger).toHaveFocus();
        await user.tab();
        expect(screen.getByRole('button', {name: '다음 항목'})).toHaveFocus();
    });

    it('pins help on click for touch and toggles it closed on a second click', async () => {
        const user = userEvent.setup();

        mount();

        const trigger = screen.getByRole('button', {name: '병동 연결 안내'});

        await user.click(trigger);
        await user.unhover(trigger);
        fireEvent.pointerMove(document.body, {clientX: 1000, clientY: 1000});
        expect(await screen.findByRole('tooltip')).toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await user.click(trigger);
        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('dismisses pinned help on an outside click or when focus leaves', async () => {
        const user = userEvent.setup();

        mount();

        const trigger = screen.getByRole('button', {name: '병동 연결 안내'});

        await user.click(trigger);
        expect(await screen.findByRole('tooltip')).toBeInTheDocument();
        await user.click(document.body);
        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
        await user.click(trigger);
        expect(await screen.findByRole('tooltip')).toBeInTheDocument();
        await user.tab();
        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    });

    it('opens and closes with touch taps without relying on hover', async () => {
        const user = userEvent.setup();

        mount();

        const trigger = screen.getByRole('button', {name: '병동 연결 안내'});

        await user.pointer({keys: '[TouchA]', target: trigger});
        expect(await screen.findByRole('tooltip')).toBeInTheDocument();
        await user.pointer({keys: '[TouchA]', target: trigger});
        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    });
});
