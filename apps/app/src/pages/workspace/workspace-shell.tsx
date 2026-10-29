import {useEffect, useId, useRef, useState, type ReactNode} from 'react';
import {Link, useLocation} from 'react-router';
import {scopePath, type Scope} from '@/features/commercial/api';
import {workspaceRoleLabel} from '@/features/commercial/hospital-entry';
import logoWordmarkPurple from '@/shared/assets/images/logo-wordmark-purple.png';
import {ChannelTalkLink} from '@/shared/ui/channel-talk-link';
import {useHospitalNavigationContext} from './use-hospital-navigation-context';
import {useCopy} from './workspace-ui';
import './workspace.css';
import './workspace-shell.css';

export type TWorkspacePage =
    | 'overview'
    | 'members'
    | 'usage'
    | 'billing'
    | 'support'
    | 'invitations'
    | 'notices'
    | 'receipts'
    | 'plans'
    | 'profile'
    | 'workspaces';

const hospitalPages = ['overview', 'members', 'usage', 'billing', 'support'];
const iconPaths: Record<TWorkspacePage, string> = {
    overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    members: 'M9 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM1 21v-3a8 8 0 0 1 16 0v3H1zM17 3a4 4 0 0 1 0 8 6 6 0 0 0 0-8zM19 13a7 7 0 0 1 4 6v2h-4v-8z',
    usage: 'M3 13h4v8H3zM10 8h4v13h-4zM17 3h4v18h-4z',
    billing: 'M3 4h18v16H3V4zm2 4v3h14V8H5zm1 7v2h5v-2H6z',
    support:
        'M12 2A10 10 0 0 0 2 12v5a3 3 0 0 0 3 3h3V10H5a7 7 0 0 1 14 0h-3v10h3v1h-7v2h7a2 2 0 0 0 2-2v-1a3 3 0 0 0 3-3v-5A10 10 0 0 0 12 2z',
    invitations: 'M3 4h18v16H3V4zm2 3v2l7 5 7-5V7l-7 5-7-5z',
    notices: 'M12 2a6 6 0 0 0-6 6v5l-3 4v2h18v-2l-3-4V8a6 6 0 0 0-6-6zm-3 19a3 3 0 0 0 6 0H9z',
    receipts: 'M5 2h14v20l-3-2-4 2-4-2-3 2V2zm3 5v2h8V7H8zm0 5v2h8v-2H8z',
    plans: 'M3 3h5v18H3V3zm7 5h5v13h-5V8zm7-3h5v16h-5V5z',
    profile: 'M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM3 22v-2a9 9 0 0 1 18 0v2H3z',
    workspaces: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
};

export function WorkspaceShell({
    page,
    scope,
    scopes = [],
    accountId,
    accountName = '',
    managementEnabled = true,
    busy = false,
    pendingCount = 0,
    onSwitchHospital,
    className = '',
    children,
}: {
    page: TWorkspacePage;
    scope?: Scope;
    scopes?: Scope[];
    accountId?: number | null;
    accountName?: string;
    managementEnabled?: boolean;
    busy?: boolean;
    pendingCount?: number;
    onSwitchHospital?: (scope: Scope) => void;
    className?: string;
    children: ReactNode;
}) {
    const t = useCopy();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const menuButton = useRef<HTMLButtonElement>(null);
    const accountButton = useRef<HTMLButtonElement>(null);
    const sidebar = useRef<HTMLElement>(null);
    const accountPanel = useRef<HTMLDivElement>(null);
    const accountMenuId = useId();
    const {hospital, hospitals, rememberHospital} = useHospitalNavigationContext({
        accountId,
        scopes: managementEnabled ? scopes : [],
        currentScope: scope,
    });
    const labels: Record<TWorkspacePage, string> = {
        overview: t('병동 관리', 'Ward management'),
        members: t('관리자 관리', 'Administrators'),
        usage: t('이용·계약', 'Usage & contract'),
        billing: t('이용·계약', 'Usage & contract'),
        support: t('문의하기', 'Contact us'),
        invitations: t('알림', 'Notifications'),
        notices: t('알림', 'Notifications'),
        receipts: t('내 결제 내역', 'My payments'),
        plans: t('요금제 안내', 'Plans'),
        profile: t('내 계정', 'My account'),
        workspaces: t('병원·병동 선택', 'Choose a workspace'),
    };
    const activePage = page === 'usage' ? 'billing' : page === 'invitations' ? 'notices' : page;
    const hospitalItems: TWorkspacePage[] = ['overview', 'members', 'billing'];
    const accountItems: TWorkspacePage[] = managementEnabled
        ? ['profile', 'receipts', ...(!hospitals.length ? ['plans' as const] : []), 'workspaces']
        : ['profile'];
    const personalPath = (key: TWorkspacePage) =>
        key === 'profile' ? '/profile' : key === 'workspaces' ? '/workspace' : `/workspace/${key}`;
    const closeMenus = () => {
        setMenuOpen(false);
        setAccountOpen(false);
    };
    const renderLink = (key: TWorkspacePage, path: string) => (
        <Link key={key} to={path} aria-current={activePage === key ? 'page' : undefined} onClick={closeMenus}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d={iconPaths[key]} />
            </svg>
            <span>{key === 'workspaces' ? t('병원·병동 전환', 'Switch workspace') : labels[key]}</span>
        </Link>
    );

    useEffect(closeMenus, [location.pathname]);
    useEffect(() => {
        if (!menuOpen && !accountOpen) return;

        const onPointerDown = (event: PointerEvent) => {
            if (!(event.target instanceof Node)) return;

            if (accountOpen && !accountPanel.current?.contains(event.target)) setAccountOpen(false);

            if (menuOpen && !sidebar.current?.contains(event.target)) setMenuOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;

            if (accountOpen) {
                setAccountOpen(false);
                accountButton.current?.focus();
            } else if (menuOpen) {
                setMenuOpen(false);
                menuButton.current?.focus();
            }
        };

        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [menuOpen, accountOpen]);

    return (
        <div className={`workspace-app workspace-shell ${className}`}>
            <a className="workspace-shell__skip" href="#workspace-shell-content">
                {t('본문으로 이동', 'Skip to content')}
            </a>
            <aside className="workspace-shell__sidebar" data-menu-open={menuOpen} ref={sidebar}>
                <div className="workspace-shell__brand-row">
                    <Link
                        to={managementEnabled ? '/workspace' : '/home'}
                        className="workspace-shell__brand"
                        aria-label={t('듀팅 시작 화면', 'Dutying home')}
                    >
                        <img src={logoWordmarkPurple} alt="dutying" width="119" height="33" />
                    </Link>
                    <button
                        type="button"
                        className="workspace-shell__menu secondary"
                        ref={menuButton}
                        aria-expanded={menuOpen}
                        aria-controls="workspace-navigation"
                        onClick={() => setMenuOpen(!menuOpen)}
                    >
                        {menuOpen ? t('메뉴 닫기', 'Close menu') : t('메뉴', 'Menu')}
                    </button>
                </div>
                <div className="workspace-shell__navigation" id="workspace-navigation">
                    {managementEnabled && hospitals.length ? (
                        <div className="workspace-shell__context">
                            {hospitals.length > 1 ? (
                                <label>
                                    <span className="workspace-shell__label">{t('관리할 병원', 'Hospital workspace')}</span>
                                    <select
                                        aria-label={t('관리할 병원', 'Hospital workspace')}
                                        value={hospital?.scopeId ?? ''}
                                        disabled={busy}
                                        onChange={(event) => {
                                            const next = hospitals.find((item) => item.scopeId === event.target.value);

                                            if (!next) return;

                                            if (hospitalPages.includes(page) && onSwitchHospital) onSwitchHospital(next);
                                            else rememberHospital(next);
                                        }}
                                    >
                                        <option value="" disabled>
                                            {t('병원을 선택하세요', 'Choose a hospital')}
                                        </option>
                                        {hospitals.map((item) => (
                                            <option key={item.scopeId} value={item.scopeId}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ) : (
                                <strong>{hospital?.name}</strong>
                            )}
                            {hospital ? (
                                <span className="workspace-shell__role">{workspaceRoleLabel(hospital.role, t('ko', 'en') === 'ko')}</span>
                            ) : null}
                        </div>
                    ) : null}
                    {hospital ? (
                        <div className="workspace-shell__group">
                            <p>{t('병원 관리', 'Hospital management')}</p>
                            <nav aria-label={t('병원 관리 메뉴', 'Hospital navigation')}>
                                {hospitalItems.map((key) => renderLink(key, scopePath(hospital, key)))}
                            </nav>
                        </div>
                    ) : null}
                    {!hospital && managementEnabled ? (
                        <div className="workspace-shell__group">
                            <nav aria-label={t('관리 공간 메뉴', 'Workspace navigation')}>{renderLink('workspaces', '/workspace')}</nav>
                        </div>
                    ) : null}
                    {!managementEnabled ? (
                        <Link className="workspace-shell__return" to="/home">
                            {t('근무표로 돌아가기', 'Back to schedules')}
                        </Link>
                    ) : null}
                    <div className="workspace-shell__footer">
                        <ChannelTalkLink className="workspace-shell__contact">
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d={iconPaths.support} />
                            </svg>
                            {t('문의하기', 'Contact us')}
                        </ChannelTalkLink>
                    </div>
                </div>
            </aside>
            <main className="workspace-shell__content" id="workspace-shell-content" tabIndex={-1}>
                <header className="workspace-shell__heading">
                    <div className="workspace-shell__title">
                        <p>
                            {hospitalPages.includes(page)
                                ? (hospital?.name ?? t('병원 관리', 'Hospital management'))
                                : t('내 계정·활동', 'My account & activity')}
                        </p>
                        <h1>{labels[page]}</h1>
                    </div>
                    <div className="workspace-shell__utilities">
                        {managementEnabled ? (
                            <Link
                                className="workspace-shell__notification"
                                to="/workspace/notices"
                                aria-current={activePage === 'notices' ? 'page' : undefined}
                                aria-label={
                                    pendingCount > 0
                                        ? t(`알림, 대기 요청 ${pendingCount}개`, `Notifications, ${pendingCount} pending requests`)
                                        : t('알림', 'Notifications')
                                }
                                title={
                                    pendingCount > 0
                                        ? t(
                                              `대기 중인 초대·인계 요청 ${pendingCount}개`,
                                              `${pendingCount} pending invitations and transfers`,
                                          )
                                        : undefined
                                }
                                onClick={closeMenus}
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d={iconPaths.notices} />
                                </svg>
                                <span>{t('알림', 'Notifications')}</span>
                                {pendingCount > 0 ? (
                                    <span className="workspace-shell__count">{pendingCount > 99 ? '99+' : pendingCount}</span>
                                ) : null}
                            </Link>
                        ) : null}
                        <div className="workspace-shell__account-panel" ref={accountPanel}>
                            <button
                                className="workspace-shell__account-trigger secondary"
                                type="button"
                                ref={accountButton}
                                aria-expanded={accountOpen}
                                aria-controls={accountMenuId}
                                onClick={() => setAccountOpen(!accountOpen)}
                            >
                                <span className="workspace-shell__avatar" aria-hidden="true">
                                    {accountName.slice(0, 1) || t('나', 'Me')}
                                </span>
                                <span>{t('내 계정', 'My account')}</span>
                                <span aria-hidden="true">{accountOpen ? '▴' : '▾'}</span>
                            </button>
                            {accountOpen ? (
                                <nav
                                    id={accountMenuId}
                                    className="workspace-shell__account-menu"
                                    aria-label={t('계정 메뉴', 'Account navigation')}
                                >
                                    {accountName ? <strong>{accountName}</strong> : null}
                                    {accountItems.map((key) => renderLink(key, personalPath(key)))}
                                </nav>
                            ) : null}
                        </div>
                    </div>
                </header>
                <div className="workspace-shell__body">{children}</div>
            </main>
        </div>
    );
}
