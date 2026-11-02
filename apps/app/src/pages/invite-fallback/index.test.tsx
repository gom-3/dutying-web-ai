import {MemoryRouter, useLocation, useNavigate} from 'react-router-dom';
import {afterEach, describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import {INVITE_PATH_BY_KIND, type TInviteKind} from '@/shared/config/invite';
import {SUPPORTED_LANGUAGES} from '@/shared/i18n/locale';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import {INVITE_PAGE_COPY} from './copy';
import DeepLinkFallbackPage from './index';

const renderInvite = (kind: TInviteKind, search: string) =>
    render(
        <MemoryRouter initialEntries={[`${INVITE_PATH_BY_KIND[kind]}${search}`]}>
            <DeepLinkFallbackPage kind={kind} />
        </MemoryRouter>,
    );

afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
});

describe.each(['friend', 'moim'] as const)('%s invitation language', (kind) => {
    it.each(SUPPORTED_LANGUAGES)('uses URL lng=%s for all copy, metadata and home navigation', async (language) => {
        // A Korean web preference must not override the app's shared language.
        await i18n.changeLanguage('ko');

        const search = `?code=TEST42&lng=${language}&source=kakao#invite`;
        const pageCopy = INVITE_PAGE_COPY[language];
        const copy = pageCopy.invites[kind];

        renderInvite(kind, search);

        expect(screen.getByRole('heading', {level: 1})).toHaveTextContent(copy.title.replace('\n', ' '));
        expect(screen.getByText(copy.codeLabel)).toBeInTheDocument();
        expect(screen.getByText('TEST42')).toBeInTheDocument();
        expect(screen.getByText(pageCopy.openHint.replace('\n', ' '))).toBeInTheDocument();
        expect(screen.getByRole('heading', {level: 2})).toHaveTextContent(pageCopy.downloadTitle.replace('\n', ' '));
        expect(screen.getByText(pageCopy.downloadDescription)).toBeInTheDocument();
        expect(screen.getByLabelText(pageCopy.downloadLabel)).toBeInTheDocument();
        expect(screen.getByRole('link', {name: pageCopy.homeLabel})).toHaveAttribute('href', language === 'ko' ? '/' : `/${language}`);
        expect(screen.getByRole('link', {name: copy.openButtonLabel})).toHaveAttribute(
            'href',
            `dutying://${kind === 'friend' ? 'friends' : 'moim'}/invite${search}`,
        );
        expect(screen.getByRole('link', {name: 'App Store'})).toHaveAttribute('href', expect.stringContaining('id6804144827'));
        expect(screen.getByRole('link', {name: 'Google Play'})).toHaveAttribute('href', expect.stringContaining('id=ai.dutying.app'));
        expect(screen.getByRole('link', {name: 'Google Play'})).toHaveAttribute('href', expect.stringContaining(`hl=${language}`));
        await waitFor(() => expect(document.title).toBe(copy.pageTitle));
        expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', copy.description);
        expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
        expect(document.documentElement.lang).toMatch(new RegExp(`^${language}`));

        if (language !== 'ko') expect(document.body.textContent).not.toMatch(/[가-힣]/);
    });

    it('uses the saved web language before the browser language when lng is absent', async () => {
        vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
        vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
        window.localStorage.setItem('i18nextLng', 'ja');
        await i18n.changeLanguage();

        renderInvite(kind, '?code=TEST42');

        expect(screen.getByRole('link', {name: INVITE_PAGE_COPY.ja.invites[kind].openButtonLabel})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Dutyingのホーム'})).toHaveAttribute('href', '/ja');
    });

    it('uses the browser language when lng and the saved web language are absent', async () => {
        window.localStorage.removeItem('i18nextLng');
        vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['vi-VN', 'en-US']);
        vi.spyOn(navigator, 'language', 'get').mockReturnValue('vi-VN');
        await i18n.changeLanguage();

        renderInvite(kind, '?code=TEST42');

        expect(screen.getByRole('link', {name: INVITE_PAGE_COPY.vi.invites[kind].openButtonLabel})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Trang chủ Dutying'})).toHaveAttribute('href', '/vi');
    });

    it('normalizes a regional language and works without an invite code', () => {
        renderInvite(kind, '?lng=ja-JP');

        expect(screen.getByRole('link', {name: INVITE_PAGE_COPY.ja.invites[kind].openButtonLabel})).toHaveAttribute(
            'href',
            `dutying://${kind === 'friend' ? 'friends' : 'moim'}/invite?lng=ja-JP`,
        );
        expect(screen.queryByText(INVITE_PAGE_COPY.ja.invites[kind].codeLabel)).not.toBeInTheDocument();
    });
});

it('updates language when another invitation is opened without reloading the app', async () => {
    const InviteNavigation = () => {
        const navigate = useNavigate();
        const location = useLocation();

        return (
            <>
                <button onClick={() => navigate('/app/moim/invite?code=NEXT42&lng=ja')}>Next invite</button>
                <DeepLinkFallbackPage kind={location.pathname.includes('/moim/') ? 'moim' : 'friend'} />
            </>
        );
    };

    render(
        <MemoryRouter initialEntries={['/app/friends/invite?code=TEST42&lng=en']}>
            <InviteNavigation />
        </MemoryRouter>,
    );
    expect(screen.getByRole('link', {name: 'Add friend in Dutying'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Next invite'}));
    expect(screen.getByRole('link', {name: 'Dutyingアプリでグループの招待を確認'})).toHaveAttribute(
        'href',
        'dutying://moim/invite?code=NEXT42&lng=ja',
    );
    expect(screen.getByText('NEXT42')).toBeInTheDocument();
});
