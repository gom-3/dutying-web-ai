import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {DEFAULT_REST_LEAVE_POLICY, restLeavePolicyQueryKey, type TRestLeavePolicyResponse} from '../../model/rest-leave-policy';
import {RestLeavePolicySection} from '../rest-leave-policy-section';

const {get, put, success} = vi.hoisted(() => ({get: vi.fn(), put: vi.fn(), success: vi.fn()}));

vi.mock('@/shared/api/client', () => ({default: {get, put}}));
vi.mock('react-hot-toast', () => ({default: {success}}));
vi.mock('@/shared/hook/use-typed-translation', () => ({useTypedTranslation: () => ({t: (key: string) => key})}));
vi.mock('@/i18n', () => ({default: {resolvedLanguage: 'en', language: 'en'}}));

const key = (suffix: string) => `page.wardSettings.restLeavePolicy.${suffix}`;

let shared: TRestLeavePolicyResponse;

const clients: QueryClient[] = [];

function mount(wardId = 1) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});

    clients.push(client);

    const view = render(
        <QueryClientProvider client={client}>
            <RestLeavePolicySection wardId={wardId} shiftTypes={[]} />
        </QueryClientProvider>,
    );

    return {client, ...view};
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    shared = {
        ...DEFAULT_REST_LEAVE_POLICY,
        enabled: true,
        holidayCountry: 'GB',
        holidayRegion: 'ENG',
        wardId: 1,
        persisted: true,
        version: 1,
    };
    get.mockImplementation(async () => ({data: {...shared}}));
    put.mockImplementation(async (_url: string, body: TRestLeavePolicyResponse) => {
        shared = {...body, wardId: 1, persisted: true, version: body.version + 1};

        return {data: shared};
    });
});
afterEach(() => {
    cleanup();
    clients.splice(0).forEach((client) => client.clear());
});

describe('shared rest leave policy editor', () => {
    it('resets region on country change and another device reads the saved policy', async () => {
        const first = mount();
        const country = await screen.findByLabelText(key('holiday.country'));

        expect(country).toHaveValue('GB');
        expect(screen.getByLabelText(key('holiday.region'))).toHaveValue('ENG');
        fireEvent.change(country, {target: {value: 'DE'}});
        expect(screen.getByLabelText(key('holiday.region'))).toHaveValue('');
        fireEvent.change(screen.getByLabelText(key('holiday.region')), {target: {value: 'BE'}});
        fireEvent.click(screen.getByRole('button', {name: key('save')}));
        await waitFor(() => expect(success).toHaveBeenCalledTimes(1));
        expect(put).toHaveBeenCalledWith(
            '/wards/1/rest-leave-policy',
            expect.objectContaining({holidayCountry: 'DE', holidayRegion: 'BE', version: 1}),
            expect.anything(),
        );
        first.unmount();
        mount();
        expect(await screen.findByLabelText(key('holiday.country'))).toHaveValue('DE');
        expect(screen.getByLabelText(key('holiday.region'))).toHaveValue('BE');
    });
    it('does not report success before the server acknowledges the save', async () => {
        let resolve!: (value: {data: TRestLeavePolicyResponse}) => void;

        put.mockImplementation(
            () =>
                new Promise((r) => {
                    resolve = r;
                }),
        );
        mount();
        fireEvent.change(await screen.findByLabelText(key('holiday.country')), {target: {value: 'IE'}});
        fireEvent.click(screen.getByRole('button', {name: key('save')}));
        await screen.findByRole('button', {name: key('sync.saving')});
        expect(success).not.toHaveBeenCalled();
        expect(screen.getByLabelText(key('holiday.country'))).toBeDisabled();
        await act(async () => resolve({data: {...shared, holidayCountry: 'IE', holidayRegion: null, version: 2}}));
        await waitFor(() => expect(success).toHaveBeenCalledTimes(1));
    });
    it('preserves dirty edits during refetch and rejects stale versions without overwriting them', async () => {
        const {client} = mount();

        fireEvent.change(await screen.findByLabelText(key('holiday.country')), {target: {value: 'IE'}});
        shared = {...shared, holidayRegion: 'SCT', version: 2};
        await act(async () => {
            await client.refetchQueries({queryKey: restLeavePolicyQueryKey(1)});
        });
        expect(screen.getByLabelText(key('holiday.country'))).toHaveValue('IE');
        put.mockRejectedValue({code: 409});
        fireEvent.click(screen.getByRole('button', {name: key('save')}));
        expect(await screen.findByRole('alert')).toHaveTextContent(key('sync.conflict'));
        expect(put.mock.calls[0][1].version).toBe(1);
        expect(success).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: key('sync.reload')}));
        await waitFor(() => expect(screen.getByLabelText(key('holiday.region'))).toHaveValue('SCT'));
    });
    it('keeps edits and exposes a save failure instead of falling back to local storage', async () => {
        put.mockRejectedValue({code: 500});
        mount();
        fireEvent.change(await screen.findByLabelText(key('holiday.country')), {target: {value: 'IE'}});
        fireEvent.click(screen.getByRole('button', {name: key('save')}));
        expect(await screen.findByRole('alert')).toHaveTextContent(key('sync.saveFailed'));
        expect(screen.getByLabelText(key('holiday.country'))).toHaveValue('IE');
        expect(localStorage.getItem('dutying:ward:1:rest-leave-policy')).toBeNull();
        expect(success).not.toHaveBeenCalled();
    });
    it('shows loading failure and never auto-imports old browser settings', async () => {
        localStorage.setItem('dutying:ward:1:rest-leave-policy', JSON.stringify({...DEFAULT_REST_LEAVE_POLICY, holidayCountry: 'US'}));
        get.mockRejectedValue({code: 500});
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent(key('sync.loadFailed'));
        expect(put).not.toHaveBeenCalled();
    });
    it('requires a UK region and explicitly imports legacy settings only for an unconfigured ward', async () => {
        shared = {...shared, persisted: false, version: 0, enabled: false, holidayCountry: null, holidayRegion: null};
        localStorage.setItem('dutying:ward:1:rest-leave-policy', JSON.stringify(DEFAULT_REST_LEAVE_POLICY));
        mount();
        fireEvent.click(await screen.findByRole('button', {name: key('sync.importLegacy')}));
        fireEvent.change(screen.getByLabelText(key('holiday.country')), {target: {value: 'GB'}});
        expect(screen.getByRole('button', {name: key('save')})).toBeDisabled();
        fireEvent.change(screen.getByLabelText(key('holiday.region')), {target: {value: 'SCT'}});
        expect(screen.getByRole('button', {name: key('save')})).toBeEnabled();
        expect(put).not.toHaveBeenCalled();
    });
});
