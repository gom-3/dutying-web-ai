import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {Scope} from '@/features/commercial/api';
import {HospitalWorkspaceShell} from './hospital-workspace-shell';

const scope: Scope = {type: 'HOSPITAL', ref: 'h1', scopeId: 's1', name: '서울병원', role: 'OWNER'};

function mount(role: Scope['role'] = 'OWNER', scopes = [{...scope, role}]) {
    const change = vi.fn();

    render(
        <MemoryRouter>
            <div className="workspace-app hospital-workspace">
                <HospitalWorkspaceShell
                    scope={{...scope, role}}
                    scopes={scopes}
                    tab="overview"
                    accountName="김간호"
                    busy={false}
                    onSwitch={change}
                >
                    <main>Ward content</main>
                </HospitalWorkspaceShell>
            </div>
        </MemoryRouter>,
    );

    return change;
}

afterEach(() => {
    cleanup();
    sessionStorage.clear();
});

describe('hospital workspace navigation', () => {
    it('uses the actual Dutying logo and marks the current hospital menu', () => {
        mount();
        expect(screen.getByRole('img', {name: 'dutying'})).toHaveAttribute('src', expect.stringContaining('logo-wordmark-purple'));

        const navigation = screen.getByRole('navigation', {name: '병원 관리 메뉴'});

        expect(within(navigation).getByRole('link', {name: '병동 관리'})).toHaveAttribute('aria-current', 'page');
        expect(within(navigation).getByRole('link', {name: '이용·계약'})).toHaveAttribute('href', '/workspace/HOSPITAL/h1/billing');
        expect(screen.queryByRole('combobox', {name: '관리할 병원'})).not.toBeInTheDocument();
    });
    it('keeps usage and contract navigation available to a hospital manager', () => {
        mount('MANAGER');
        expect(screen.getByRole('link', {name: '이용·계약'})).toHaveAttribute('href', '/workspace/HOSPITAL/h1/billing');
        expect(screen.getByRole('link', {name: '관리자 관리'})).toBeInTheDocument();
    });
    it('switches to the selected authorized workspace', async () => {
        const next = {...scope, ref: 'h2', scopeId: 's2', name: '분당병원'};
        const change = mount('OWNER', [scope, next]);

        await userEvent.selectOptions(screen.getByRole('combobox', {name: '관리할 병원'}), 's2');
        expect(change).toHaveBeenCalledWith(next);
    });
    it('opens mobile utility navigation and closes it with Escape while retaining focus', async () => {
        mount();

        const user = userEvent.setup();
        const button = screen.getByRole('button', {name: '메뉴'});

        await user.click(button);
        expect(button).toHaveAttribute('aria-expanded', 'true');
        await user.keyboard('{Escape}');
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).toHaveFocus();
    });
});
