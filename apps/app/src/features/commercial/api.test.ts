import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CommercialAPI} from './api';

const {get, put} = vi.hoisted(() => ({get: vi.fn(), put: vi.fn()}));

vi.mock('@/shared/api/client', () => ({
    adminAxiosInstance: {get, put},
}));

describe('CommercialAPI', () => {
    beforeEach(() => vi.clearAllMocks());

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
});
