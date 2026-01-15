import {useCallback} from 'react';
import {WardAPI} from '@/shared/api';
import {type Ward} from '@/entities/ward';

export default function useGetWardByCode() {
    const getWardByCode = useCallback((code: string): Promise<Ward> => {
        return WardAPI.getWardByCode(code);
    }, []);

    return {getWardByCode};
}
