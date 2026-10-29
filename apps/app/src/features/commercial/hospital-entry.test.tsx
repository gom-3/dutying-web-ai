import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, useLocation} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as CommercialApi from './api';
import type {AccessContext, Scope} from './api';
import {activeHospitalScopes, HospitalChooser, HospitalEntry} from './hospital-entry';

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    refresh: vi.fn(),
    refetch: vi.fn(),
    context: {enabled: true, scopes: []} as AccessContext,
}));

vi.mock('./api', async (original) => ({
    ...(await original<typeof CommercialApi>()),
    commercialPost: mocks.post,
    useCommercialContext: () => ({data: mocks.context, refetch: mocks.refetch}),
}));
vi.mock('@/features/auth', () => ({default: () => ({actions: {handleGetAccountMe: mocks.refresh}})}));
vi.mock('@/features/auth/model/store', () => ({default: (selector: (state: object) => unknown) => selector({accountId: 7})}));

const hospital = (ref = 'h1'): Scope => ({
    type: 'HOSPITAL',
    ref,
    scopeId: `scope-${ref}`,
    name: `${ref} 병원`,
    role: 'MANAGER',
    status: 'ACTIVE',
});

function Location() {
    return <output aria-label="current route">{useLocation().pathname}</output>;
}

function mount(content: React.ReactNode) {
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}});

    render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/register']}>
                {content}
                <Location />
            </MemoryRouter>
        </QueryClientProvider>,
    );

    return client;
}

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    mocks.context = {enabled: true, scopes: []};
    mocks.post.mockResolvedValue({});
    mocks.refresh.mockResolvedValue(undefined);
    mocks.refetch.mockResolvedValue({});
});

describe('hospital entry', () => {
    it('hides the hospital action for ward-only accounts', () => {
        mocks.context.scopes = [{...hospital('w1'), type: 'WARD'}];
        mount(<HospitalEntry card />);
        expect(screen.queryByRole('button', {name: '병원으로 들어가기'})).not.toBeInTheDocument();
        expect(activeHospitalScopes(mocks.context.scopes)).toEqual([]);
    });
    it('opens an assigned DRAFT hospital before paid activation and selects it before navigating', async () => {
        mocks.context.scopes = [{...hospital(), status: 'DRAFT'}];

        const client = mount(<HospitalEntry card />);

        client.setQueryData(['commercial', 7, 'plans'], {cached: true});
        client.setQueryData(['ward', 12], {oldWard: true});
        await userEvent.click(screen.getByRole('button', {name: '병원으로 들어가기'}));
        await waitFor(() => expect(screen.getByLabelText('current route')).toHaveTextContent('/workspace/HOSPITAL/h1/overview'));
        expect(mocks.post).toHaveBeenCalledWith('/scopes/HOSPITAL/h1/select');
        expect(mocks.refresh).toHaveBeenCalledTimes(1);
        expect(client.getQueryData(['commercial', 7, 'plans'])).toEqual({cached: true});
        expect(client.getQueryData(['ward', 12])).toBeUndefined();
    });
    it('opens the chooser for multiple hospitals without selecting one prematurely', async () => {
        mocks.context.scopes = [hospital(), hospital('h2')];
        mount(<HospitalEntry />);
        await userEvent.click(screen.getByRole('button', {name: '병원으로 들어가기'}));
        expect(screen.getByLabelText('current route')).toHaveTextContent('/workspace/hospitals');
        expect(mocks.post).not.toHaveBeenCalled();
    });
    it('offers a clear no-access state without creating a hospital', () => {
        mount(<HospitalChooser />);
        expect(screen.getByRole('heading', {name: '연결된 병원이 없습니다'})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: '받은 초대 확인'})).toHaveAttribute('href', '/workspace/invitations');
        expect(mocks.post).not.toHaveBeenCalled();
    });
    it('keeps the selection visible and refreshes access after a failed selection', async () => {
        mocks.context.scopes = [hospital()];
        mocks.post.mockRejectedValue(new Error('병원 관리 권한을 확인해 주세요.'));
        mount(<HospitalEntry />);
        await userEvent.click(screen.getByRole('button', {name: '병원으로 들어가기'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('병원 관리 권한을 확인해 주세요.');
        expect(mocks.refetch).toHaveBeenCalledTimes(1);
        expect(screen.getByLabelText('current route')).toHaveTextContent('/register');
    });
});
