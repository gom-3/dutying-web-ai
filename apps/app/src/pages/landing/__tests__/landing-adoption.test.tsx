import {renderToString} from 'react-dom/server';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {SELLER} from '@/shared/business/profile';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {LandingAdoption} from '../landing-adoption';

describe('LandingAdoption', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
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

    it('submits without an account after consent and keeps the form available on failure', async () => {
        vi.stubEnv('VITE_SERVER_URL', 'https://api.example.test');
        const submitRequest = vi
            .fn()
            .mockResolvedValueOnce(new Response(null, {status: 429}))
            .mockResolvedValueOnce(new Response(null, {status: 204}));
        vi.stubGlobal('fetch', submitRequest);
        const user = userEvent.setup();

        render(<LandingAdoption />);
        await user.type(screen.getByRole('textbox', {name: '병원명'}), '예시병원');
        await user.type(screen.getByRole('textbox', {name: '병동명'}), '예시병동');
        const contact = screen.getByRole('textbox', {name: '담당자 연락처'});
        await user.type(contact, '010-1234-5678');

        const submit = screen.getByRole('button', {name: '문의하기'});
        await user.click(submit);
        expect(submitRequest).not.toHaveBeenCalled();

        await user.click(screen.getByRole('checkbox'));
        await user.click(submit);
        expect(await screen.findByRole('alert')).toHaveTextContent('접수 여부를 확인하지 못했어요.');
        expect(contact).toHaveValue('010-1234-5678');
        expect(screen.queryByText('신청이 접수됐어요.')).not.toBeInTheDocument();

        await user.click(submit);
        expect(await screen.findByText('신청이 접수됐어요.')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveFocus();
        expect(submitRequest).toHaveBeenCalledTimes(2);
        expect(submitRequest).toHaveBeenLastCalledWith(
            'https://api.example.test/public/v1/support/adoption-inquiries',
            expect.objectContaining({
                method: 'POST',
                credentials: 'omit',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    hospitalName: '예시병원',
                    wardName: '예시병동',
                    contact: '010-1234-5678',
                    privacyConsent: true,
                }),
            }),
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
