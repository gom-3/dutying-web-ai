import type {AxiosInstance} from 'axios';
import {renderToString} from 'react-dom/server';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createPersonalAccountSession} from '@/features/auth/model/personal-session';
import {SELLER} from '@/shared/business/profile';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {LandingAdoption} from '../landing-adoption';
import {saveAdoptionDraft} from '../landing-adoption-return';

vi.mock('@/features/auth/model/personal-session', () => ({createPersonalAccountSession: vi.fn()}));

const mockPersonalSession = (post: AxiosInstance['post']) =>
    vi.mocked(createPersonalAccountSession).mockResolvedValue({
        account: {accountId: 23, email: 'account@example.test', name: '테스트', status: 'LINKED'},
        client: {post} as AxiosInstance,
    });

describe('LandingAdoption', () => {
    afterEach(() => {
        vi.resetAllMocks();
        vi.unstubAllEnvs();
        sessionStorage.clear();
        window.history.replaceState({}, '', '/');
    });

    it('renders the email fallback before hydration', () => {
        const html = renderToString(<LandingAdoption />);

        expect(html).toContain(`href="mailto:${SELLER.email}"`);
        expect(html).not.toContain('<form');
    });

    it('offers direct submission after hydration', () => {
        render(<LandingAdoption />);

        expect(screen.getByRole('button', {name: '문의하기'})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '개인정보 처리방침'})).toHaveAttribute('href', '/privacy');
        expect(screen.queryByText('이메일 앱에서 내용을 확인하고 전송해 주세요.')).not.toBeInTheDocument();
        expect(screen.getByRole('link', {name: SELLER.email})).toHaveAttribute('href', `mailto:${SELLER.email}`);
        expect(screen.queryByText('신청이 접수됐어요.')).not.toBeInTheDocument();
    });

    it('requires consent and submits the inquiry body to the existing app endpoint', async () => {
        const post = vi
            .fn()
            .mockResolvedValueOnce({data: {}})
            .mockResolvedValueOnce({data: {inquiryId: 19}});
        mockPersonalSession(post);

        const user = userEvent.setup();

        render(<LandingAdoption />);
        await user.type(screen.getByRole('textbox', {name: '병원명'}), '예시병원');
        await user.type(screen.getByRole('textbox', {name: '병동명'}), '예시병동');
        await user.type(screen.getByRole('textbox', {name: '담당자 연락처'}), 'nurse@example.test');

        const submit = screen.getByRole('button', {name: '문의하기'});

        await user.click(submit);
        expect(createPersonalAccountSession).not.toHaveBeenCalled();

        const consent = screen.getByRole('checkbox', {name: /개인정보 처리방침.*위 정보를 도입 안내 목적으로 수집·이용하는 데 동의합니다/});

        await user.click(screen.getByText('에 따라 위 정보를 도입 안내 목적으로 수집·이용하는 데 동의합니다. (필수)'));
        expect(consent).toBeChecked();
        await user.click(submit);
        expect(await screen.findByRole('alert')).toHaveTextContent('접수 여부를 확인하지 못했어요.');
        expect(screen.queryByText('신청이 접수됐어요.')).not.toBeInTheDocument();

        await user.click(submit);
        expect(await screen.findByText('신청이 접수됐어요.')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveFocus();
        expect(post).toHaveBeenCalledTimes(2);
        expect(post).toHaveBeenLastCalledWith(
            '/accounts/23/support/inquiries',
            {
                replyEmail: 'nurse@example.test',
                content:
                    '[랜딩] 병원·병동 도입 문의\n병원명: 예시병원\n병동명: 예시병동\n연락처: nurse@example.test\n개인정보 수집·이용 동의',
            },
            {timeout: 15_000},
        );
    });

    it('offers personal sign-in when the existing API requires authentication', async () => {
        vi.mocked(createPersonalAccountSession).mockRejectedValue({isAxiosError: true, response: {status: 401}});
        const user = userEvent.setup();

        render(<LandingAdoption />);
        await user.type(screen.getByRole('textbox', {name: '병원명'}), '예시병원');
        await user.type(screen.getByRole('textbox', {name: '병동명'}), '예시병동');
        const contact = screen.getByRole('textbox', {name: '담당자 연락처'});
        await user.type(contact, 'nurse@example.test');
        await user.click(screen.getByRole('checkbox'));
        await user.click(screen.getByRole('button', {name: '문의하기'}));

        const link = await screen.findByRole('link', {name: 'Google로 로그인'});
        const signInUrl = new URL((link as HTMLAnchorElement).href);
        const callback = new URL(signInUrl.searchParams.get('nextPageUrl')!);

        expect(signInUrl.pathname).toBe('/oauth2/authorization/google');
        expect(callback.pathname).toBe('/legacy-roster');
        expect(callback.searchParams.get('landingAdoption')).toBe('/');
        expect(contact).toHaveValue('nurse@example.test');
        expect(screen.queryByText('신청이 접수됐어요.')).not.toBeInTheDocument();
    });

    it('restores the draft after sign-in and sends phone numbers in the inquiry text', async () => {
        window.history.replaceState({}, '', '/#adoption');
        saveAdoptionDraft('/', {hospitalName: '예시병원', wardName: '예시병동', contact: '010-1234-5678'});
        const post = vi.fn().mockResolvedValue({data: {inquiryId: 19}});
        mockPersonalSession(post);
        const user = userEvent.setup();

        render(<LandingAdoption />);
        expect(screen.getByRole('textbox', {name: '담당자 연락처'})).toHaveValue('010-1234-5678');
        expect(screen.getByRole('checkbox')).toBeChecked();
        expect(post).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', {name: '문의하기'}));

        expect(await screen.findByText('신청이 접수됐어요.')).toBeInTheDocument();
        expect(post).toHaveBeenCalledExactlyOnceWith(
            '/accounts/23/support/inquiries',
            {replyEmail: 'account@example.test', content: expect.stringContaining('연락처: 010-1234-5678')},
            {timeout: 15_000},
        );
    });

    it('shows contact validation beside the field and clears it when the contact changes', async () => {
        const user = userEvent.setup();

        render(<LandingAdoption />);

        const contact = screen.getByRole('textbox', {name: '담당자 연락처'});

        await user.type(screen.getByRole('textbox', {name: '병원명'}), '예시병원');
        await user.type(screen.getByRole('textbox', {name: '병동명'}), '예시병동');
        await user.type(contact, '확인 필요');
        await user.click(screen.getByRole('checkbox', {name: /위 정보를 도입 안내 목적으로 수집·이용하는 데 동의합니다/}));
        await user.click(screen.getByRole('button', {name: '문의하기'}));

        expect(contact).toHaveFocus();
        expect(contact).toHaveAttribute('aria-invalid', 'true');
        expect(contact).toHaveAccessibleDescription('전화번호 또는 이메일을 확인해 주세요.');

        await user.clear(contact);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
