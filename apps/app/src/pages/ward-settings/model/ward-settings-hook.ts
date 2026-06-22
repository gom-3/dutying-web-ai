import {
    type TCreateShiftTypeDTO,
    type TReqShiftReceptionSettingsResponse,
    type TUpdateReqShiftReceptionSettingsDTO,
} from '@dutying/api/ward';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useEffect, useState} from 'react';
import {useSearchParams} from 'react-router';
import {type TShiftTeam, type TWardShiftType} from '@/entities/ward';
import {wardQueryKeys, wardQueryOptions} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {WardAPI} from '@/shared/api';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {showActionErrorFeedback} from '@/shared/util/feedback';

export type TWardSettingsTab = 'shiftTypes' | 'restLeavePolicy' | 'requestReception' | 'constraints';
type TQueryStatus = 'idle' | 'pending' | 'error' | 'success';
type TRawWardShiftType = Omit<TWardShiftType, 'startTime' | 'endTime'> & {
    startTime?: string | null;
    endTime?: string | null;
};

function normalizeShiftType(shiftType: TRawWardShiftType): TWardShiftType {
    return {
        ...shiftType,
        startTime: shiftType.startTime ?? '',
        endTime: shiftType.endTime ?? '',
    };
}

function normalizeShiftTypes(input: unknown): TWardShiftType[] {
    if (Array.isArray(input)) return (input as TRawWardShiftType[]).map(normalizeShiftType).filter((shiftType) => shiftType.isActive !== false);

    if (input && typeof input === 'object') {
        const maybe = input as {shiftTypes?: unknown; wardShiftTypes?: unknown};

        if (Array.isArray(maybe.shiftTypes))
            return (maybe.shiftTypes as TRawWardShiftType[]).map(normalizeShiftType).filter((shiftType) => shiftType.isActive !== false);

        if (Array.isArray(maybe.wardShiftTypes))
            return (maybe.wardShiftTypes as TRawWardShiftType[]).map(normalizeShiftType).filter((shiftType) => shiftType.isActive !== false);
    }

    return [];
}

export const DEFAULT_REQ_SHIFT_RECEPTION_SETTINGS = {
    enabled: false,
    startDay: 1,
    startTime: '00:00',
    endDay: 15,
    endTime: '23:59',
    notifyOnOpen: true,
    notifyBeforeDeadline: true,
    notifyBeforeDeadlineHours: 24,
} satisfies TReqShiftReceptionSettingsResponse;

async function getReqShiftReceptionSettingsOrDefault(wardId: number): Promise<TReqShiftReceptionSettingsResponse> {
    try {
        return await WardAPI.getReqShiftReceptionSettings(wardId);
    } catch {
        return DEFAULT_REQ_SHIFT_RECEPTION_SETTINGS;
    }
}

function parseWardSettingsTab(raw: string | null): TWardSettingsTab | null {
    if (raw === 'shiftTypes' || raw === 'restLeavePolicy' || raw === 'requestReception' || raw === 'constraints') return raw;

    return null;
}

export function useWardSettings() {
    const {t} = useTypedTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const {
        state: {wardId},
    } = useAuth();
    const queryClient = useQueryClient();
    const [currentTab, setCurrentTab] = useState<TWardSettingsTab>(() => parseWardSettingsTab(searchParams.get('tab')) ?? 'shiftTypes');
    const [currentShiftTeamId, setCurrentShiftTeamId] = useState<number | null>(null);
    const shouldLoadRequestReceptionSettings = wardId !== null && currentTab === 'requestReception';
    const shiftTypesQuery = useQuery({
        ...wardQueryOptions.shiftTypes(wardId ?? -1),
        enabled: wardId !== null,
        staleTime: 1000 * 60 * 5,
    });
    const shiftTeamsQuery = useQuery({
        ...wardQueryOptions.shiftTeams(wardId ?? -1),
        enabled: wardId !== null,
        staleTime: 1000 * 60 * 5,
    });
    const requestReceptionSettingsQuery = useQuery({
        ...wardQueryOptions.requestReceptionSettings(wardId ?? -1),
        queryFn: () => (wardId === null ? DEFAULT_REQ_SHIFT_RECEPTION_SETTINGS : getReqShiftReceptionSettingsOrDefault(wardId)),
        enabled: shouldLoadRequestReceptionSettings,
        retry: false,
        staleTime: 1000 * 60 * 5,
    });

    useEffect(() => {
        const queryTab = parseWardSettingsTab(searchParams.get('tab'));

        if (!queryTab || queryTab === currentTab) return;

        setCurrentTab(queryTab);
    }, [currentTab, searchParams]);

    useEffect(() => {
        if (!shiftTeamsQuery.data) {
            setCurrentShiftTeamId(null);

            return;
        }

        setCurrentShiftTeamId((prevShiftTeamId) => {
            if (prevShiftTeamId !== null && shiftTeamsQuery.data.some((team) => team.shiftTeamId === prevShiftTeamId)) {
                return prevShiftTeamId;
            }

            return shiftTeamsQuery.data[0]?.shiftTeamId ?? null;
        });
    }, [shiftTeamsQuery.data]);

    const invalidateShiftTypeQueries = async () => {
        if (!wardId) return;

        await Promise.all([
            queryClient.invalidateQueries({queryKey: wardQueryKeys.shiftTypes(wardId)}),
            queryClient.invalidateQueries({queryKey: wardQueryKeys.id(wardId)}),
            queryClient.invalidateQueries({queryKey: wardQueryKeys.shift()}),
        ]);
    };
    const addShiftType = async (payload: TCreateShiftTypeDTO) => {
        if (!wardId) return false;

        try {
            await WardAPI.createShiftType(wardId, payload);
            await invalidateShiftTypeQueries();

            return true;
        } catch (error) {
            showActionErrorFeedback(error, t('page.wardSettings.shiftTypes.toast.addFailed'));

            return false;
        }
    };
    const updateShiftType = async (shiftTypeId: number, payload: TCreateShiftTypeDTO) => {
        if (!wardId) return false;

        try {
            await WardAPI.updateShiftType(wardId, shiftTypeId, payload);
            await invalidateShiftTypeQueries();

            return true;
        } catch (error) {
            showActionErrorFeedback(error, t('page.wardSettings.shiftTypes.toast.updateFailed'));

            return false;
        }
    };
    const deleteShiftType = async (shiftTypeId: number) => {
        if (!wardId) return false;

        try {
            const latest = await shiftTypesQuery.refetch();
            const latestShiftTypes = normalizeShiftTypes(latest.data);
            const exists = latestShiftTypes.some((shiftType) => shiftType.wardShiftTypeId === shiftTypeId);

            if (!exists) {
                showActionErrorFeedback(new Error('shift type not found'), t('page.wardSettings.shiftTypes.toast.notFound'));

                return false;
            }

            await WardAPI.deleteShiftType(wardId, shiftTypeId);
            await invalidateShiftTypeQueries();

            return true;
        } catch (error) {
            await shiftTypesQuery.refetch();
            showActionErrorFeedback(error, t('page.wardSettings.shiftTypes.toast.deleteFailed'));

            return false;
        }
    };
    const retryShiftTypes = async () => {
        await shiftTypesQuery.refetch();
    };
    const retryShiftTeams = async () => {
        await shiftTeamsQuery.refetch();
    };
    const retryRequestReceptionSettings = async () => {
        await requestReceptionSettingsQuery.refetch();
    };
    const updateRequestReceptionSettings = async (settings: TUpdateReqShiftReceptionSettingsDTO) => {
        if (!wardId) return false;

        try {
            await WardAPI.updateReqShiftReceptionSettings(wardId, settings);
            await queryClient.invalidateQueries({queryKey: wardQueryKeys.requestReceptionSettings(wardId)});

            return true;
        } catch (error) {
            showActionErrorFeedback(error, t('page.wardSettings.requestReception.toast.updateFailed'));

            return false;
        }
    };
    const selectTab = (tab: TWardSettingsTab) => {
        setCurrentTab(tab);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);

            next.set('tab', tab);

            return next;
        });

        if (tab === 'shiftTypes') {
            void shiftTypesQuery.refetch();
        }
    };
    const shiftTypesStatus: TQueryStatus = shiftTypesQuery.isPending ? 'pending' : shiftTypesQuery.isError ? 'error' : 'success';
    const shiftTeamsStatus: TQueryStatus = shiftTeamsQuery.isPending ? 'pending' : shiftTeamsQuery.isError ? 'error' : 'success';
    const requestReceptionStatus: TQueryStatus =
        requestReceptionSettingsQuery.isFetching && !requestReceptionSettingsQuery.data
            ? 'pending'
            : requestReceptionSettingsQuery.isError
              ? 'error'
              : 'success';

    return {
        state: {
            wardId,
            currentTab,
            shiftTypes: normalizeShiftTypes(shiftTypesQuery.data),
            shiftTypesStatus,
            shiftTeams: shiftTeamsQuery.data ?? [],
            shiftTeamsStatus,
            currentShiftTeamId,
            requestReceptionSettings: requestReceptionSettingsQuery.data ?? DEFAULT_REQ_SHIFT_RECEPTION_SETTINGS,
            requestReceptionStatus,
        },
        actions: {
            selectTab,
            selectShiftTeam: setCurrentShiftTeamId,
            addShiftType,
            updateShiftType,
            deleteShiftType,
            retryShiftTypes,
            retryShiftTeams,
            retryRequestReceptionSettings,
            updateRequestReceptionSettings,
        },
    };
}

export type TWardSettingsState = ReturnType<typeof useWardSettings>['state'];
export type TWardSettingsActions = ReturnType<typeof useWardSettings>['actions'];
export type TWardSettingsShiftType = TWardShiftType;
export type TWardSettingsShiftTeam = TShiftTeam;
