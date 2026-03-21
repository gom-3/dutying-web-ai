import {create} from 'zustand';
import {devtools, persist} from 'zustand/middleware';
import {type TWardShiftType} from '@/entities/ward';
import {type TValues} from '@/shared/types/util';
import {type TFocus} from './type';

interface IState {
    year: number;
    month: number;
    focus: TFocus | null;
    foldedLevels: boolean[] | null;
    currentShiftTeamId: number | null;
    oldCurrentShiftTeamId: number | null;
    wardShiftTypeMap: Map<number, TWardShiftType> | null;
    readonly: boolean;
}

interface IStore extends IState {
    setState: (key: keyof IState, value: TValues<IState>) => void;
    resetState: () => void;
}

const initialState: IState = {
    year: new Date().getMonth() + 1 === 12 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
    month: new Date().getMonth() + 1 === 12 ? 1 : new Date().getMonth() + 2,
    focus: null,
    currentShiftTeamId: null,
    oldCurrentShiftTeamId: null,
    foldedLevels: null,
    wardShiftTypeMap: null,
    readonly: true,
};

export const useRequestShiftStore = create<IStore>()(
    devtools(
        persist(
            (set) => ({
                ...initialState,
                setState: (state, value) => set((prev) => ({...prev, [state]: value})),
                resetState: () => set(initialState),
            }),
            {
                name: 'useRequestShiftStore',
                partialize: ({year, month, currentShiftTeamId, oldCurrentShiftTeamId}: IStore) => ({
                    year,
                    month,
                    currentShiftTeamId,
                    oldCurrentShiftTeamId,
                }),
            },
        ),
    ),
);
