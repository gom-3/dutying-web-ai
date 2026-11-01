import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {isNonProductionAppDomain} from '@/shared/config/feature-flags';

vi.mock('@/shared/config/feature-flags', () => ({isNonProductionAppDomain: vi.fn(() => true)}));

let client: {shutdown: () => void} | undefined;

beforeEach(() => {
    vi.resetModules();
    vi.mocked(isNonProductionAppDomain).mockReturnValue(true);
    vi.stubEnv('VITE_ABTO_ENABLED', 'true');
    vi.stubEnv('VITE_ABTO_EVENT_KEY', 'ek-abto-local-unit-test');
    localStorage.clear();
});

afterEach(() => {
    client?.shutdown();
    client = undefined;
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

it('initializes the public SDK once with an empty event outbox', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const {initializeAbto} = await import('../abto');
    const initialized = initializeAbto();
    client = initialized;

    expect(initialized?.getIdentity().deviceId).toBeTruthy();
    expect(initializeAbto()).toBe(initialized);
    await initialized?.flush();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(Object.keys(localStorage).filter((key) => key.startsWith('abto:outbox:'))).toEqual([]);
});

it.each(['disabled', 'production-host', 'calling-key'])('does not initialize for %s', async (reason) => {
    if (reason === 'disabled') vi.stubEnv('VITE_ABTO_ENABLED', 'false');
    if (reason === 'production-host') vi.mocked(isNonProductionAppDomain).mockReturnValue(false);
    if (reason === 'calling-key') vi.stubEnv('VITE_ABTO_EVENT_KEY', 'ck-abto-must-not-reach-browser');

    const {initializeAbto} = await import('../abto');

    expect(initializeAbto()).toBeUndefined();
    expect(Object.keys(localStorage).filter((key) => key.startsWith('abto:'))).toEqual([]);
});

it('serializes selected events with scalar metadata and no product identifiers or text', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}', {status: 202}));
    vi.stubGlobal('fetch', fetchSpy);
    const {initializeAbto, captureScheduleEvent} = await import('../abto');
    const initialized = initializeAbto();
    client = initialized;
    captureScheduleEvent('schedule_request_roundtrip', 'ADJUST', undefined, 123.4);
    await initialized?.flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, request] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.abto.app/v1/collect/events');
    const event = JSON.parse(String(request.body)).batch[0];
    expect(event.event_name).toBe('schedule_request_roundtrip');
    expect(event.value).toBe(123);
    expect(event.scale).toBe('ms');
    expect(Object.keys(event.extra_json).filter((key) => !key.startsWith('$'))).toEqual(['operation']);
    expect(event.extra_json.operation).toBe('ADJUST');
    expect(event.extra_json.$environment).toBe('development');
    for (const field of ['$user_id', '$tenant_id', '$request_id', '$conversation_id', '$message_id'])
        expect(event.extra_json).not.toHaveProperty(field);
});
