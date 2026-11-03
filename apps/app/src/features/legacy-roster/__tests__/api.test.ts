import {beforeEach, describe, expect, it, vi} from 'vitest';
import client from '@/shared/api/client';
import {legacyRosterApi, parseRosterFile} from '../api';
vi.mock('@/shared/api/client', () => ({default: {get: vi.fn(), post: vi.fn()}}));

const summary = {importedShifts: 2, skippedShifts: 0, createdShiftTypes: 1, reusedShiftTypes: 0, alreadyImported: false};
const file = {
    format: 'dutying-legacy-roster',
    version: 1,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    shiftTypes: [{id: 101}],
    shifts: [{date: '2024-02-29', shiftTypeId: 101}],
};
const upload = (data: unknown, size = 100) => ({size, text: async () => JSON.stringify(data)}) as File;

beforeEach(() => vi.resetAllMocks());
describe('legacy roster API contract', () => {
    it('strips unrelated identity and credentials from selected files', async () => {
        const parsed = await parseRosterFile(upload({...file, accessToken: 'must-not-forward', accountId: 99}));

        expect(parsed).not.toHaveProperty('accessToken');
        expect(parsed).not.toHaveProperty('accountId');
        expect(parsed.shifts[0]).toEqual(file.shifts[0]);
    });
    it('rejects oversized and unsupported files before an API call', async () => {
        await expect(parseRosterFile(upload(file, 2 * 1024 * 1024 + 1))).rejects.toThrow('2MB');
        await expect(parseRosterFile(upload({...file, version: 2}))).rejects.toThrow();
        await expect(parseRosterFile(upload({...file, shiftTypes: [null]}))).rejects.toThrow();
        expect(client.post).not.toHaveBeenCalled();
    });
    it('sends the confirmed source hash to the authenticated account and validates results', async () => {
        vi.mocked(client.post).mockResolvedValue({data: summary});

        const hash = 'b'.repeat(64);

        expect(await legacyRosterApi.commitSource(7, 2024, hash)).toEqual(summary);
        expect(client.post).toHaveBeenCalledWith(
            '/accounts/7/shift-imports/legacy/source/2024/commit',
            {sourceHash: hash},
            {suppressErrorToast: true},
        );
        await expect(legacyRosterApi.commitSource(0, 2024, hash)).rejects.toThrow();
        vi.mocked(client.post).mockResolvedValue({data: {...summary, importedShifts: -1}});
        await expect(legacyRosterApi.commitFile(7, await parseRosterFile(upload(file)))).rejects.toThrow();
    });
});
