import {create} from 'zustand';
import {devtools, persist} from 'zustand/middleware';
import {type TAccount} from '@/entities/account';
import {setAccessToken} from '@/shared/api/client';
import {type TValues} from '@/shared/types/util';

interface IState {
    accountMe: TAccount | null;
    isAuth: boolean;
    accessToken: string | null;
    accountId: number | null;
    nurseId: number | null;
    wardId: number | null;
    demoStartDate: string | null;
    _loaded: boolean;
}

interface IStore extends IState {
    setState: (key: keyof IState, value: TValues<IState>) => void;
    resetState: () => void;
}

const initialState: IState = {
    accountMe: null,
    isAuth: false,
    accessToken: null,
    accountId: null,
    nurseId: null,
    wardId: null,
    demoStartDate: null,
    _loaded: false,
};
const useAuthStore = create<IStore>()(
    devtools(
        persist(
            (set) => ({
                ...initialState,
                setState: (state, value) => set((prev) => ({...prev, [state]: value})),
                resetState: () => set({...initialState, _loaded: true}),
            }),
            {
                name: 'useAuthStore',
                partialize: ({isAuth, accessToken, accountId, nurseId, wardId, demoStartDate}: IStore) => {
                    if (accessToken) setAccessToken(accessToken);

                    return {
                        isAuth,
                        accessToken,
                        accountId,
                        nurseId,
                        wardId,
                        demoStartDate,
                        _loaded: true,
                    };
                },
            },
        ),
    ),
);

export default useAuthStore;
