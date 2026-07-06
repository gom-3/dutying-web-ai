import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ReactNode} from 'react';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import WardChatWidget from '../index';

const wardApiMock = vi.hoisted(() => ({
    createWardChatMessage: vi.fn(),
    getWardChatMessages: vi.fn(),
    getWardChatUnreadCount: vi.fn(),
    getShiftTeams: vi.fn(),
    readWardChat: vi.fn(),
}));
const authStateMock = vi.hoisted(() => ({
    accessToken: null as string | null,
    accountId: 100 as number | null,
    isDemoExpired: false,
    wardId: 1 as number | null,
}));

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: authStateMock,
    }),
}));

vi.mock('@/shared/api', () => ({
    WardAPI: wardApiMock,
}));

function renderWithQueryClient(children: ReactNode) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    return {
        queryClient,
        ...render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>),
    };
}

const createJwt = (payload: Record<string, unknown>) =>
    `header.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.signature`;
const pendingFetch = () => new Promise<Response>(() => undefined);
const findOpenWardChatButton = () => screen.findByRole('button', {name: /병동톡 열기/});

function createRealtimeChatResponse(payload: Record<string, unknown>) {
    const eventData = {
        eventId: `chat-message-${payload.messageId}`,
        type: 'WARD_CHAT_MESSAGE_CREATED',
        payload,
    };
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(new TextEncoder().encode(`event: WARD_CHAT_MESSAGE_CREATED\ndata: ${JSON.stringify(eventData)}\n\n`));
            controller.close();
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {'Content-Type': 'text/event-stream'},
    });
}

describe('WardChatWidget', () => {
    beforeAll(() => {
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        authStateMock.accessToken = null;
        authStateMock.accountId = 100;
        authStateMock.isDemoExpired = false;
        authStateMock.wardId = 1;
        vi.stubEnv('VITE_ENABLE_WARD_CHAT', '');
        vi.stubEnv('VITE_SERVER_URL', 'https://dev.api.dutying.net');
        vi.stubGlobal(
            'fetch',
            vi.fn(() => pendingFetch()),
        );
        wardApiMock.getWardChatUnreadCount.mockResolvedValue({moimId: 1, wardId: 1, unreadCount: 5});
        wardApiMock.getWardChatMessages.mockResolvedValue({
            messages: [
                {
                    messageId: 1,
                    moimId: 1,
                    wardId: 1,
                    senderAccountId: 101,
                    senderWardAdminAccountId: null,
                    senderType: 'ACCOUNT',
                    senderName: 'Other Nurse',
                    text: 'Incoming message',
                    sentAt: '2026-05-25T04:56:01.462Z',
                    isDeleted: false,
                },
            ],
            nextCursorMessageId: null,
            lastReadMessageId: 0,
            unreadCount: 5,
        });
        wardApiMock.readWardChat.mockResolvedValue(undefined);
        wardApiMock.createWardChatMessage.mockResolvedValue({
            messageId: 2,
            moimId: 1,
            wardId: 1,
            senderAccountId: 100,
            senderWardAdminAccountId: null,
            senderType: 'ACCOUNT',
            senderName: 'Me',
            text: 'Reply message',
            sentAt: '2026-05-25T04:57:01.462Z',
            isDeleted: false,
        });
        wardApiMock.getShiftTeams.mockResolvedValue([
            {
                shiftTeamId: 10,
                name: 'A Team',
                nurseCnt: 3,
                nurses: [
                    {nurseId: 1, isConnected: true},
                    {nurseId: 2, isConnected: false},
                    {nurseId: 3, isConnected: true},
                ],
            },
        ]);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('shows the floating button with unread count', async () => {
        renderWithQueryClient(<WardChatWidget />);

        expect(await findOpenWardChatButton()).toBeInTheDocument();
        expect(await screen.findByText('5')).toBeInTheDocument();
        expect(await screen.findByText('Incoming message')).toBeInTheDocument();
        expect(screen.getByText('Other Nurse')).toBeInTheDocument();
    });

    it('updates the floating unread badge from realtime ward chat events', async () => {
        authStateMock.accessToken = 'access-token';
        wardApiMock.getWardChatUnreadCount.mockResolvedValueOnce({moimId: 1, wardId: 1, unreadCount: 0});

        const fetchMock = vi.fn(() => pendingFetch());

        fetchMock.mockResolvedValueOnce(
            createRealtimeChatResponse({
                messageId: 7,
                moimId: null,
                wardId: 1,
                senderAccountId: 101,
                senderWardAdminAccountId: null,
                senderType: 'ACCOUNT',
                senderName: 'Other Nurse',
                text: 'New realtime message',
                sentAt: '2026-05-25T05:00:01.462Z',
                isDeleted: false,
                unreadCount: 3,
            }),
        );
        vi.stubGlobal('fetch', fetchMock);

        renderWithQueryClient(<WardChatWidget />);

        expect(await findOpenWardChatButton()).toBeInTheDocument();
        expect(await screen.findByText('3')).toBeInTheDocument();
        expect(await screen.findByText('New realtime message')).toBeInTheDocument();
        expect(screen.getByText('Other Nurse')).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(
            'https://dev.api.dutying.net/events/stream',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Accept: 'text/event-stream',
                    Authorization: 'Bearer access-token',
                }),
            }),
        );
    });

    it('shows a message preview when unread count increases without a realtime payload', async () => {
        wardApiMock.getWardChatUnreadCount.mockResolvedValueOnce({moimId: 1, wardId: 1, unreadCount: 0});
        wardApiMock.getWardChatMessages.mockResolvedValueOnce({
            messages: [
                {
                    messageId: 9,
                    moimId: 1,
                    wardId: 1,
                    senderAccountId: 101,
                    senderWardAdminAccountId: null,
                    senderType: 'ACCOUNT',
                    senderName: 'Charge Nurse',
                    text: 'Fallback preview message with schedule details',
                    sentAt: '2026-05-25T05:02:01.462Z',
                    isDeleted: false,
                },
            ],
            nextCursorMessageId: null,
            lastReadMessageId: 0,
            unreadCount: 1,
        });

        const {queryClient} = renderWithQueryClient(<WardChatWidget />);

        await findOpenWardChatButton();
        await waitFor(() => expect(queryClient.getQueryData(['ward-chat', 'unread', 1])).toMatchObject({unreadCount: 0}));

        act(() => {
            queryClient.setQueryData(['ward-chat', 'unread', 1], {moimId: 1, wardId: 1, unreadCount: 1});
        });

        expect(await screen.findByText('Fallback preview message with schedule details')).toBeInTheDocument();
        expect(screen.getByText('Charge Nurse')).toBeInTheDocument();
    });

    it('ignores the previous preview alert storage key so stale off state does not block previews', async () => {
        window.localStorage.setItem('dutying:ward-chat-alert-enabled', 'off');
        wardApiMock.getWardChatUnreadCount.mockResolvedValueOnce({moimId: 1, wardId: 1, unreadCount: 0});
        wardApiMock.getWardChatMessages.mockResolvedValueOnce({
            messages: [
                {
                    messageId: 10,
                    moimId: 1,
                    wardId: 1,
                    senderAccountId: 101,
                    senderWardAdminAccountId: null,
                    senderType: 'ACCOUNT',
                    senderName: 'Night Nurse',
                    text: 'Preview should still appear',
                    sentAt: '2026-05-25T05:03:01.462Z',
                    isDeleted: false,
                },
            ],
            nextCursorMessageId: null,
            lastReadMessageId: 0,
            unreadCount: 1,
        });

        const {queryClient} = renderWithQueryClient(<WardChatWidget />);

        await findOpenWardChatButton();
        await waitFor(() => expect(queryClient.getQueryData(['ward-chat', 'unread', 1])).toMatchObject({unreadCount: 0}));

        act(() => {
            queryClient.setQueryData(['ward-chat', 'unread', 1], {moimId: 1, wardId: 1, unreadCount: 1});
        });

        expect(await screen.findByText('Preview should still appear')).toBeInTheDocument();
        expect(screen.getByText('Night Nurse')).toBeInTheDocument();
    });

    it('turns off floating message previews from the alert toggle', async () => {
        const user = userEvent.setup();

        let resolveFetch: ((response: Response) => void) | undefined;

        authStateMock.accessToken = 'access-token';
        wardApiMock.getWardChatUnreadCount.mockResolvedValueOnce({moimId: 1, wardId: 1, unreadCount: 0});

        const fetchMock = vi.fn(
            () =>
                new Promise<Response>((resolve) => {
                    resolveFetch = resolve;
                }),
        );

        vi.stubGlobal('fetch', fetchMock);

        renderWithQueryClient(<WardChatWidget />);

        await user.click(await findOpenWardChatButton());
        await user.click(await screen.findByRole('button', {name: '병동톡 새 메시지 알림 끄기'}));

        expect(screen.getByRole('button', {name: '병동톡 새 메시지 알림 켜기'})).toHaveAttribute('aria-pressed', 'false');

        await user.click(screen.getByRole('button', {name: '병동톡 닫기'}));

        await act(async () => {
            resolveFetch?.(
                createRealtimeChatResponse({
                    messageId: 8,
                    moimId: null,
                    wardId: 1,
                    senderAccountId: 101,
                    senderWardAdminAccountId: null,
                    senderType: 'ACCOUNT',
                    senderName: 'Other Nurse',
                    text: 'Muted realtime message',
                    sentAt: '2026-05-25T05:01:01.462Z',
                    isDeleted: false,
                    unreadCount: 2,
                }),
            );
        });

        expect(await screen.findByText('2')).toBeInTheDocument();
        expect(screen.queryByText('Muted realtime message')).not.toBeInTheDocument();
    });

    it('shows the connected ward member count in the header', async () => {
        const user = userEvent.setup();

        renderWithQueryClient(<WardChatWidget />);

        await user.click(await findOpenWardChatButton());

        expect(await screen.findByText('2명')).toBeInTheDocument();
        expect(wardApiMock.getShiftTeams).toHaveBeenCalledWith(1);
    });

    it('opens messages and sends a chat message', async () => {
        const user = userEvent.setup();

        renderWithQueryClient(<WardChatWidget />);

        await user.click(await findOpenWardChatButton());

        expect(await screen.findByText('Incoming message')).toBeInTheDocument();
        await waitFor(() => expect(wardApiMock.readWardChat).toHaveBeenCalledWith(1, {lastReadMessageId: 1}));

        const textarea = document.querySelector('textarea');

        expect(textarea).not.toBeNull();

        await user.type(textarea as HTMLTextAreaElement, 'Reply message');

        const buttons = screen.getAllByRole('button');

        await user.click(buttons[buttons.length - 1] as HTMLButtonElement);

        await waitFor(() =>
            expect(wardApiMock.createWardChatMessage).toHaveBeenCalledWith(
                1,
                expect.objectContaining({
                    text: 'Reply message',
                }),
            ),
        );
        expect(await screen.findByText('Reply message')).toBeInTheDocument();
    });

    it('renders ward admin messages from the current admin as mine', async () => {
        const user = userEvent.setup();

        authStateMock.accessToken = createJwt({principalType: 'WARD_ADMIN', wardAdminAccountId: 9});
        authStateMock.accountId = null;
        wardApiMock.getWardChatUnreadCount.mockResolvedValueOnce({moimId: 1, wardId: 1, unreadCount: 0});
        wardApiMock.getWardChatMessages.mockResolvedValueOnce({
            messages: [
                {
                    messageId: 3,
                    moimId: null,
                    wardId: 1,
                    senderAccountId: null,
                    senderWardAdminAccountId: 9,
                    senderType: 'WARD_ADMIN',
                    senderName: 'Ward Admin',
                    text: 'Admin sent message',
                    sentAt: '2026-05-25T04:58:01.462Z',
                    isDeleted: false,
                },
            ],
            nextCursorMessageId: null,
            lastReadMessageId: 0,
            unreadCount: 0,
        });

        renderWithQueryClient(<WardChatWidget />);

        await user.click(await findOpenWardChatButton());

        expect(await screen.findByText('Admin sent message')).toBeInTheDocument();
        expect(screen.queryByText('Ward Admin')).not.toBeInTheDocument();
    });

    it('shows an operator badge before another ward admin sender name', async () => {
        const user = userEvent.setup();

        authStateMock.accessToken = createJwt({principalType: 'WARD_ADMIN', wardAdminAccountId: 9});
        authStateMock.accountId = null;
        wardApiMock.getWardChatUnreadCount.mockResolvedValueOnce({moimId: 1, wardId: 1, unreadCount: 0});
        wardApiMock.getWardChatMessages.mockResolvedValueOnce({
            messages: [
                {
                    messageId: 4,
                    moimId: null,
                    wardId: 1,
                    senderAccountId: null,
                    senderWardAdminAccountId: 11,
                    senderType: 'WARD_ADMIN',
                    senderName: 'Head Nurse',
                    text: 'Operator announcement',
                    sentAt: '2026-05-25T04:59:01.462Z',
                    isDeleted: false,
                },
            ],
            nextCursorMessageId: null,
            lastReadMessageId: 0,
            unreadCount: 0,
        });

        renderWithQueryClient(<WardChatWidget />);

        await user.click(await findOpenWardChatButton());

        expect(await screen.findByText('운영자')).toBeInTheDocument();
        expect(screen.getByText('Head Nurse')).toBeInTheDocument();
        expect(screen.getByText('Operator announcement')).toBeInTheDocument();
    });

    it('does not call ward chat APIs on production API while the routes are unavailable', () => {
        vi.stubEnv('VITE_SERVER_URL', 'https://api.dutying.net');

        renderWithQueryClient(<WardChatWidget />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(wardApiMock.getWardChatUnreadCount).not.toHaveBeenCalled();
        expect(wardApiMock.getShiftTeams).not.toHaveBeenCalled();
    });
});
