import type {TScheduleObservation} from '@dutying/api/ward';
import useAuthStore from '@/features/auth/model/store';
import client from '@/shared/api/client';

const flowIds = new Map<string, string>();

/** A flow groups related attempts; it must never replace a request's idempotency key. */
export function scheduleJourneyId(wardId: number, teamId: number, year: number, month: number): string {
    const key = `dutying.schedule-journey:${useAuthStore.getState().accountId}:${wardId}:${teamId}:${year}:${month}`;
    const known = flowIds.get(key);

    if (known) return known;

    let id: string | null = null;

    try {
        id = sessionStorage.getItem(key);
    } catch {
        /* Storage may be unavailable. */
    }

    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) id = crypto.randomUUID();

    flowIds.set(key, id);
    try {
        sessionStorage.setItem(key, id);
    } catch {
        /* In-memory correlation still works. */
    }

    return id;
}

type TClientEvent = {
    type: 'CLIENT_DISPLAYED' | 'CLIENT_APPLIED' | 'CLIENT_UNDONE';
    displayedText?: string;
    displayedTextTruncated?: boolean;
    language?: string;
    changedCellCount?: number;
    draftRevision?: number;
};
const applied = new Map<string, TScheduleObservation>();
export const lastAppliedScheduleObservation = (ward: number, team: number, year: number, month: number) =>
    applied.get(`${useAuthStore.getState().accountId}:${ward}:${team}:${year}:${month}`);

const deliveries = new Map<string, Promise<void>>();

/** Best effort; absence of this receipt means UNKNOWN, never "not displayed/applied". */
export function reportScheduleJourney(observation: TScheduleObservation | undefined, event: TClientEvent): Promise<void> {
    if (!observation) return Promise.resolve();
    const scope = `${useAuthStore.getState().accountId}:${observation.wardId}:${observation.shiftTeamId}:${observation.year}:${observation.month}`;
    if (event.type === 'CLIENT_APPLIED') applied.set(scope, observation);
    if (event.type === 'CLIENT_UNDONE') applied.delete(scope);

    const key = JSON.stringify([observation.serverEventId, event]);
    const previous = deliveries.get(key);

    if (previous) return previous;

    const payload = {...event, eventId: crypto.randomUUID(), serverEventId: observation.serverEventId};
    const deliver = async () => {
        // Reuse the event ID if a successful write lost its HTTP acknowledgement.
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const response = await client.post(
                    `/wards/${observation.wardId}/shift-teams/${observation.shiftTeamId}/schedule/journey-events`,
                    payload,
                    {
                        suppressErrorToast: true,
                        // Background receipts must not trigger login redirects or scope-change UI effects.
                        validateStatus: () => true,
                        timeout: 5000,
                    },
                );
                if (response.status < 500) return;
            } catch {
                /* A telemetry failure must never block editing or trigger a UI error. */
            }
        }
        deliveries.delete(key);
    };
    const pending = deliver();

    deliveries.set(key, pending);
    if (deliveries.size > 500) deliveries.delete(deliveries.keys().next().value!);

    return pending;
}
