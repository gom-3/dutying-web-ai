import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CommercialAPI, commercialGet, commercialPost, getCommercialContext, isPlanEnforcementEnabled} from './api';

const {get, put, post} = vi.hoisted(() => ({get: vi.fn(), put: vi.fn(), post: vi.fn()}));

vi.mock('@/shared/api/client', () => ({
    registerAdminSessionRecovery: vi.fn(),
    adminAxiosInstance: {get, put, post},
}));

describe('CommercialAPI', () => {
    beforeEach(() => vi.clearAllMocks());

    it('uses unified allowance and batch routes while preserving the caller idempotency key', async () => {
        get.mockResolvedValue({data: {}});
        post.mockResolvedValue({data: {}});
        await commercialGet('/scopes/WARD/12/entitlements');
        expect(get).toHaveBeenLastCalledWith('/admin/commercial/v2/scopes/WARD/12/entitlements', {suppressErrorToast: true});
        await commercialGet('/wards/12/ai-batches/existing-key');
        expect(get).toHaveBeenLastCalledWith('/admin/commercial/v2/wards/12/ai-batches/existing-key', {suppressErrorToast: true});

        const request = {items: []};

        await commercialPost('/wards/12/ai-batches', request, 'batch-key');
        expect(post).toHaveBeenLastCalledWith('/admin/commercial/v2/wards/12/ai-batches', request, {
            headers: {'Idempotency-Key': 'batch-key'},
            suppressErrorToast: true,
        });
    });

    it('uses only the minimal plan and usage endpoints', async () => {
        get.mockResolvedValueOnce({data: [{planCode: 'FREE'}]}).mockResolvedValueOnce({data: {planCode: 'FREE'}});

        await CommercialAPI.getPlans();
        await CommercialAPI.getWardUsage(12);

        expect(get).toHaveBeenNthCalledWith(1, '/admin/commercial/plans', {suppressErrorToast: true});
        expect(get).toHaveBeenNthCalledWith(2, '/admin/commercial/wards/12/usage', {suppressErrorToast: true});
    });

    it('sends the selected plan to the development plan endpoint', async () => {
        put.mockResolvedValue({data: {planCode: 'PLUS'}});

        await CommercialAPI.applyDevelopmentPlan(12, 'PLUS');

        expect(put).toHaveBeenCalledWith('/admin/commercial/wards/12/plan', {planCode: 'PLUS'}, {suppressErrorToast: true});
    });

    it('treats the missing pre-launch commercial context as disabled', async () => {
        get.mockRejectedValue(Object.assign(new Error('Not found'), {code: 404}));

        await expect(getCommercialContext()).resolves.toEqual({enabled: false, scopes: []});
        expect(get).toHaveBeenCalledWith('/admin/commercial/access-context', {suppressErrorToast: true});
    });

    it('does not hide other commercial context failures', async () => {
        const error = Object.assign(new Error('Unavailable'), {code: 503});

        get.mockRejectedValue(error);

        await expect(getCommercialContext()).rejects.toBe(error);
    });
});

describe('billing and existing feature enforcement', () => {
    it('does not load plan restrictions when only billing is enabled', () => {
        expect(isPlanEnforcementEnabled({enabled: true, enforcementEnabled: false, scopes: []})).toBe(false);
    });

    it('keeps restrictions compatible with older servers', () => {
        expect(isPlanEnforcementEnabled({enabled: true, scopes: []})).toBe(true);
        expect(isPlanEnforcementEnabled({enabled: true, enforcementEnabled: true, scopes: []})).toBe(true);
    });

    it('never enables restrictions for a disabled or unavailable commercial context', () => {
        expect(isPlanEnforcementEnabled({enabled: false, enforcementEnabled: true, scopes: []})).toBe(false);
        expect(isPlanEnforcementEnabled()).toBe(false);
    });
});
