import {webcrypto} from 'node:crypto';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import WardAPI from '@/shared/api/ward';
import {saveTemporarySnapshot} from '../save-temporary-snapshot';

vi.mock('@/features/auth/model/store', () => ({default: {getState: () => ({accountId: 1})}}));
vi.mock('@/shared/api/ward', () => ({default: {saveSnapshot: vi.fn()}}));

const save = vi.mocked(WardAPI.saveSnapshot);
const draft = {title: 'Draft 1', year: 2026, month: 12, cells: [], rowOrder: []};
const receipt = {title: draft.title, snapshotId: 42, year: 2026, month: 12, savedAt: '2026-11-27T12:00:00'};

beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
    sessionStorage.clear();
    save.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe('temporary snapshot save', () => {
    it('reuses the original key and title after a lost response', async () => {
        save.mockRejectedValueOnce(new Error('network disconnected')).mockResolvedValueOnce(receipt);
        await expect(saveTemporarySnapshot(3, 4, draft)).rejects.toThrow('network disconnected');
        await expect(saveTemporarySnapshot(3, 4, {...draft, title: 'Draft 2'})).resolves.toEqual(receipt);
        expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
        expect(sessionStorage.length).toBe(0);
    });

    it('keeps pending attempts distinct by scope and contents', async () => {
        save.mockRejectedValue(new Error('save unavailable'));
        for (const [ward, team, dto] of [
            [3, 4, draft],
            [3, 5, draft],
            [6, 4, draft],
            [3, 4, {...draft, month: 11}],
        ] as const) {
            await expect(saveTemporarySnapshot(ward, team, dto)).rejects.toThrow('save unavailable');
        }
        const keys = save.mock.calls.map(([, , dto]) => dto.idempotencyKey);
        expect(new Set(keys).size).toBe(4);
        expect(sessionStorage.length).toBe(4);
    });
});
