import {useQuery} from '@tanstack/react-query';
import {isWardAdminAccessToken} from '@/features/auth/model/admin-token';
import useAuthStore from '@/features/auth/model/store';
import {commercialGet, commercialQueryKey, useCommercialContext, type AccessContext, type Scope, type WardLink} from './api';

type TWardRoleSource = {
    wardId?: string | number | null;
    role?: string | null;
    memberships?: {wardId?: string | number | null; role?: string | null; status?: string | null}[];
};

export type THospitalWardLink = WardLink & {
    hospitalName?: string;
    // Older servers return the entity field instead of the additive consent projection.
    wardConsentedBy?: number | null;
};

export function isOperationalWardLink(link: WardLink): boolean {
    return link.operationallyConnected ?? ['ACTIVE', 'DETACH_PENDING', 'MANAGED', 'MANAGED_DETACH_PENDING'].includes(link.status);
}

/** This fallback grants access only to the ward-link UI, never billing or ward editing. */
export function getOwnedWardLinkScope(
    context: AccessContext | undefined,
    accountMe: unknown,
    wardId: string | number | null | undefined,
): Scope | undefined {
    if (!context?.enabled || wardId == null || String(wardId).trim() === '') return undefined;

    const ref = String(wardId);
    const scope = context.scopes.find((candidate) => candidate.type === 'WARD' && String(candidate.ref) === ref);
    const account = accountMe && typeof accountMe === 'object' ? (accountMe as TWardRoleSource) : undefined;

    let owner = false;

    if (Array.isArray(account?.memberships)) {
        // Memberships are authoritative; an OWNER role from another ward must never leak here.
        owner = account.memberships.some(
            (membership) => String(membership.wardId) === ref && membership.status === 'ACTIVE' && membership.role === 'OWNER',
        );
    } else if (account?.wardId != null && String(account.wardId) === ref && account.role != null) {
        owner = account.role === 'OWNER';
    } else {
        owner = scope?.role === 'OWNER';
    }

    if (!owner) return undefined;

    if (scope?.role === 'OWNER') return scope;

    // Commercial policy readiness may omit ward scopes. The authenticated account still
    // exposes ward membership, so connection requests can be reviewed independently.
    return {type: 'WARD', ref, scopeId: `ward-link-${ref}`, name: '', role: 'OWNER', status: 'ACTIVE'};
}

export function wardLinkNeedsReview(link: THospitalWardLink) {
    if (link.status === 'REQUESTED') return true;

    return (link.status === 'QUOTED' || link.status === 'CONSENTED') && link.wardConsent !== true && link.wardConsentedBy == null;
}

export function useWardHospitalLinks(wardRef?: number | string | null) {
    const currentWardId = useAuthStore((state) => state.wardId);
    const accountId = useAuthStore((state) => state.accountId);
    const token = useAuthStore((state) => state.accessToken);
    const accountMe = useAuthStore((state) => state.accountMe);
    const context = useCommercialContext();
    const wardId = wardRef === undefined ? currentWardId : wardRef;
    const ownerScope = getOwnedWardLinkScope(context.data, accountMe, wardId);
    const canReview = Boolean(ownerScope && accountId != null && isWardAdminAccessToken(token));
    const query = useQuery({
        queryKey: commercialQueryKey(accountId, 'WARD', wardId == null ? null : String(wardId), 'links'),
        queryFn: () => commercialGet<THospitalWardLink[]>(`/wards/${ownerScope!.ref}/links`),
        enabled: canReview,
        staleTime: 10_000,
        refetchOnWindowFocus: 'always',
        retry: false,
    });

    // Disabled queries retain cached data; avoid showing a previous owner's requests.
    return {...query, data: canReview ? query.data : undefined, ownerScope, canReview};
}
