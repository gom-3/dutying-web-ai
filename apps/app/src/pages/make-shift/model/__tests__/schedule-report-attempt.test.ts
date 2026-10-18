import {createHash} from 'node:crypto';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {REPORT_SESSION_PREFIX, REPORT_SESSION_TTL, ScheduleReportAttempt, scheduleReportScope} from '../schedule-report-attempt';

const hash = async (text: string) => createHash('sha256').update(text).digest('hex');
const create = (overrides: ConstructorParameters<typeof ScheduleReportAttempt>[0] = {}) => new ScheduleReportAttempt({hash, ...overrides});

beforeEach(() => sessionStorage.clear());

describe('scoped session report action keys', () => {
    it('recovers the key after remount using the same normalized note without persisting raw content', async () => {
        const note = '간호사 이름과 원문을 저장하지 않아요';
        const key = await create().keyFor('owner:ward:team:conversation:operation', ` ${note} `);
        const raw = sessionStorage.getItem(sessionStorage.key(0)!)!;

        expect(raw).not.toContain(note);
        expect(raw).not.toContain('owner:ward');
        expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['createdAt', 'digest', 'key', 'scope', 'version']);

        const remounted = create();

        expect(await remounted.keyFor('owner:ward:team:conversation:operation', note)).toBe(key);
        expect(remounted.recoverable).toBe(true);
    });
    it('does not restore any other owner, permission, ward, team, month, conversation or operation scope', async () => {
        const base = {
            mode: 'account' as const,
            ownerId: 4,
            permission: true,
            wardId: 1,
            teamId: 2,
            year: 2026,
            month: 11,
            conversationId: 3,
            operationId: 'op:1',
        };
        const key = await create().keyFor(scheduleReportScope(base), '의견');
        const changes = [
            {mode: 'admin' as const},
            {ownerId: 5},
            {permission: false},
            {permission: null},
            {wardId: 5},
            {teamId: 3},
            {year: 2027},
            {month: 12},
            {conversationId: 4},
            {operationId: 'op:2'},
        ];

        for (const change of changes) expect(await create().keyFor(scheduleReportScope({...base, ...change}), '의견')).not.toBe(key);
    });
    it('keeps unidentified principals in memory only', async () => {
        const action = create();

        expect(
            scheduleReportScope({
                mode: 'admin',
                ownerId: null,
                permission: null,
                wardId: 1,
                teamId: 2,
                year: 2026,
                month: 11,
                conversationId: 3,
                operationId: 'op',
            }),
        ).toBeUndefined();

        const key = await action.keyFor(undefined, '의견');

        expect(await action.keyFor(undefined, '의견')).not.toBe(key);
        expect(action.recoverable).toBe(false);
        expect(sessionStorage.length).toBe(0);
    });
    it('changes the key for edited content, including editing away and back', async () => {
        const action = create();
        const key = await action.keyFor('scope', '의견');

        action.noteChanged('의견  ');
        expect(await action.keyFor('scope', '의견')).toBe(key);
        action.noteChanged('다른 의견');
        expect(await action.keyFor('scope', '의견')).not.toBe(key);
        expect(await create().keyFor('scope', '새 내용')).not.toBe(key);
    });
    it('cleans up on success or explicit cancel, even before re-entering a note after remount', async () => {
        const first = await create().keyFor('scope', '의견');

        await create().cancel('scope');
        expect(sessionStorage.length).toBe(0);
        expect(await create().keyFor('scope', '의견')).not.toBe(first);
    });
    it('does not delete a newer action when an older request completes', async () => {
        const old = create();

        await old.keyFor('scope', '이전');

        const newer = await create().keyFor('scope', '새 의견');

        await old.cancel('scope');
        expect(await create().keyFor('scope', '새 의견')).toBe(newer);
    });
    it.each(['corrupt', 'expired', 'future', 'wrong-scope', 'wrong-version', 'invalid-key', 'invalid-digest'])(
        'ignores %s metadata',
        async (kind) => {
            const now = 1000000000;
            const key = await create({now: () => now}).keyFor('scope', '의견');
            const storageKey = sessionStorage.key(0)!;
            const receipt = JSON.parse(sessionStorage.getItem(storageKey)!);

            if (kind === 'expired') receipt.createdAt -= REPORT_SESSION_TTL;

            if (kind === 'future') receipt.createdAt += 1;

            if (kind === 'wrong-scope') receipt.scope = '0'.repeat(64);

            if (kind === 'wrong-version') receipt.version = 2;

            if (kind === 'invalid-key') receipt.key = 'not-a-uuid';

            if (kind === 'invalid-digest') receipt.digest = 'broken';

            sessionStorage.setItem(storageKey, kind === 'corrupt' ? '{' : JSON.stringify(receipt));
            expect(await create({now: () => now}).keyFor('scope', '의견')).not.toBe(key);
        },
    );
    it('does not extend the expiry on retries, and expires the in-memory action too', async () => {
        let now = 1000000000;

        const action = create({now: () => now});
        const key = await action.keyFor('scope', '의견');

        now += REPORT_SESSION_TTL - 1;
        expect(await create({now: () => now}).keyFor('scope', '의견')).toBe(key);
        now += 1;
        expect(await action.keyFor('scope', '의견')).not.toBe(key);
    });
    it.each(['access', 'get', 'set', 'hash'])('keeps same-mount retries usable when %s fails', async (failure) => {
        const fail = () => {
            throw new Error('unavailable');
        };
        const storage = {getItem: vi.fn(() => null as string | null), setItem: vi.fn(), removeItem: vi.fn()};

        if (failure === 'get') storage.getItem.mockImplementation(fail);

        if (failure === 'set') storage.setItem.mockImplementation(fail);

        const action = create({storage: failure === 'access' ? fail : () => storage, hash: failure === 'hash' ? async () => fail() : hash});
        const key = await action.keyFor('scope', '의견');

        expect(await action.keyFor('scope', '의견')).toBe(key);
        expect(action.recoverable).toBe(false);
        await expect(action.cancel('scope')).resolves.toBeUndefined();
    });
    it('does not reuse a completed key in the same mount when both cleanup writes fail', async () => {
        const action = create();
        const key = await action.keyFor('scope', '의견');
        const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new Error('cannot remove');
        });
        const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('cannot write');
        });

        expect(() => action.complete()).not.toThrow();
        expect(await action.keyFor('scope', '의견')).not.toBe(key);
        expect(action.recoverable).toBe(false);
        remove.mockRestore();
        set.mockRestore();
    });
    it('writes a terminal marker when removal fails, and never makes cleanup a functional failure', async () => {
        const action = create();
        const key = await action.keyFor('scope', '의견');
        const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new Error('cannot remove');
        });

        await expect(action.cancel('scope')).resolves.toBeUndefined();
        expect(JSON.parse(sessionStorage.getItem(sessionStorage.key(0)!)!).ended).toBe(true);
        remove.mockRestore();
        expect(await create().keyFor('scope', '의견')).not.toBe(key);
        expect(sessionStorage.key(0)).toContain(REPORT_SESSION_PREFIX);
    });
});
