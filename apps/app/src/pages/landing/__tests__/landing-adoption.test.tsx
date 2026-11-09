import {renderToString} from 'react-dom/server';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {SELLER} from '@/shared/business/profile';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {LandingAdoption} from '../landing-adoption';

describe('LandingAdoption', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('renders an email link and no form before hydration even when an endpoint is configured', () => {
        vi.stubEnv('VITE_LANDING_ADOPTION_ENDPOINT', 'https://forms.example.test/landing');

        const html = renderToString(<LandingAdoption />);

        expect(html).toContain(`href="mailto:${SELLER.email}"`);
        expect(html).not.toContain('<form');
    });

    it('offers an email handoff when a submission endpoint is unavailable', () => {
        vi.stubEnv('VITE_LANDING_ADOPTION_ENDPOINT', '');
        render(<LandingAdoption />);

        expect(screen.getByRole('button', {name: '문의하기'})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '개인정보 처리방침'})).toHaveAttribute('href', '/privacy');
        expect(screen.queryByText('이메일 앱에서 내용을 확인하고 전송해 주세요.')).not.toBeInTheDocument();
        expect(screen.getByRole('link', {name: SELLER.email})).toHaveAttribute('href', `mailto:${SELLER.email}`);
        expect(screen.queryByText('신청이 접수됐어요.')).not.toBeInTheDocument();
    });

    it('requires consent and only confirms an acknowledged submission, reusing the same request ID on retry', async () => {
        vi.stubEnv('VITE_LANDING_ADOPTION_ENDPOINT', 'https://forms.example.test/landing');

        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(Response.json({accepted: false}))
            .mockResolvedValueOnce(Response.json({accepted: true}));

        vi.stubGlobal('fetch', fetchMock);

        const user = userEvent.setup();

        render(<LandingAdoption />);
        await user.type(screen.getByRole('textbox', {name: '병원명'}), '예시병원');
        await user.type(screen.getByRole('textbox', {name: '병동명'}), '예시병동');
        await user.type(screen.getByRole('textbox', {name: '담당자 연락처'}), 'nurse@example.test');

        const submit = screen.getByRole('button', {name: '문의하기'});

        await user.click(submit);
        expect(fetchMock).not.toHaveBeenCalled();

        const consent = screen.getByRole('checkbox', {name: /개인정보 처리방침.*위 정보를 도입 안내 목적으로 수집·이용하는 데 동의합니다/});

        await user.click(screen.getByText('에 따라 위 정보를 도입 안내 목적으로 수집·이용하는 데 동의합니다. (필수)'));
        expect(consent).toBeChecked();
        await user.click(submit);
        expect(await screen.findByRole('alert')).toHaveTextContent('접수 여부를 확인하지 못했어요.');
        expect(screen.queryByText('신청이 접수됐어요.')).not.toBeInTheDocument();

        await user.click(submit);
        expect(await screen.findByText('신청이 접수됐어요.')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveFocus();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0][1]?.body).toEqual(fetchMock.mock.calls[1][1]?.body);
        expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
            hospitalName: '예시병원',
            wardName: '예시병동',
            contact: 'nurse@example.test',
            privacyConsent: true,
            requestId: expect.any(String),
        });
    });

    it('shows contact validation beside the field and clears it when the contact changes', async () => {
        vi.stubEnv('VITE_LANDING_ADOPTION_ENDPOINT', '');

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
