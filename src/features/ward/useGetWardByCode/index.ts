import {useCallback} from 'react';
import {WardAPI} from '@/shared/api';
import {type TWard} from '@/shared/types/ward';

export default function useGetWardByCode() {
    const getWardByCode = useCallback((code: string): Promise<TWard> => {
        return WardAPI.getWardByCode(code);
    }, []);

    return {getWardByCode};
}
