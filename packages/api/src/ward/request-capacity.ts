import type {IApiClient} from '../client';

export type TReqShiftCapacityRule = {wardShiftTypeId: number; groupId: number | null; maxPerDay: number};
export type TReqShiftCapacityGroup = {groupId: number; divisionNum: number; name: string};
export type TReqShiftCapacityUsage = {date: string; wardShiftTypeId: number; groupId: number | null; requestedCount: number};
export type TReqShiftCapacitySettings = {
    shiftTeamId: number;
    enabled: boolean;
    revision: number;
    rules: TReqShiftCapacityRule[];
    groups: TReqShiftCapacityGroup[];
    usage: TReqShiftCapacityUsage[];
    overflows: (TReqShiftCapacityUsage & {maxPerDay: number})[];
};
export type TUpdateReqShiftCapacitySettings = Pick<TReqShiftCapacitySettings, 'enabled' | 'revision' | 'rules'>;
export type TReqShiftCapacityDay = {
    date: string;
    wardShiftTypeId: number;
    shiftTypeName: string;
    teamCount: number;
    teamLimit: number | null;
    groupCount: number;
    groupLimit: number | null;
    hasOwnRequest: boolean;
    ownAccepted: boolean | null;
    ownAcceptedRequestId: number | null;
    ownPendingRequestId: number | null;
    canSubmit: boolean;
    blockedBy: 'TEAM' | 'GROUP' | 'RECEPTION_CLOSED' | null;
};
export type TReqShiftCapacityStatus = {
    year: number;
    month: number;
    shiftTeamId: number;
    groupId: number | null;
    groupName: string | null;
    enabled: boolean;
    days: TReqShiftCapacityDay[];
};

export interface IReqShiftCapacityApi {
    getReqShiftCapacitySettings: (wardId: number, shiftTeamId: number) => Promise<TReqShiftCapacitySettings>;
    updateReqShiftCapacitySettings: (
        wardId: number,
        shiftTeamId: number,
        settings: TUpdateReqShiftCapacitySettings,
    ) => Promise<TReqShiftCapacitySettings>;
    getReqShiftCapacityStatus: (wardId: number, year: number, month: number) => Promise<TReqShiftCapacityStatus>;
}

export const createReqShiftCapacityApi = (client: IApiClient, basePath: string): IReqShiftCapacityApi => ({
    getReqShiftCapacitySettings: async (wardId, shiftTeamId) =>
        (await client.get<TReqShiftCapacitySettings>(`${basePath}/${wardId}/shift-teams/${shiftTeamId}/req-shifts/capacity-settings`)).data,
    updateReqShiftCapacitySettings: async (wardId, shiftTeamId, settings) =>
        (
            await client.put<TReqShiftCapacitySettings>(
                `${basePath}/${wardId}/shift-teams/${shiftTeamId}/req-shifts/capacity-settings`,
                settings,
            )
        ).data,
    getReqShiftCapacityStatus: async (wardId, year, month) =>
        (await client.get<TReqShiftCapacityStatus>(`${basePath}/${wardId}/req-shifts/capacity-status?year=${year}&month=${month}`)).data,
});
