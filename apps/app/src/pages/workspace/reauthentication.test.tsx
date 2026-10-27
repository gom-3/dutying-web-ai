import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, type Mock, vi} from 'vitest';
import {Reauthenticate} from './reauthentication';

const mocks = vi.hoisted(() => ({post: vi.fn()}));
const clients: QueryClient[] = [];

vi.mock('react-i18next', () => ({useTranslation: () => ({i18n: {language: 'ko'}})}));
vi.mock('@/features/commercial/api', () => ({
    commercialPost: mocks.post,
    commercialError: (error: Error) => error.message,
}));

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T00:00:00Z'));
    mocks.post.mockReset();
});
afterEach(() => {
    cleanup();
    clients.splice(0).forEach((client) => client.clear());
    vi.useRealTimers();
});

async function mountVerification(onVerified: Mock<(token: string, expiresAt?: number) => void>) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});

    clients.push(client);
    render(
        <QueryClientProvider client={client}>
            <Reauthenticate onVerified={onVerified} />
        </QueryClientProvider>,
    );
    await act(async () => fireEvent.click(screen.getByRole('button', {name: '인증번호 받기'})));
    onVerified.mockClear();
}

async function confirm() {
    fireEvent.change(screen.getByLabelText('이메일 인증번호'), {target: {value: '123456'}});
    await act(async () => fireEvent.submit(screen.getByLabelText('이메일 인증번호').closest('form')!));
}

describe('email proof expiry', () => {
    it.each([
        [undefined, 600_000],
        ['2026-10-23T00:30:00', 600_000],
        ['2026-10-23T00:01:00', 60_000],
    ])('clears proof at its capped deadline for server expiry %s', async (expiresAt, duration) => {
        const onVerified = vi.fn();

        mocks.post.mockResolvedValue({reauthenticationToken: 'proof-fixture', expiresAt});
        await mountVerification(onVerified);
        await confirm();
        expect(onVerified).toHaveBeenLastCalledWith('proof-fixture', Date.now() + duration);
        await act(async () => vi.advanceTimersByTimeAsync(duration - 1));
        expect(onVerified).toHaveBeenCalledTimes(1);
        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(onVerified).toHaveBeenLastCalledWith('');
        expect(screen.getByText('인증 시간이 지났습니다. 인증번호를 다시 받아 주세요.')).toBeInTheDocument();
    });

    it.each(['invalid', '2026-10-22T23:59:59Z'])('rejects an invalid or expired server deadline %s', async (expiresAt) => {
        const onVerified = vi.fn();

        mocks.post.mockResolvedValue({reauthenticationToken: 'proof-fixture', expiresAt});
        await mountVerification(onVerified);
        await confirm();
        expect(onVerified).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('인증 시간이 지났습니다');
    });

    it('requires a fresh code request after a previous proof expires', async () => {
        const onVerified = vi.fn();

        mocks.post.mockResolvedValue({reauthenticationToken: 'proof-fixture'});
        await mountVerification(onVerified);
        await confirm();
        await act(async () => vi.advanceTimersByTimeAsync(600_000));
        await act(async () => fireEvent.click(screen.getByRole('button', {name: '인증번호 받기'})));
        expect(onVerified).toHaveBeenLastCalledWith('');
        expect(mocks.post).toHaveBeenLastCalledWith('/reauthentication/request');
    });

    it('submits verification once while duplicate submissions are pending', async () => {
        mocks.post.mockResolvedValueOnce({}).mockReturnValue(new Promise(() => undefined));
        await mountVerification(vi.fn());
        fireEvent.change(screen.getByLabelText('이메일 인증번호'), {target: {value: '123456'}});

        const form = screen.getByLabelText('이메일 인증번호').closest('form')!;

        fireEvent.submit(form);
        fireEvent.submit(form);
        expect(mocks.post.mock.calls.filter(([path]) => path === '/reauthentication/confirm')).toHaveLength(1);
    });
});
