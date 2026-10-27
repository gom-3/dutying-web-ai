import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ReactNode} from 'react';
import {MemoryRouter, useLocation} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from '@/features/commercial/api';
import type {Scope} from '@/features/commercial/api';
import {WorkspaceShell, type TWorkspacePage} from './workspace-shell';

const mocks = vi.hoisted(() => ({post: vi.fn()}));

vi.mock('@/features/commercial/api', async (original) => ({
    ...(await original<typeof CommercialApi>()),
    commercialPost: mocks.post,
}));
vi.mock('@/shared/ui/channel-talk-link', () => ({
    ChannelTalkLink: ({children, className}: {children: ReactNode; className?: string}) => (
        <a href="https://ye620.channel.io" className={className}>
            {children}
        </a>
    ),
}));

const hospital: Scope = {type: 'HOSPITAL', ref: 'h1', scopeId: 'hospital-h1', name: '서울병원', role: 'OWNER'};
const another: Scope = {type: 'HOSPITAL', ref: 'h2', scopeId: 'hospital-h2', name: '분당병원', role: 'MANAGER'};
const ward: Scope = {type: 'WARD', ref: '11', scopeId: 'ward-11', name: '중환자실', role: 'OWNER'};
const storageKey = (accountId: number) => `dutying:workspace-navigation:${accountId}`;
const navigation = () => screen.getByRole('navigation', {name: '병원 관리 메뉴'});
const namesIn = () =>
    within(navigation())
        .getAllByRole('link')
        .map((link) => link.textContent);

function Location() {
    return <output aria-label="현재 경로">{useLocation().pathname}</output>;
}

function RoutedShell({scopes}: {scopes: Scope[]}) {
    const {pathname} = useLocation();
    const segments = pathname.split('/');
    const scoped = segments[2] === 'HOSPITAL';
    const page = (pathname === '/profile' ? 'profile' : scoped ? segments[4] : segments[2] || 'workspaces') as TWorkspacePage;
    const scope = scoped ? scopes.find((candidate) => candidate.type === 'HOSPITAL' && candidate.ref === segments[3]) : undefined;

    return (
        <WorkspaceShell page={page} scope={scope} scopes={scopes} accountId={7} accountName="김간호">
            <p>현재 화면 내용</p>
        </WorkspaceShell>
    );
}

function mount(content: ReactNode, path = '/workspace/notices') {
    return render(
        <MemoryRouter initialEntries={[path]}>
            {content}
            <Location />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
});
afterEach(() => {
    cleanup();
    sessionStorage.clear();
});

describe('simplified workspace navigation', () => {
    it.each(['OWNER', 'MANAGER'] as const)(
        'exposes three task menus for a hospital %s and moves account tasks into the header',
        async (role) => {
            mount(
                <WorkspaceShell page="overview" accountId={7} scopes={[{...hospital, role}]} scope={{...hospital, role}}>
                    <p>병동 목록</p>
                </WorkspaceShell>,
            );

            expect(namesIn()).toEqual(['병동 관리', '관리자 관리', '이용·계약']);
            expect(within(navigation()).getByRole('link', {name: '병동 관리'})).toHaveAttribute('aria-current', 'page');
            expect(within(navigation()).getByRole('link', {name: '이용·계약'})).toHaveAttribute('href', '/workspace/HOSPITAL/h1/billing');
            expect(screen.queryByRole('navigation', {name: '개인 메뉴'})).not.toBeInTheDocument();
            expect(screen.queryByRole('link', {name: '운영 지원'})).not.toBeInTheDocument();
            expect(screen.getByRole('link', {name: '알림'})).toHaveAttribute('href', '/workspace/notices');
            expect(screen.getByRole('link', {name: '문의하기'})).toHaveAttribute('href', 'https://ye620.channel.io');

            await userEvent.click(screen.getByRole('button', {name: '내 계정'}));

            const account = screen.getByRole('navigation', {name: '계정 메뉴'});

            expect(
                within(account)
                    .getAllByRole('link')
                    .map((link) => link.textContent),
            ).toEqual(['내 계정', '내 결제 내역', '병원·병동 전환']);
            expect(within(account).getByRole('link', {name: '병원·병동 전환'})).toHaveAttribute('href', '/workspace');
            expect(screen.queryByRole('link', {name: '요금제 안내'})).not.toBeInTheDocument();
        },
    );

    it('keeps hospital context and the same three menus while moving into account settings and notifications', async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={['/workspace/HOSPITAL/h1/overview']}>
                <RoutedShell scopes={[hospital, another]} />
                <Location />
            </MemoryRouter>,
        );
        await user.click(screen.getByRole('link', {name: '알림'}));
        expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/workspace/notices');
        expect(namesIn()).toEqual(['병동 관리', '관리자 관리', '이용·계약']);
        expect(screen.getByRole('combobox', {name: '관리할 병원'})).toHaveValue(hospital.scopeId);
        await user.click(screen.getByRole('button', {name: '내 계정'}));
        await user.click(within(screen.getByRole('navigation', {name: '계정 메뉴'})).getByRole('link', {name: '내 계정'}));
        expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/profile');
        expect(screen.queryByRole('navigation', {name: '계정 메뉴'})).not.toBeInTheDocument();
        expect(namesIn()).toEqual(['병동 관리', '관리자 관리', '이용·계약']);
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('changes remembered context on an account page without selecting a server workspace or navigating', async () => {
        const onSwitchHospital = vi.fn();

        mount(
            <WorkspaceShell page="notices" accountId={7} scopes={[hospital, another]} onSwitchHospital={onSwitchHospital}>
                <p>알림 목록</p>
            </WorkspaceShell>,
        );
        expect(screen.queryByRole('navigation', {name: '병원 관리 메뉴'})).not.toBeInTheDocument();
        await userEvent.selectOptions(screen.getByRole('combobox', {name: '관리할 병원'}), another.scopeId);
        expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/workspace/notices');
        expect(within(navigation()).getByRole('link', {name: '병동 관리'})).toHaveAttribute('href', '/workspace/HOSPITAL/h2/overview');
        expect(screen.getByText('병원 관리자', {selector: '.workspace-shell__role'})).toBeInTheDocument();
        expect(onSwitchHospital).not.toHaveBeenCalled();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('defers switching on a hospital page to its real entry action without changing context prematurely', async () => {
        const onSwitchHospital = vi.fn();

        mount(
            <WorkspaceShell page="overview" accountId={7} scopes={[hospital, another]} scope={hospital} onSwitchHospital={onSwitchHospital}>
                <p>병동 목록</p>
            </WorkspaceShell>,
        );
        await userEvent.selectOptions(screen.getByRole('combobox', {name: '관리할 병원'}), another.scopeId);
        expect(onSwitchHospital).toHaveBeenCalledExactlyOnceWith(another);
        expect(screen.getByRole('combobox', {name: '관리할 병원'})).toHaveValue(hospital.scopeId);
        expect(JSON.parse(sessionStorage.getItem(storageKey(7))!)).toEqual({ref: hospital.ref, scopeId: hospital.scopeId});
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('removes revoked hospital access and preserves independent ward switching and plan information', async () => {
        const content = (scopes: Scope[]) => (
            <MemoryRouter>
                <WorkspaceShell page="notices" accountId={7} scopes={scopes}>
                    <p>알림 목록</p>
                </WorkspaceShell>
            </MemoryRouter>
        );
        const {rerender} = render(content([hospital]));

        expect(navigation()).toBeInTheDocument();
        rerender(content([ward]));
        expect(screen.queryByRole('navigation', {name: '병원 관리 메뉴'})).not.toBeInTheDocument();
        expect(screen.queryByText(hospital.name)).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '내 계정'}));
        expect(screen.getByRole('link', {name: '요금제 안내'})).toHaveAttribute('href', '/workspace/plans');
        expect(within(screen.getByRole('navigation', {name: '계정 메뉴'})).getByRole('link', {name: '병원·병동 전환'})).toHaveAttribute(
            'href',
            '/workspace',
        );
    });

    it('does not reuse a remembered hospital for a different account', () => {
        const content = (accountId: number) => (
            <MemoryRouter>
                <WorkspaceShell page="notices" accountId={accountId} scopes={[hospital, another]}>
                    <p>알림 목록</p>
                </WorkspaceShell>
            </MemoryRouter>
        );

        sessionStorage.setItem(storageKey(7), JSON.stringify({ref: hospital.ref, scopeId: hospital.scopeId}));

        const {rerender} = render(content(7));

        expect(navigation()).toBeInTheDocument();
        rerender(content(8));
        expect(screen.queryByRole('navigation', {name: '병원 관리 메뉴'})).not.toBeInTheDocument();
        expect(screen.getByRole('combobox', {name: '관리할 병원'})).toHaveValue('');
    });

    it.each(['usage', 'invitations'] as const)('keeps the legacy %s route recognizable after consolidation', (page) => {
        mount(
            <WorkspaceShell page={page} scope={hospital} scopes={[hospital]}>
                <p>기존 화면</p>
            </WorkspaceShell>,
        );

        const label = page === 'usage' ? '이용·계약' : '알림';

        expect(screen.getByRole('heading', {level: 1, name: label})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: label})).toHaveAttribute('aria-current', 'page');
    });

    it('provides an accessible notification count without fetching additional data', () => {
        mount(
            <WorkspaceShell page="overview" scope={hospital} scopes={[hospital]} pendingCount={3}>
                <p>병동 목록</p>
            </WorkspaceShell>,
        );
        expect(screen.getByRole('link', {name: '알림, 대기 요청 3개'})).toHaveAttribute('href', '/workspace/notices');
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('closes the account popup with Escape, outside activation and navigation', async () => {
        const user = userEvent.setup();

        mount(
            <WorkspaceShell page="notices" scopes={[hospital]}>
                <p>화면 본문</p>
            </WorkspaceShell>,
        );

        const button = screen.getByRole('button', {name: '내 계정'});

        await user.click(button);
        expect(button).toHaveAttribute('aria-expanded', 'true');
        await user.keyboard('{Escape}');
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).toHaveFocus();
        await user.click(button);
        await user.click(screen.getByText('화면 본문'));
        expect(screen.queryByRole('navigation', {name: '계정 메뉴'})).not.toBeInTheDocument();
        await user.click(button);
        await user.click(screen.getByRole('link', {name: '내 결제 내역'}));
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/workspace/receipts');
    });

    it('closes mobile navigation with Escape and selecting a page, retaining keyboard focus', async () => {
        render(
            <MemoryRouter initialEntries={['/workspace/HOSPITAL/h1/overview']}>
                <RoutedShell scopes={[hospital]} />
            </MemoryRouter>,
        );

        const user = userEvent.setup();
        const button = screen.getByRole('button', {name: '메뉴'});

        await user.click(button);
        expect(button).toHaveAttribute('aria-expanded', 'true');
        await user.keyboard('{Escape}');
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).toHaveFocus();
        await user.click(button);
        await user.click(within(navigation()).getByRole('link', {name: '관리자 관리'}));
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByRole('heading', {name: '관리자 관리'})).toBeInTheDocument();
    });

    it('does not expose management, notification or financial actions to nurse accounts', async () => {
        mount(
            <WorkspaceShell page="profile" accountId={7} scopes={[hospital]} managementEnabled={false}>
                <p>내 계정 정보</p>
            </WorkspaceShell>,
            '/profile',
        );
        expect(screen.queryByRole('navigation', {name: '병원 관리 메뉴'})).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '알림'})).not.toBeInTheDocument();
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.getByRole('link', {name: '근무표로 돌아가기'})).toHaveAttribute('href', '/home');
        expect(screen.getByRole('link', {name: '듀팅 시작 화면'})).toHaveAttribute('href', '/home');
        await userEvent.click(screen.getByRole('button', {name: '내 계정'}));
        expect(within(screen.getByRole('navigation', {name: '계정 메뉴'})).getAllByRole('link')).toHaveLength(1);
        expect(screen.queryByRole('link', {name: '내 결제 내역'})).not.toBeInTheDocument();
    });

    it('prevents changing hospital context during a real entry action', () => {
        mount(
            <WorkspaceShell page="overview" accountId={7} scopes={[hospital, another]} scope={hospital} busy>
                <p>병동 목록</p>
            </WorkspaceShell>,
        );
        expect(screen.getByRole('combobox', {name: '관리할 병원'})).toBeDisabled();
    });
});
