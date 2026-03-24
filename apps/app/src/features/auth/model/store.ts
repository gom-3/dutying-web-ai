import {type TValues} from '@dutying/utils';
import {create} from 'zustand';
import {devtools, persist, type PersistStorage, type StorageValue} from 'zustand/middleware';
import {type TAccount} from '@/entities/account';
import {setAccessToken} from '@/shared/api/client';

interface IState {
    accountMe: TAccount | null;
    accountMeStatus: 'idle' | 'loading' | 'success' | 'error';
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

type TPersistedAuthState = Pick<IState, 'isAuth' | 'accessToken' | 'accountId' | 'nurseId' | 'wardId' | 'demoStartDate'>;

const initialState: IState = {
    accountMe: null,
    accountMeStatus: 'idle',
    isAuth: false,
    accessToken: null,
    accountId: null,
    nurseId: null,
    wardId: null,
    demoStartDate: null,
    _loaded: false,
};
const authStoreStorage: PersistStorage<TPersistedAuthState> = {
    getItem: (name) => {
        const value = localStorage.getItem(name);

        if (!value) return null;

        try {
            return JSON.parse(value) as StorageValue<TPersistedAuthState>;
        } catch {
            localStorage.removeItem(name);

            return null;
        }
    },
    setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
    removeItem: (name) => localStorage.removeItem(name),
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
                storage: authStoreStorage,
                partialize: ({isAuth, accessToken, accountId, nurseId, wardId, demoStartDate}: IStore): TPersistedAuthState => {
                    if (accessToken) setAccessToken(accessToken);

                    return {
                        isAuth,
                        accessToken,
                        accountId,
                        nurseId,
                        wardId,
                        demoStartDate,
                    };
                },
                onRehydrateStorage: (state) => (rehydratedState) => {
                    (rehydratedState ?? state).setState('_loaded', true);
                },
            },
        ),
    ),
);

export default useAuthStore;
