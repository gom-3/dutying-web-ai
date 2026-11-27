import type {TSaveSnapshotDTO} from '@dutying/api/ward';
import useAuthStore from '@/features/auth/model/store';
import WardAPI from '@/shared/api/ward';

export async function saveTemporarySnapshot(wardId: number, teamId: number, dto: TSaveSnapshotDTO) {
    const accountId = useAuthStore.getState().accountId;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({...dto, title: undefined})));
    const fingerprint = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const storageKey = `dutying.snapshot-save:${accountId}:${wardId}:${teamId}:${fingerprint}`;

    let pending: {key: string; title: string} | null = null;
    try {
        const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
        if (typeof stored?.key === 'string' && typeof stored?.title === 'string') pending = stored;
    } catch {
        // A new key still protects HTTP retries in a tab without session storage.
    }
    pending ??= {key: crypto.randomUUID(), title: dto.title};
    try {
        sessionStorage.setItem(storageKey, JSON.stringify(pending));
    } catch {
        // Keep the request usable if browser storage is disabled.
    }

    const saved = await WardAPI.saveSnapshot(wardId, teamId, {...dto, title: pending.title, idempotencyKey: pending.key});
    try {
        sessionStorage.removeItem(storageKey);
    } catch {
        // Storage failure cannot invalidate an acknowledged save.
    }
    return saved;
}
