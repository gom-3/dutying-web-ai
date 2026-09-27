import {buildAutofillDTO} from '@/features/shift-editor/model/schedule-authoring';
import useAuthStore from '@/features/auth/model/store';
import {commercialGet} from '@/features/commercial/api';
import type {TAutofillResponse} from '@dutying/api/ward';
import WardAPI from '@/shared/api/ward';
import type {TAiScheduleProvider} from './ai-schedule-contract';

export const apiAiScheduleProvider: TAiScheduleProvider = {
    generate: async ({
        wardId,
        shiftTeamId,
        year,
        month,
        doc,
        originalShift,
        draftRevision,
        rulesHash,
        prompt,
        adjust,
        lockedCellKeys,
        signal,
    }) => {
        const dto = buildAutofillDTO({
            year,
            month,
            draftRevision,
            rulesHash,
            doc,
            originalShift,
            prompt,
            adjust,
            lockedCellKeys,
        });

        const storageKey = `dutying.ai-pending:${useAuthStore.getState().accountId}:${wardId}:${shiftTeamId}`;
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(dto)));
        const fingerprint = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
        let pending: {key: string; fingerprint: string} | null = null;
        try {
            pending = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
        } catch {
            sessionStorage.removeItem(storageKey);
        }
        if (pending) {
            try {
                const job = await commercialGet<{status: string; result?: string}>(
                    `/wards/${wardId}/ai-job?requestKey=${encodeURIComponent(pending.key)}`,
                );
                if (['RUNNING', 'UNKNOWN'].includes(job.status))
                    throw Object.assign(new Error('이전 AI 작업의 결과를 확인 중입니다. 잠시 후 다시 확인해 주세요.'), {
                        serverCode: 'AI_RECONCILING',
                    });
                if (job.result && pending.fingerprint === fingerprint) {
                    sessionStorage.removeItem(storageKey);
                    return JSON.parse(job.result) as TAutofillResponse;
                }
                pending = null;
            } catch (error) {
                const e = error as {code?: number; serverCode?: string};
                if (e.code !== 404 && e.serverCode !== 'COMMERCIAL_NOT_ENABLED') throw error;
            }
        }
        const key = pending?.fingerprint === fingerprint ? pending.key : crypto.randomUUID();
        sessionStorage.setItem(storageKey, JSON.stringify({key, fingerprint}));
        try {
            const result = await WardAPI.autofillSchedule(wardId, shiftTeamId, {...dto, idempotencyKey: key}, {signal});
            sessionStorage.removeItem(storageKey);
            window.dispatchEvent(new Event('dutying:commercial-usage-changed'));
            return result;
        } catch (error) {
            // Keep the original request key until its server-side outcome is known.
            window.dispatchEvent(new Event('dutying:commercial-usage-changed'));
            throw error;
        }
    },
};
