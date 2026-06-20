import {type TValues} from '@dutying/utils';
import {create} from 'zustand';
import {devtools, persist} from 'zustand/middleware';
import {type TWardShiftType} from '@/entities/ward';
import {getNextRequestShiftDate} from './request-shift';
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
    resetToNextMonth: () => void;
    resetState: () => void;
}

const createInitialState = (): IState => {
    const {year, month} = getNextRequestShiftDate();

    return {
        wardId: null,
        year,
        month,
        focus: null,
        currentShiftTeamId: null,
        oldCurrentShiftTeamId: null,
        foldedLevels: null,
        wardShiftTypeMap: null,
        readonly: true,
        changeStatus: 'idle',
        updatingRequestId: null,
    };
};

export const useRequestShiftStore = create<IStore>()(
    devtools(
        persist(
            (set) => ({
                ...createInitialState(),
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
                resetToNextMonth: () =>
                    set((prev) => {
                        const {year, month} = getNextRequestShiftDate();

                        return {
                            ...prev,
                            year,
                            month,
                            focus: null,
                            readonly: true,
                            changeStatus: 'idle',
                            updatingRequestId: null,
                        };
                    }),
                resetState: () => set(createInitialState()),
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
