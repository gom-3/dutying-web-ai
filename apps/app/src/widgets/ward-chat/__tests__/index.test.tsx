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
const fileApiMock = vi.hoisted(() => ({
    getPresignedUrl: vi.fn(),
}));
const uploadImageToS3Mock = vi.hoisted(() => vi.fn());
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
    FileAPI: fileApiMock,
}));

vi.mock('@/features/file/model/upload-file', () => ({
    uploadImageToS3: uploadImageToS3Mock,
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
        vi.stubEnv('VITE_SERVER_URL', 'https://dev.api.dutying.ai');
        vi.stubGlobal(
            'URL',
            Object.assign(URL, {
                createObjectURL: vi.fn(() => 'blob:chat-image-preview'),
                revokeObjectURL: vi.fn(),
            }),
        );
        vi.stubGlobal(
            'fetch',
            vi.fn(() => pendingFetch()),
        );
        fileApiMock.getPresignedUrl.mockResolvedValue({
            presignedUrl: 'https://s3.example.com/presigned-chat-image',
            fileUrl: 'https://cdn.example.com/chat_img/uploaded-chat-image.jpg',
            fileName: 'chat_uploaded-chat-image.jpg',
            expiresIn: 300,
        });
        uploadImageToS3Mock.mockResolvedValue(undefined);
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
                    senderProfileImgUrl: 'https://cdn.example.com/profile/incoming-nurse.png',
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
            unreadMemberCount: 2,
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
                senderProfileImgUrl: 'https://cdn.example.com/profile/other-nurse.png',
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
        await waitFor(() =>
            expect(document.querySelector('img[src="https://cdn.example.com/profile/other-nurse.png"]')).toBeInTheDocument(),
        );
        expect(fetchMock).toHaveBeenCalledWith(
            'https://dev.api.dutying.ai/events/stream',
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

    it('shows previews when unread count increases even if stale alert storage is off', async () => {
        window.localStorage.setItem('dutying:ward-chat-alert-enabled', 'off');
        window.localStorage.setItem('dutying:ward-chat-preview-alert-enabled:v2', 'off');
        window.localStorage.setItem('dutying:ward-chat-preview-alert-enabled:v3', 'off');
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

    it('shows realtime message previews even if stale alert storage was off', async () => {
        window.localStorage.setItem('dutying:ward-chat-alert-enabled', 'off');
        window.localStorage.setItem('dutying:ward-chat-preview-alert-enabled:v2', 'off');
        window.localStorage.setItem('dutying:ward-chat-preview-alert-enabled:v3', 'off');

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

        await findOpenWardChatButton();

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
        expect(await screen.findByText('Muted realtime message')).toBeInTheDocument();
    });

    it('shows the connected ward member count in the header', async () => {
        const user = userEvent.setup();

        renderWithQueryClient(<WardChatWidget />);

        await user.click(await findOpenWardChatButton());

        expect(await screen.findByText('2명')).toBeInTheDocument();
        expect(wardApiMock.getShiftTeams).toHaveBeenCalledWith(1);
    });

    it('closes when clicking outside the open ward chat panel', async () => {
        const user = userEvent.setup();

        renderWithQueryClient(<WardChatWidget />);

        await user.click(await findOpenWardChatButton());

        expect(await screen.findByRole('button', {name: '병동톡 닫기'})).toBeInTheDocument();

        await user.click(document.body);

        await waitFor(() => expect(screen.queryByRole('button', {name: '병동톡 닫기'})).not.toBeInTheDocument());
        expect(await findOpenWardChatButton()).toBeInTheDocument();
    });

    it('opens messages and sends a chat message', async () => {
        const user = userEvent.setup();

        renderWithQueryClient(<WardChatWidget />);

        await user.click(await findOpenWardChatButton());

        expect(await screen.findByText('Incoming message')).toBeInTheDocument();
        expect(document.querySelector('img[src="https://cdn.example.com/profile/incoming-nurse.png"]')).toBeInTheDocument();
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
        expect(await screen.findByText('2')).toBeInTheDocument();
    });

    it('renders image-only ward chat messages from the app', async () => {
        const user = userEvent.setup();

        wardApiMock.getWardChatUnreadCount.mockResolvedValueOnce({moimId: 1, wardId: 1, unreadCount: 0});
        wardApiMock.getWardChatMessages.mockResolvedValueOnce({
            messages: [
                {
                    messageId: 12,
                    moimId: 1,
                    wardId: 1,
                    senderAccountId: 101,
                    senderWardAdminAccountId: null,
                    senderType: 'ACCOUNT',
                    senderName: 'Other Nurse',
                    text: '',
                    imageUrls: ['https://cdn.example.com/chat_img/app-photo.jpg'],
                    sentAt: '2026-05-25T05:06:01.462Z',
                    isDeleted: false,
                },
            ],
            nextCursorMessageId: null,
            lastReadMessageId: 0,
            unreadCount: 0,
        });

        renderWithQueryClient(<WardChatWidget />);

        await user.click(await findOpenWardChatButton());

        await waitFor(() =>
            expect(document.querySelector('img[src="https://cdn.example.com/chat_img/app-photo.jpg"]')).toBeInTheDocument(),
        );
        expect(screen.getByRole('button', {name: '사진 1/1 미리보기'})).toBeInTheDocument();
    });

    it('uploads and sends selected ward chat photos from the web', async () => {
        const user = userEvent.setup();

        wardApiMock.getWardChatUnreadCount.mockResolvedValueOnce({moimId: 1, wardId: 1, unreadCount: 0});
        wardApiMock.getWardChatMessages.mockResolvedValueOnce({
            messages: [],
            nextCursorMessageId: null,
            lastReadMessageId: 0,
            unreadCount: 0,
        });
        wardApiMock.createWardChatMessage.mockResolvedValueOnce({
            messageId: 13,
            moimId: 1,
            wardId: 1,
            senderAccountId: 100,
            senderWardAdminAccountId: null,
            senderType: 'ACCOUNT',
            senderName: 'Me',
            text: '',
            imageUrls: ['https://cdn.example.com/chat_img/uploaded-chat-image.jpg'],
            sentAt: '2026-05-25T05:07:01.462Z',
            isDeleted: false,
            unreadMemberCount: 2,
        });

        renderWithQueryClient(<WardChatWidget />);

        await user.click(await findOpenWardChatButton());

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;

        expect(fileInput).not.toBeNull();

        const file = new File(['image'], 'shift-note.jpeg', {type: 'image/jpeg'});

        await user.upload(fileInput as HTMLInputElement, file);

        await waitFor(() => expect(fileApiMock.getPresignedUrl).toHaveBeenCalledWith('CHAT_IMAGE', 'jpg'));
        expect(uploadImageToS3Mock).toHaveBeenCalledWith('https://s3.example.com/presigned-chat-image', file);

        const sendButton = screen.getByRole('button', {name: '메시지 보내기'});

        await waitFor(() => expect(sendButton).toBeEnabled());
        await user.click(sendButton);

        await waitFor(() =>
            expect(wardApiMock.createWardChatMessage).toHaveBeenCalledWith(
                1,
                expect.objectContaining({
                    imageUrls: ['https://cdn.example.com/chat_img/uploaded-chat-image.jpg'],
                }),
            ),
        );

        const lastCreateCall = wardApiMock.createWardChatMessage.mock.calls[wardApiMock.createWardChatMessage.mock.calls.length - 1];

        expect(lastCreateCall?.[1]).not.toHaveProperty('text');
        expect(await screen.findByRole('button', {name: '사진 1/1 미리보기'})).toBeInTheDocument();
    });

    it('keeps long unbroken messages constrained to wrapping bubbles', async () => {
        const user = userEvent.setup();
        const longMessage = `https://example.com/${'a'.repeat(180)}`;

        wardApiMock.getWardChatUnreadCount.mockResolvedValueOnce({moimId: 1, wardId: 1, unreadCount: 0});
        wardApiMock.getWardChatMessages.mockResolvedValueOnce({
            messages: [
                {
                    messageId: 5,
                    moimId: 1,
                    wardId: 1,
                    senderAccountId: 101,
                    senderWardAdminAccountId: null,
                    senderType: 'ACCOUNT',
                    senderName: 'Other Nurse',
                    text: longMessage,
                    sentAt: '2026-05-25T05:04:01.462Z',
                    isDeleted: false,
                },
            ],
            nextCursorMessageId: null,
            lastReadMessageId: 0,
            unreadCount: 0,
        });

        renderWithQueryClient(<WardChatWidget />);

        await user.click(await findOpenWardChatButton());

        const messageBubble = await screen.findByText(longMessage);

        expect(messageBubble).toHaveClass('min-w-0', 'max-w-full');
        expect(messageBubble.className).toContain('[overflow-wrap:anywhere]');
        expect(messageBubble.parentElement).toHaveClass('min-w-0', 'max-w-full');
        expect(messageBubble.parentElement?.parentElement).toHaveClass('min-w-0', 'max-w-full');
        expect(messageBubble.parentElement?.parentElement?.parentElement).toHaveClass('min-w-0', 'max-w-[78%]');
        expect(screen.getByRole('log')).toHaveClass('overflow-x-hidden');
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
        vi.stubEnv('VITE_SERVER_URL', 'https://api.dutying.ai');

        renderWithQueryClient(<WardChatWidget />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(wardApiMock.getWardChatUnreadCount).not.toHaveBeenCalled();
        expect(wardApiMock.getShiftTeams).not.toHaveBeenCalled();
    });
});
