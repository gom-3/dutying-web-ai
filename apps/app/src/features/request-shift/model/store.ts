import {type TValues} from '@dutying/utils';
import {create} from 'zustand';
import {devtools, persist} from 'zustand/middleware';
import {type TWardShiftType} from '@/entities/ward';
import {type TFocus} from './types';

interface IState {
    wardId: number | null;
    year: number;
    month: number;
    focus: TFocus | null;
    foldedLevels: boolean[] | null;
    currentShiftTeamId: number | null;
    oldCurrentShiftTeamId: number | null;
    wardShiftTypeMap: Map<number, TWardShiftType> | null;
    readonly: boolean;
    changeStatus: 'idle' | 'loading' | 'success' | 'error';
    updatingRequestId: number | null;
}

interface IStore extends IState {
    setState: (key: keyof IState, value: TValues<IState>) => void;
    setWardContext: (wardId: number | null) => void;
    resetState: () => void;
}

const initialState: IState = {
    wardId: null,
    year: new Date().getMonth() + 1 === 12 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
    month: new Date().getMonth() + 1 === 12 ? 1 : new Date().getMonth() + 2,
    focus: null,
    currentShiftTeamId: null,
    oldCurrentShiftTeamId: null,
    foldedLevels: null,
    wardShiftTypeMap: null,
    readonly: true,
    changeStatus: 'idle',
    updatingRequestId: null,
};

export const useRequestShiftStore = create<IStore>()(
    devtools(
        persist(
            (set) => ({
                ...initialState,
                setState: (state, value) => set((prev) => ({...prev, [state]: value})),
                setWardContext: (wardId) =>
                    set((prev) => {
                        if (prev.wardId === wardId) return prev;

                        return {
                            ...prev,
                            wardId,
                            focus: null,
                            currentShiftTeamId: null,
                            oldCurrentShiftTeamId: null,
                            foldedLevels: null,
                            wardShiftTypeMap: null,
                            changeStatus: 'idle',
                            updatingRequestId: null,
                        };
                    }),
                resetState: () => set(initialState),
            }),
            {
                name: 'useRequestShiftStore',
                partialize: ({wardId, year, month, currentShiftTeamId, oldCurrentShiftTeamId}: IStore) => ({
                    wardId,
                    year,
                    month,
                    currentShiftTeamId,
                    oldCurrentShiftTeamId,
                }),
            },
        ),
    ),
);
