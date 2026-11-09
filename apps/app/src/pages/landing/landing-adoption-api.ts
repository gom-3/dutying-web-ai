import {isAxiosError} from 'axios';
import {createPersonalAccountSession} from '@/features/auth/model/personal-session';
import type {TAdoptionDraft} from './landing-adoption-return';

const isAdoptionEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function submitLandingAdoption({hospitalName, wardName, contact}: TAdoptionDraft) {
    try {
        const {account, client} = await createPersonalAccountSession();
        const replyEmail = isAdoptionEmail(contact) ? contact : account.email?.trim();

        if (!replyEmail || !isAdoptionEmail(replyEmail)) return 'emailRequired';

        const content = [
            '[랜딩] 병원·병동 도입 문의',
            `병원명: ${hospitalName}`,
            `병동명: ${wardName}`,
            `연락처: ${contact}`,
            '개인정보 수집·이용 동의',
        ].join('\n');
        const {data} = await client.post<{inquiryId: number}>(
            `/accounts/${account.accountId}/support/inquiries`,
            {replyEmail, content},
            {
                timeout: 15_000,
            },
        );

        if (!Number.isSafeInteger(data?.inquiryId) || data.inquiryId <= 0) throw new Error('Inquiry was not acknowledged');

        return 'accepted';
    } catch (error) {
        if (isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) return 'signIn';

        throw error;
    }
}
