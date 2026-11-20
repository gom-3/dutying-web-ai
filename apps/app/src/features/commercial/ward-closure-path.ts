import type {TApiClientError} from '@/shared/api/error';

export const WARD_CLOSURE_HASH = '#ward-closure';

export function getWardClosurePath(error: unknown, wardId: number | string) {
    if (!(error instanceof Error)) return;

    const {code, serverCode} = error as Partial<TApiClientError>;

    if (code === 409 && serverCode === 'OWNER_TRANSFER_REQUIRED') {
        return `/workspace/WARD/${wardId}/support${WARD_CLOSURE_HASH}`;
    }
}
