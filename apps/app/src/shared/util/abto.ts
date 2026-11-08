import {initAbto} from '@abto-app/event';
import {abtoEvents} from './abto.events';
import {isNonProductionAppDomain} from '@/shared/config/feature-flags';

let client: ReturnType<typeof initAbto> | undefined;

/** Development-only identity core. Initialization does not capture events. */
export function initializeAbto() {
    if (client) return client;

    const key = import.meta.env.VITE_ABTO_EVENT_KEY?.trim();

    if (import.meta.env.VITE_ABTO_ENABLED !== 'true' || !isNonProductionAppDomain() || !key?.startsWith('ek-abto-')) return;

    try {
        client = initAbto({
            projectKey: key,
            apiHost: 'https://api.abto.app',
            environment: 'development',
            capture: {prompt: 'off', response: 'off', mask: 'all'},
            events: abtoEvents,
        });
    } catch {
        // Optional analytics cannot prevent scheduling from starting.
        return;
    }

    return client;
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        client?.shutdown();
        client = undefined;
    });
}

/** Only controlled scalar metadata is accepted; optional telemetry never throws. */
export function captureScheduleEvent(
    name: Extract<keyof typeof abtoEvents, `schedule_${string}`>,
    operation: 'GENERATE' | 'ADJUST' | 'INTERPRET' | 'UNKNOWN',
    outcome?: 'COMPLETED' | 'BLOCKED' | 'FAILED' | 'CANCELLED' | 'UNKNOWN',
    milliseconds?: number,
) {
    try {
        initializeAbto()?.capture(name, {
            value: milliseconds === undefined ? 1 : Math.max(0, Math.round(milliseconds)),
            scale: milliseconds === undefined ? 'count' : 'ms',
            operation,
            ...(outcome ? {outcome} : {}),
        });
    } catch {
        // Analytics must not alter request results or editor behavior.
    }
}

export function captureRosterImportEvent(
    name: Extract<keyof typeof abtoEvents, `roster_import_${string}`>,
    format: 'PHOTO' | 'EXCEL',
) {
    try {
        initializeAbto()?.capture(name, {value: 1, scale: 'count', format});
    } catch {
        // Optional analytics must not affect file import.
    }
}
