export const REPORT_SESSION_PREFIX = 'dutying.schedule-report.v1:';
export const REPORT_SESSION_TTL = 24 * 60 * 60 * 1000;

type TStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type TReceipt = {version: 1; scope: string; key: string; digest: string; createdAt: number; ended?: boolean};
type TPending = {scope?: string; note: string; key: string; storageKey?: string; createdAt: number; recoverable: boolean};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hex = /^[0-9a-f]{64}$/;
const sha256 = async (text: string) =>
    Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');

export function scheduleReportScope(scope: {
    mode: 'account' | 'admin';
    ownerId: number | null;
    permission: boolean | null;
    wardId: number;
    teamId: number;
    year: number;
    month: number;
    conversationId: number;
    operationId: string;
}): string | undefined {
    if (
        scope.ownerId === null ||
        !Number.isSafeInteger(scope.ownerId) ||
        scope.ownerId <= 0 ||
        (scope.mode === 'account' && scope.permission === null)
    )
        return;

    return JSON.stringify([
        scope.mode,
        scope.ownerId,
        scope.permission,
        scope.wardId,
        scope.teamId,
        scope.year,
        scope.month,
        scope.conversationId,
        scope.operationId,
    ]);
}

/** Only scoped UUID/digests/timestamps enter session storage. No note, token or schedule is persisted. */
export class ScheduleReportAttempt {
    private pending?: TPending;
    private readonly retiredKeys = new Set<string>();
    private readonly options;

    constructor(
        options: {
            newKey?: () => string;
            hash?: (text: string) => Promise<string>;
            now?: () => number;
            storage?: () => TStorage;
        } = {},
    ) {
        this.options = {
            newKey: () => crypto.randomUUID() as string,
            hash: sha256,
            now: () => Date.now(),
            storage: () => sessionStorage,
            ...options,
        };
    }

    get recoverable() {
        return this.pending?.recoverable ?? false;
    }

    private read(storage: TStorage, storageKey: string, scope: string): TReceipt | undefined {
        const raw = storage.getItem(storageKey);

        if (!raw) return;

        try {
            const receipt: TReceipt = JSON.parse(raw);
            const age = this.options.now() - receipt.createdAt;

            if (
                receipt.version === 1 &&
                receipt.scope === scope &&
                uuid.test(receipt.key) &&
                hex.test(receipt.digest) &&
                Number.isFinite(receipt.createdAt) &&
                age >= 0 &&
                age < REPORT_SESSION_TTL &&
                !receipt.ended
            )
                return receipt;
        } catch {
            // Corrupt or unsupported metadata cannot identify a previous action.
        }

        storage.removeItem(storageKey);
    }

    async keyFor(scope: string | undefined, note: string): Promise<string> {
        const normalized = note.trim();

        if (
            scope &&
            this.pending?.scope === scope &&
            this.pending.note === normalized &&
            this.options.now() - this.pending.createdAt >= 0 &&
            this.options.now() - this.pending.createdAt < REPORT_SESSION_TTL
        )
            return this.pending.key;

        const pending: TPending = {scope, note: normalized, key: this.options.newKey(), createdAt: this.options.now(), recoverable: false};

        this.pending = pending;

        if (!scope) return pending.key;

        try {
            const scopeDigest = await this.options.hash(scope);
            const storageKey = REPORT_SESSION_PREFIX + scopeDigest;
            const storage = this.options.storage();
            const previous = this.read(storage, storageKey, scopeDigest);

            let recovered: TReceipt | undefined;

            if (previous && !this.retiredKeys.has(previous.key)) {
                const digest = await this.options.hash(JSON.stringify([scopeDigest, previous.key, normalized]));

                if (previous.digest === digest) recovered = previous;
            }

            if (recovered) pending.key = recovered.key;

            const receipt: TReceipt = recovered ?? {
                version: 1,
                scope: scopeDigest,
                key: pending.key,
                digest: await this.options.hash(JSON.stringify([scopeDigest, pending.key, normalized])),
                createdAt: this.options.now(),
            };

            if (this.pending !== pending) return pending.key;

            pending.createdAt = receipt.createdAt;
            pending.storageKey = storageKey;
            storage.setItem(storageKey, JSON.stringify(receipt));
            pending.recoverable = true;
        } catch {
            // Storage/digest failure must not fail a report. Same-mount retries still use the in-memory key.
        }

        return pending.key;
    }

    private clear(storageKey: string, expectedKey?: string) {
        if (expectedKey) this.retiredKeys.add(expectedKey);

        try {
            const storage = this.options.storage();
            const raw = storage.getItem(storageKey);

            if (!raw) return;

            const receipt: TReceipt = JSON.parse(raw);

            if (expectedKey && receipt.key !== expectedKey) return;

            this.retiredKeys.add(receipt.key);

            try {
                storage.removeItem(storageKey);
            } catch {
                // A terminal marker also prevents recovery when removal alone is unavailable.
                storage.setItem(storageKey, JSON.stringify({...receipt, ended: true}));
            }
        } catch {
            // Cleanup cannot turn a successful submission or cancellation into a failure.
        }
    }

    noteChanged(note: string) {
        if (this.pending && this.pending.note !== note.trim()) {
            if (this.pending.storageKey) this.clear(this.pending.storageKey, this.pending.key);

            this.reset();
        }
    }

    async cancel(scope: string | undefined) {
        try {
            const storageKey = this.pending?.scope === scope ? this.pending?.storageKey : undefined;

            if (storageKey) this.clear(storageKey, this.pending?.key);
            else if (scope) this.clear(REPORT_SESSION_PREFIX + (await this.options.hash(scope)));
        } catch {
            // A missing digest/storage capability must not prevent closing the form.
        }

        this.reset();
    }

    complete() {
        if (this.pending?.storageKey) this.clear(this.pending.storageKey, this.pending.key);

        this.reset();
    }

    /** Forget the current component only; remounting or switching views is not a cancellation. */
    reset() {
        this.pending = undefined;
    }
}
