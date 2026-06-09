import {useQuery} from '@tanstack/react-query';
import {wardQueryKeys} from '@/entities/ward/model/queries';
import useAuth from '@/features/auth';
import {WardAPI} from '@/shared/api';

export const useTotalPendingRequestCount = () => {
    const {
        state: {wardId},
    } = useAuth();

    const {data} = useQuery({
        queryKey: wardQueryKeys.requestPendingCount(wardId ?? 0),
        queryFn: async () => WardAPI.getReqShiftPendingCount(wardId!),
        enabled: typeof wardId === 'number',
        select: (response) => response.totalPendingCount,
    });

    return data ?? 0;
};
