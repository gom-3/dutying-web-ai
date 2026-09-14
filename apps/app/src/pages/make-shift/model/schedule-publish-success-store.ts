import {create} from 'zustand';

export type TSchedulePublishSuccessNotice = {
    connectedNurseCount: number;
    showConnectionHint: boolean;
};

type TSchedulePublishSuccessState = {
    notice: TSchedulePublishSuccessNotice | null;
    show: (notice: TSchedulePublishSuccessNotice) => void;
    close: () => void;
};

export const useSchedulePublishSuccessStore = create<TSchedulePublishSuccessState>((set) => ({
    notice: null,
    show: (notice) => set({notice}),
    close: () => set({notice: null}),
}));
