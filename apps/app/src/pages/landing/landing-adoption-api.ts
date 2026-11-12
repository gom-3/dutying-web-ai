import {RUNTIME_CONFIG} from '@/shared/config/runtime';

type TAdoptionFields = {hospitalName: string; wardName: string; contact: string};

export async function submitLandingAdoption(fields: TAdoptionFields) {
    const response = await fetch(`${RUNTIME_CONFIG.serverUrl()}/public/v1/support/adoption-inquiries`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({...fields, privacyConsent: true}),
    });

    if (response.status !== 204) throw new Error('Inquiry was not acknowledged');
}
