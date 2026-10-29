import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router';
import {afterEach, describe, expect, it} from 'vitest';
import {WorkspacePersonalShell} from './workspace-personal-shell';

afterEach(cleanup);

describe('personal workspace navigation', () => {
    it('shows notifications as one entry and keeps secondary account tasks in the account popup', async () => {
        render(
            <MemoryRouter>
                <WorkspacePersonalShell page="invitations" accountName="김간호">
                    <p>초대 목록</p>
                </WorkspacePersonalShell>
            </MemoryRouter>,
        );
        expect(screen.getByRole('heading', {level: 1, name: '알림'})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '알림'})).toHaveAttribute('aria-current', 'page');
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '내 계정'}));
        expect(screen.getByRole('link', {name: '내 계정'})).toHaveAttribute('href', '/profile');
        expect(screen.getByRole('link', {name: '요금제 안내'})).toHaveAttribute('href', '/workspace/plans');
        expect(screen.getAllByRole('link', {name: '병원·병동 전환'}).every((link) => link.getAttribute('href') === '/workspace')).toBe(
            true,
        );
    });

    it('supports mobile menu closing by Escape and returns focus to its trigger', async () => {
        render(
            <MemoryRouter>
                <WorkspacePersonalShell page="notices">
                    <p>알림 목록</p>
                </WorkspacePersonalShell>
            </MemoryRouter>,
        );

        const button = screen.getByRole('button', {name: '메뉴'});

        await userEvent.click(button);
        expect(button).toHaveAttribute('aria-expanded', 'true');
        await userEvent.keyboard('{Escape}');
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).toHaveFocus();
    });

    it('keeps nurse accounts linked to scheduling without exposing administrator menus', () => {
        render(
            <MemoryRouter>
                <WorkspacePersonalShell page="profile" managementEnabled={false}>
                    <p>프로필</p>
                </WorkspacePersonalShell>
            </MemoryRouter>,
        );
        expect(screen.getByRole('link', {name: /근무표로 돌아가기/})).toHaveAttribute('href', '/home');
        expect(screen.queryByRole('link', {name: '초대·관리자 인계'})).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '요금제'})).not.toBeInTheDocument();
        expect(screen.getByRole('heading', {name: '내 계정'})).toBeInTheDocument();
    });
});
