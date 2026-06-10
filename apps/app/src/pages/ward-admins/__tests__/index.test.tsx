import {WARD_ADMIN_MAX_COUNT} from '@dutying/api/ward';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render as rtlRender, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ReactNode} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import WardAdminsPage from '..';

const {
    mockUseAuth,
    mockGetWardAdmins,
    mockCreateWardAdminEmail,
    mockRemoveWardAdmin,
    mockRemoveWardAdminEmail,
    mockToastError,
    mockToastSuccess,
} = vi.hoisted(() => ({
    mockUseAuth: vi.fn(),
    mockGetWardAdmins: vi.fn(),
    mockCreateWardAdminEmail: vi.fn(),
    mockRemoveWardAdmin: vi.fn(),
    mockRemoveWardAdminEmail: vi.fn(),
    mockToastError: vi.fn(),
    mockToastSuccess: vi.fn(),
}));

vi.mock('@/features/auth', () => ({
    default: () => mockUseAuth(),
}));

vi.mock('@/shared/api', () => ({
    WardAPI: {
        getWardAdmins: mockGetWardAdmins,
        createWardAdminEmail: mockCreateWardAdminEmail,
        removeWardAdmin: mockRemoveWardAdmin,
        removeWardAdminEmail: mockRemoveWardAdminEmail,
    },
}));

vi.mock('react-hot-toast', () => ({
    default: {
        error: mockToastError,
        success: mockToastSuccess,
    },
}));

const createAdminsResponse = () => ({
    members: [
        {
            membershipId: 201,
            accountId: 2,
            wardId: 10,
            email: 'editor@example.com',
            role: 'EDITOR' as const,
            status: 'ACTIVE' as const,
        },
        {
            membershipId: 101,
            accountId: 1,
            wardId: 10,
            email: 'owner@example.com',
            role: 'OWNER' as const,
            status: 'ACTIVE' as const,
        },
    ],
    reservedEmails: [
        {
            emailRegistrationId: 301,
            wardId: 10,
            email: 'future-editor@example.com',
            role: 'EDITOR' as const,
            status: 'RESERVED' as const,
        },
    ],
    invitations: [],
});
const createMaxAdminsResponse = () => ({
    members: Array.from({length: WARD_ADMIN_MAX_COUNT - 1}, (_, index) => ({
        membershipId: 100 + index,
        accountId: 1000 + index,
        wardId: 10,
        email: index === 0 ? 'owner@example.com' : `editor-${index}@example.com`,
        role: index === 0 ? ('OWNER' as const) : ('EDITOR' as const),
        status: 'ACTIVE' as const,
    })),
    reservedEmails: [
        {
            emailRegistrationId: 301,
            wardId: 10,
            email: 'future-editor@example.com',
            role: 'EDITOR' as const,
            status: 'RESERVED' as const,
        },
    ],
    invitations: [],
});

function renderPage(children: ReactNode) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    return rtlRender(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

describe('WardAdminsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAuth.mockReturnValue({
            state: {
                accountMe: {role: 'OWNER'},
                wardId: 10,
            },
        });
        mockGetWardAdmins.mockResolvedValue(createAdminsResponse());
        mockCreateWardAdminEmail.mockResolvedValue({
            emailRegistrationId: 302,
            wardId: 10,
            email: 'new.editor@example.com',
            role: 'EDITOR',
            status: 'RESERVED',
        });
        mockRemoveWardAdmin.mockResolvedValue(undefined);
        mockRemoveWardAdminEmail.mockResolvedValue(undefined);
    });

    it('renders active admins and reserved admin emails in one registered list', async () => {
        renderPage(<WardAdminsPage />);

        const editorEmail = await screen.findByText('editor@example.com');
        const ownerEmail = screen.getByText('owner@example.com');

        expect(ownerEmail.compareDocumentPosition(editorEmail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByText('future-editor@example.com')).toBeInTheDocument();
        expect(screen.getAllByText('관리자')).toHaveLength(2);
    });

    it('registers an admin with email and role only', async () => {
        const user = userEvent.setup();

        renderPage(<WardAdminsPage />);

        await user.type(await screen.findByPlaceholderText('이메일'), ' New.Editor@Example.COM ');
        await user.click(screen.getByRole('button', {name: '관리자 추가'}));

        await waitFor(() => {
            expect(mockCreateWardAdminEmail).toHaveBeenCalledWith(10, {
                email: 'new.editor@example.com',
                role: 'EDITOR',
            });
        });
    });

    it('registers an admin when editor role comes from the current ward membership', async () => {
        const user = userEvent.setup();

        mockUseAuth.mockReturnValue({
            state: {
                accountMe: {
                    wardId: 10,
                    memberships: [
                        {wardId: 10, role: 'EDITOR', status: 'ACTIVE'},
                        {wardId: 11, role: 'OWNER', status: 'ACTIVE'},
                    ],
                },
                wardId: 10,
            },
        });

        renderPage(<WardAdminsPage />);

        await user.type(await screen.findByPlaceholderText('이메일'), ' Editor.Membership@Example.COM ');
        await user.click(screen.getByRole('button', {name: '관리자 추가'}));

        await waitFor(() => {
            expect(mockCreateWardAdminEmail).toHaveBeenCalledWith(10, {
                email: 'editor.membership@example.com',
                role: 'EDITOR',
            });
        });
    });

    it('blocks adding admins once active and reserved admins reach the ward limit', async () => {
        const user = userEvent.setup();

        mockGetWardAdmins.mockResolvedValue(createMaxAdminsResponse());

        renderPage(<WardAdminsPage />);

        expect(await screen.findByText(`병동 관리자는 최대 ${WARD_ADMIN_MAX_COUNT}명까지 추가할 수 있어요.`)).toBeInTheDocument();

        const addButton = screen.getByRole('button', {name: '관리자 추가'});

        expect(screen.getByPlaceholderText('이메일')).toBeDisabled();
        expect(addButton).toBeDisabled();

        await user.click(addButton);

        expect(mockCreateWardAdminEmail).not.toHaveBeenCalled();
    });

    it('deletes active admins and reserved emails with separate endpoints', async () => {
        const user = userEvent.setup();

        renderPage(<WardAdminsPage />);

        await user.click(await screen.findByRole('button', {name: 'editor@example.com 관리자 삭제'}));
        await user.click(screen.getByRole('button', {name: 'future-editor@example.com 예약 관리자 삭제'}));

        expect(mockRemoveWardAdmin).toHaveBeenCalledWith(10, 201);
        expect(mockRemoveWardAdminEmail).toHaveBeenCalledWith(10, 301);
    });

    it('deletes regular admins when owner role comes from the current ward membership', async () => {
        const user = userEvent.setup();

        mockUseAuth.mockReturnValue({
            state: {
                accountMe: {
                    wardId: 10,
                    memberships: [
                        {wardId: 10, role: 'OWNER', status: 'ACTIVE'},
                        {wardId: 11, role: 'EDITOR', status: 'ACTIVE'},
                    ],
                },
                wardId: 10,
            },
        });
        mockGetWardAdmins.mockResolvedValue({
            members: [
                {
                    wardAdminMembershipId: 401,
                    accountId: 4,
                    wardId: 10,
                    email: 'legacy-editor@example.com',
                    role: 'EDITOR' as const,
                    status: 'ACTIVE' as const,
                },
                {
                    membershipId: 101,
                    accountId: 1,
                    wardId: 10,
                    email: 'owner@example.com',
                    role: 'OWNER' as const,
                    status: 'ACTIVE' as const,
                },
            ],
            reservedEmails: [],
            invitations: [],
        });

        renderPage(<WardAdminsPage />);

        await user.click(await screen.findByRole('button', {name: 'legacy-editor@example.com 관리자 삭제'}));

        expect(mockRemoveWardAdmin).toHaveBeenCalledWith(10, 401);
        expect(screen.queryByRole('button', {name: 'owner@example.com 관리자 삭제'})).not.toBeInTheDocument();
    });

    it('lets non-owner ward members add admins while hiding removal controls', async () => {
        const user = userEvent.setup();

        mockUseAuth.mockReturnValue({
            state: {
                accountMe: {role: 'EDITOR'},
                wardId: 10,
            },
        });

        renderPage(<WardAdminsPage />);

        await user.type(await screen.findByPlaceholderText('이메일'), ' Editor.Path@Example.COM ');
        await user.click(screen.getByRole('button', {name: '관리자 추가'}));

        await waitFor(() => {
            expect(mockCreateWardAdminEmail).toHaveBeenCalledWith(10, {
                email: 'editor.path@example.com',
                role: 'EDITOR',
            });
        });
        expect(screen.queryByRole('button', {name: /삭제/})).not.toBeInTheDocument();
    });

    it('hides admin mutation controls when the account is not in the current ward', async () => {
        mockUseAuth.mockReturnValue({
            state: {
                accountMe: {wardId: 11, role: 'EDITOR'},
                wardId: 10,
            },
        });

        renderPage(<WardAdminsPage />);

        expect(await screen.findByText('병동 구성원으로 등록된 계정만 관리자로 추가할 수 있어요.')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '관리자 추가'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /삭제/})).not.toBeInTheDocument();
    });
});
