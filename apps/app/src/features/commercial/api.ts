import {useQuery} from '@tanstack/react-query';
import useAuthStore from '@/features/auth/model/store';
import {isWardAdminAccessToken} from '@/features/auth/model/admin-token';
import {adminAxiosInstance} from '@/shared/api/client';

export type ScopeType = 'WARD' | 'HOSPITAL';
export type Scope = {type: ScopeType; ref: string; scopeId: string; name: string; role: 'OWNER' | 'EDITOR' | 'MANAGER'; status?: string};
export type Invitation = {
    type: ScopeType;
    name: string;
    invitation: {
        id: string | number;
        organizationId?: string;
        wardId?: number;
        email?: string;
        role?: string;
        status: string;
        expiresAt: string;
        version?: number;
    };
};
export type Transfer = {
    id: string;
    scopeType: ScopeType;
    scopeRef: string;
    fromAccountId: number;
    toAccountId: number;
    version: number;
    expiresAt: string;
    status: string;
};
export type AccessContext = {enabled: boolean; scopes: Scope[]; invitations?: Invitation[]; transfers?: Transfer[]};
export type UsageLot = {
    id: string;
    source: string;
    meter: string;
    granted: number;
    consumed: number;
    reserved: number;
    available: number;
    expiresAt: string | null;
};
export type Usage = {
    meter: 'FULL_GENERATE' | 'PARTIAL_ADJUST';
    granted: number;
    used: number;
    reserved: number;
    remaining: number;
    lots: UsageLot[];
};
export type BillingScope = {
    id: string;
    scopeType: ScopeType;
    scopeRef: string;
    version: number;
    periodStart?: string;
    periodEnd?: string;
    cancelAtPeriodEnd: boolean;
    nextCapacity?: number;
    customerId: string;
};
export type Policy = {
    features: Record<string, boolean>;
    plan: string;
    baseGross: number;
    includedStaff: number;
    extraStaffGross: number;
    generate: number;
    adjust: number;
    adminSeats: number;
    generatePackSize: number;
    generatePackGross: number;
    adjustPackSize: number;
    adjustPackGross: number;
    validityDays: number;
    setupBase: number;
    setupExtra: number;
};
export type Entitlement = {
    billingHold?: boolean;
    scope: BillingScope;
    billingScopeId: string;
    role: string;
    plan: string;
    entitlementSource: string;
    capacity: {used: number; purchased: number; overLimit: boolean};
    adminSeats: {active: number; reserved: number; limit: number};
    usage: Usage[];
    allowedActions: string[];
    promotion: {endsAt: string} | null;
    policy: Policy;
    canManageBilling: boolean;
    checkoutEnabled: boolean;
};
export type QuoteRequest = {
    purpose: 'SUBSCRIPTION' | 'CAPACITY' | 'USAGE_PACK' | 'SETUP';
    plan: 'PLUS' | 'HOSPITAL';
    capacity: number;
    setupStaff: number;
    fullPacks: number;
    partialPacks: number;
};
export type Estimate = {
    policyId: string;
    priceVersion: string;
    estimate: {
        monthlyGross: number;
        generate: number;
        adjust: number;
        setupGross: number;
        addonGross: number;
        firstMonthGross: number;
        supportSeconds: number;
    };
};
export type QuoteTerms = {
    termsVersion: string;
    request: QuoteRequest;
    totalAmount: number;
    supplyAmount: number;
    taxAmount: number;
    periodStart: string;
    periodEnd: string;
    fullUnits: number;
    partialUnits: number;
    recurring: Estimate['estimate'];
};
export type Quote = {
    id: string;
    scopeId: string;
    purpose: string;
    contentHash: string;
    expiresAt: string;
    snapshot: string;
    status: string;
};
export type Order = {
    provider?: string;
    id: string;
    scopeId: string;
    status: string;
    gross: number;
    currency: string;
    checkoutUrl?: string;
    verifiedAt?: string;
    appliedAt?: string;
    failureCode?: string;
    invoiceId: string;
};
export type Invoice = {
    id: string;
    kind: string;
    status: string;
    gross: number;
    vat: number;
    allocated: number;
    refundedGross: number;
    dueAt: string;
    periodStart: string;
    periodEnd: string;
};
export type Billing = {
    scope: BillingScope;
    customer: {name: string; plan: string; paymentMode: string; capacity: number};
    invoices: Invoice[];
    orders: Order[];
    requests: {id: string; kind: string; status: string; createdAt: string; resolution?: string}[];
};
export type Member = {
    id?: string;
    membershipId?: number;
    wardAdminMembershipId?: number;
    accountId?: number;
    adminAccountId?: number;
    wardAdminAccountId?: number;
    name: string;
    email?: string;
    role: string;
    version?: number;
};
export type Members = {
    members: Member[];
    invitations: {
        id?: string;
        invitationId?: number;
        email?: string;
        invitedEmail?: string;
        invitedEmailNormalized?: string;
        expiresAt: string;
        version?: number;
        status: string;
    }[];
    reservedEmails?: {emailRegistrationId: number; email: string; status: string}[];
    limit?: number;
};
export type WardLink = {
    id: string;
    wardId: number;
    organizationId?: string;
    status: string;
    version: number;
    name?: string;
    staff?: number;
    sharedWardName?: string;
    sharedStaff?: number;
    sharedAt?: string;
    contractHash?: string;
    wardConsent?: boolean;
    organizationConsent?: boolean;
    canOpenWard?: boolean;
    contactName?: string;
    currentMonth?: string;
    scheduleStatus?: string;
    updatedAt?: string;
};
export type Organization = {
    overviewEnabled?: boolean;
    organization: {
        id: string;
        name: string;
        status: string;
        adoptionStage: string;
        requestedCapacity: number;
        setupStaff: number;
        inquiry?: string;
        quoteSnapshot?: string;
        contractHash?: string;
        setupAcceptedAt?: string;
        contractAcceptedAt?: string;
    };
    role: string;
    contractEstimate?: Estimate['estimate'];
    wards: WardLink[];
    entitlement: Entitlement;
};
const ROOT = '/admin/commercial';
export const commercialGet = async <T>(path: string) => (await adminAxiosInstance.get<T>(ROOT + path, {suppressErrorToast: true})).data;
export const commercialPost = async <T>(path: string, data: unknown = {}, key: string = crypto.randomUUID()) =>
    (await adminAxiosInstance.post<T>(ROOT + path, data, {headers: {'Idempotency-Key': key}, suppressErrorToast: true})).data;
export const legacyGet = async <T>(path: string) => (await adminAxiosInstance.get<T>(path, {suppressErrorToast: true})).data;
export const legacyPost = async <T>(path: string, data: unknown) => (await adminAxiosInstance.post<T>(path, data)).data;
export const commercialDelete = async (path: string) => {
    await adminAxiosInstance.delete(ROOT + path, {suppressErrorToast: true});
};
export const legacyDelete = async (path: string) => {
    await adminAxiosInstance.delete(path);
};
export const commercialQueryKey = (accountId: number | null, ...parts: unknown[]) => ['commercial', accountId, ...parts];
export function useCommercialContext() {
    const accountId = useAuthStore((s) => s.accountId);
    const token = useAuthStore((s) => s.accessToken);
    return useQuery({
        queryKey: commercialQueryKey(accountId, 'context'),
        queryFn: () => commercialGet<AccessContext>('/access-context'),
        enabled: !!token && isWardAdminAccessToken(token),
        retry: false,
        staleTime: 10_000,
        refetchOnWindowFocus: 'always',
    });
}
export function useWardEntitlement() {
    const wardId = useAuthStore((s) => s.wardId);
    const accountId = useAuthStore((s) => s.accountId);
    const context = useCommercialContext();
    return useQuery({
        queryKey: commercialQueryKey(accountId, 'WARD', wardId, 'entitlements'),
        queryFn: () => commercialGet<Entitlement>(`/scopes/WARD/${wardId}/entitlements`),
        enabled: !!wardId && !!context.data?.enabled,
        staleTime: 5_000,
        refetchOnWindowFocus: 'always',
        retry: false,
    });
}
export const scopePath = (scope: Pick<Scope, 'type' | 'ref'>, tab = 'usage') => `/workspace/${scope.type}/${scope.ref}/${tab}`;
export function commercialError(error: unknown) {
    return error instanceof Error ? error.message : '요청을 처리하지 못했습니다. 다시 확인해 주세요.';
}
