import type {IApiClient} from '../client';

export type TAnnualLeaveBasis = 'PAST_ONLY' | 'FUTURE_INCLUDED' | 'UNKNOWN' | 'TODAY_INCLUDED';
export type TAnnualLeaveUnitRule = {shiftTypeId: number; days: number; effectiveFrom: string | null};
export type TAnnualLeaveSettings = {
    available: boolean;
    enabled: boolean;
    version: number;
    startedOn: string | null;
    stoppedOn: string | null;
    reviewOn: string | null;
    unitRules: TAnnualLeaveUnitRule[];
};
export type TAnnualLeavePerson = {
    nurseId: number;
    name: string;
    shiftTeamId: number | null;
    active: boolean;
    version: number;
    startedOn: string;
    openingDays: number | null;
    balanceBasis: TAnnualLeaveBasis;
    reviewOn: string | null;
    reconciledOn: string | null;
    previousUsedDays?: number | null;
    usedDays: number;
    plannedDays: number;
    currentDays: number | null;
    /** Preview: balance through the requested month end. Read: balance after all planned leave. */
    remainingDays: number | null;
    monthDays: number;
    checks: string[];
};
export type TAnnualLeaveDay = {
    nurseId: number;
    date: string;
    days: number;
    source: 'SCHEDULE' | 'DAY_USAGE';
    shiftTypeId: number | null;
    referenceShiftTypeId: number | null;
    entryId: number | null;
    needsReview: boolean;
    partialWork: boolean;
};
export type TAnnualLeaveOverview = {
    settings: TAnnualLeaveSettings;
    today: string;
    from: string;
    to: string;
    people: TAnnualLeavePerson[];
    days: TAnnualLeaveDay[];
    preview: boolean;
};
export type TAnnualLeaveInitialization = {
    previousUsedDays?: number | null;
    nurseId: number;
    version: number;
    startedOn: string;
    remainingDays: number | null;
    balanceBasis: TAnnualLeaveBasis;
    includedPlannedDates: string[];
    reviewOn: string | null;
    reason: string;
};
export type TAnnualLeaveCommand = {
    requestId: string;
    version: number;
    kind: 'GRANT' | 'SETTLEMENT' | 'CORRECTION' | 'SET_BALANCE' | 'DAY_USAGE' | 'REVERT';
    effectiveOn: string;
    days: number;
    reason: string;
    entryId?: number;
    referenceShiftTypeId?: number | null;
    expectedShiftTypeId?: number | null;
    reviewOn?: string | null;
};
export type TAnnualLeavePreview = {
    shiftTeamId: number;
    year: number;
    month: number;
    cells: {nurseId: number; date: string; shiftTypeId: number | null}[];
};
export type TAnnualLeaveHistoryItem = {
    id: number;
    kind: string;
    effectiveOn: string;
    days: number;
    voided: boolean;
    reason: string;
    actor: string;
    createdAt: string;
    sourceSnapshotId: number | null;
    shiftTypeId: number | null;
    referenceShiftTypeId: number | null;
    detailsJson: string | null;
};
export type TAnnualLeaveHistory = {entries: TAnnualLeaveHistoryItem[]; nextCursor: number | null};
export interface IAnnualLeaveApi {
    getAnnualLeave: (wardId: number, from: string, to: string) => Promise<TAnnualLeaveOverview>;
    updateAnnualLeaveSettings: (
        wardId: number,
        request: {
            requestId: string;
            version: number;
            enabled: boolean;
            startedOn: string;
            reviewOn: string | null;
            unitRules: TAnnualLeaveUnitRule[];
        },
    ) => Promise<TAnnualLeaveSettings>;
    initializeAnnualLeave: (
        wardId: number,
        request: {requestId: string; entries: TAnnualLeaveInitialization[]; renew?: boolean},
    ) => Promise<void>;
    changeAnnualLeave: (wardId: number, nurseId: number, request: TAnnualLeaveCommand) => Promise<void>;
    getAnnualLeaveHistory: (wardId: number, nurseId: number, before?: number) => Promise<TAnnualLeaveHistory>;
    previewAnnualLeave: (wardId: number, request: TAnnualLeavePreview) => Promise<TAnnualLeaveOverview>;
}

export function createAnnualLeaveApi(client: IApiClient, basePath: string): IAnnualLeaveApi {
    const path = (wardId: number) => `${basePath}/${wardId}/annual-leave`;

    return {
        getAnnualLeave: async (wardId, from, to) =>
            (await client.get<TAnnualLeaveOverview>(`${path(wardId)}?${new URLSearchParams({from, to})}`)).data,
        updateAnnualLeaveSettings: async (wardId, request) =>
            (await client.put<TAnnualLeaveSettings>(`${path(wardId)}/settings`, request)).data,
        initializeAnnualLeave: async (wardId, request) => {
            await client.post(`${path(wardId)}/initializations`, request);
        },
        changeAnnualLeave: async (wardId, nurseId, request) => {
            await client.post(`${path(wardId)}/nurses/${nurseId}/entries`, request);
        },
        getAnnualLeaveHistory: async (wardId, nurseId, before) =>
            (await client.get<TAnnualLeaveHistory>(`${path(wardId)}/nurses/${nurseId}/history${before == null ? '' : `?before=${before}`}`))
                .data,
        previewAnnualLeave: async (wardId, request) => (await client.post<TAnnualLeaveOverview>(`${path(wardId)}/preview`, request)).data,
    };
}
